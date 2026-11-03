'use client'

import { useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { detectBotBatch } from '../api'
import type {
  BotDetectionBatchData,
  BotDetectionBatchError,
  BotDetectionBatchResult,
  UserProfile,
} from '../api/types'

const BOOL_KEYS = new Set([
  'verified',
  'default_profile_image',
  'default_profile',
  'protected',
  'geo_enabled',
  'contributors_enabled',
])
const NUM_KEYS = new Set([
  'followers_count',
  'friends_count',
  'listed_count',
  'favourites_count',
  'statuses_count',
])

const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }
    if (char === ',') {
      pushField()
      continue
    }
    if (char === '\n') {
      pushField()
      pushRow()
      continue
    }
    if (char === '\r') {
      if (next === '\n') i += 1
      pushField()
      pushRow()
      continue
    }
    field += char
  }

  pushField()
  if (row.length > 1 || row[0]?.length) pushRow()
  return rows
}

function csvRowToProfile(
  headers: string[],
  values: string[]
): UserProfile {
  const profile: Record<string, unknown> = {
    verified: false,
    default_profile_image: false,
    default_profile: false,
    protected: false,
    geo_enabled: false,
    contributors_enabled: false,
    followers_count: 0,
    friends_count: 0,
    listed_count: 0,
    favourites_count: 0,
    statuses_count: 0,
    created_at: '',
    screen_name: '',
    name: '',
    description: '',
    location: '',
    url: '',
    tweets: [],
  }

  for (let i = 0; i < headers.length; i++) {
    const key = headers[i].trim().toLowerCase()
    const val = (values[i] ?? '').trim()

    if (key === 'tweets') {
      profile.tweets = val
        .split('|')
        .map((t) => t.trim())
        .filter(Boolean)
    } else if (BOOL_KEYS.has(key)) {
      profile[key] = val === '1' || val.toLowerCase() === 'true'
    } else if (NUM_KEYS.has(key)) {
      profile[key] = Number(val) || 0
    } else if (key in profile) {
      profile[key] = val
    }
  }

  return profile as unknown as UserProfile
}

function parseJsonl(text: string): UserProfile[] {
  const profiles: UserProfile[] = []
  const lines = text.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    try {
      const obj = JSON.parse(trimmed)
      const rawProfile =
        obj.user && typeof obj.user === 'object' ? obj.user : obj
      // Ensure tweets is an array
      if (rawProfile.tweets && typeof rawProfile.tweets === 'string') {
        rawProfile.tweets = [rawProfile.tweets]
      }
      if (!rawProfile.tweets) {
        rawProfile.tweets = []
      }
      // Apply defaults for missing fields
      profiles.push({
        verified: rawProfile.verified ?? false,
        default_profile_image: rawProfile.default_profile_image ?? false,
        default_profile: rawProfile.default_profile ?? false,
        protected: rawProfile.protected ?? false,
        geo_enabled: rawProfile.geo_enabled ?? false,
        contributors_enabled: rawProfile.contributors_enabled ?? false,
        followers_count: rawProfile.followers_count ?? 0,
        friends_count: rawProfile.friends_count ?? 0,
        listed_count: rawProfile.listed_count ?? 0,
        favourites_count: rawProfile.favourites_count ?? 0,
        statuses_count: rawProfile.statuses_count ?? 0,
        created_at: rawProfile.created_at ?? '',
        screen_name: rawProfile.screen_name ?? '',
        name: rawProfile.name ?? '',
        description: rawProfile.description ?? '',
        location: rawProfile.location ?? '',
        url: rawProfile.url ?? '',
        tweets: rawProfile.tweets,
      })
    } catch {
      // Skip invalid JSON lines
    }
  }

  return profiles
}

type LabelFilter = 'all' | 'human' | 'bot'
type ScoreSort = 'none' | 'human-desc' | 'human-asc' | 'bot-desc' | 'bot-asc'

type BatchTabProps = {
  serviceHealthy: boolean
}

export function BotDetectionBatchTab({ serviceHealthy }: BatchTabProps) {
  const [items, setItems] = useState<UserProfile[]>([])
  const [result, setResult] = useState<BotDetectionBatchData | null>(null)
  const [importing, setImporting] = useState(false)
  const [labelFilter, setLabelFilter] = useState<LabelFilter>('all')
  const [scoreSort, setScoreSort] = useState<ScoreSort>('none')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const batchMutation = useMutation({ mutationFn: detectBotBatch })

  const handleUploadFile = async (file: File) => {
    const lowerName = file.name.toLowerCase()
    const isJsonl = lowerName.endsWith('.jsonl')
    const isCsv = lowerName.endsWith('.csv') || file.type === 'text/csv'
    
    if (!isJsonl && !isCsv && file.type !== '') {
      toast.error('请选择 CSV 或 JSONL 文件')
      return
    }

    setImporting(true)
    try {
      const raw = await file.text()
      const normalized = raw.replace(/^\uFEFF/, '')
      
      let profiles: UserProfile[] = []
      
      if (isJsonl) {
        profiles = parseJsonl(normalized)
        if (profiles.length === 0) {
          toast.error('JSONL 内容为空或格式错误')
          return
        }
      } else {
        // CSV parsing
        const rows = parseCsv(normalized).filter((r) =>
          r.some((c) => c.trim() !== '')
        )

        if (rows.length < 2) {
          toast.error('CSV 内容为空或无数据行')
          return
        }

        const headers = rows[0].map((h) => h.trim().toLowerCase())
        for (let i = 1; i < rows.length; i++) {
          profiles.push(csvRowToProfile(headers, rows[i]))
        }
      }

      setItems(profiles)
      setResult(null)
      toast.success(`已导入 ${profiles.length} 条账号数据`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '文件解析失败')
    } finally {
      setImporting(false)
    }
  }

  const handleDetect = async () => {
    setResult(null)
    if (items.length === 0) {
      toast.error('请先导入数据文件')
      return
    }

    try {
      const response = await batchMutation.mutateAsync({ items })
      if (!response.success || !response.data) {
        toast.error(response.message || '批量检测失败')
        return
      }
      setResult(response.data)
      setLabelFilter('all')
      setScoreSort('none')
      toast.success('批量检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量检测失败')
    }
  }

  const resultRows = useMemo<BotDetectionBatchResult[]>(
    () => result?.results ?? [],
    [result?.results]
  )

  const errorRows = useMemo<BotDetectionBatchError[]>(
    () => result?.errors ?? [],
    [result?.errors]
  )

  const filteredSortedRows = useMemo(() => {
    const filtered = resultRows.filter((row) => {
      if (labelFilter === 'all') return true
      return row.label === labelFilter
    })

    if (scoreSort === 'none') return filtered

    const sorted = [...filtered]
    sorted.sort((a, b) => {
      const humanDiff = a.probabilities.human - b.probabilities.human
      const botDiff = a.probabilities.bot - b.probabilities.bot
      if (scoreSort === 'human-desc') return -humanDiff
      if (scoreSort === 'human-asc') return humanDiff
      if (scoreSort === 'bot-desc') return -botDiff
      return botDiff
    })
    return sorted
  }, [labelFilter, resultRows, scoreSort])

  const labelStats = useMemo(() => {
    let humanCount = 0
    let botCount = 0
    for (const row of resultRows) {
      if (row.label === 'human') humanCount += 1
      if (row.label === 'bot') botCount += 1
    }
    const total = humanCount + botCount
    return {
      total,
      humanCount,
      botCount,
      humanRatio: total > 0 ? humanCount / total : 0,
      botRatio: total > 0 ? botCount / total : 0,
    }
  }, [resultRows])

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>批量检测</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <Button
              type='button'
              variant='outline'
              onClick={() => fileInputRef.current?.click()}
              disabled={importing || batchMutation.isPending}
            >
              {importing ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='size-4 animate-spin' />
                  导入中
                </span>
              ) : (
                <span className='inline-flex items-center gap-2'>
                  <UploadCloud className='size-4' />
                  上传文件
                </span>
              )}
            </Button>
            <span className='text-xs text-muted-foreground'>
              支持 JSONL（推荐）或 CSV 格式
            </span>
            <input
              ref={fileInputRef}
              type='file'
              accept='.csv,.jsonl,text/csv,application/jsonl'
              className='hidden'
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleUploadFile(file)
                event.target.value = ''
              }}
            />
          </div>

          <div className='rounded-md border p-3 text-sm'>
            已加载样本：{items.length} 条
          </div>

          {!serviceHealthy && (
            <p className='text-xs text-destructive'>
              当前服务不可用，检测功能暂时禁用
            </p>
          )}

          <Button
            type='button'
            className='w-full'
            onClick={handleDetect}
            disabled={
              batchMutation.isPending || items.length === 0 || !serviceHealthy
            }
          >
            {batchMutation.isPending ? (
              <span className='inline-flex items-center gap-2'>
                <Loader2 className='size-4 animate-spin' />
                检测中
              </span>
            ) : (
              '开始批量检测'
            )}
          </Button>
        </CardContent>
      </Card>

      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>导入预览</CardTitle>
          </CardHeader>
          <CardContent>
            <div className='max-h-[280px] overflow-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>序号</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>昵称</TableHead>
                    <TableHead>粉丝</TableHead>
                    <TableHead>关注</TableHead>
                    <TableHead>推文数</TableHead>
                    <TableHead>推文条数</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{index + 1}</TableCell>
                      <TableCell>{item.screen_name || '-'}</TableCell>
                      <TableCell>{item.name || '-'}</TableCell>
                      <TableCell>{item.followers_count}</TableCell>
                      <TableCell>{item.friends_count}</TableCell>
                      <TableCell>{item.statuses_count}</TableCell>
                      <TableCell>{item.tweets.length}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>检测结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex flex-wrap gap-4 text-sm text-muted-foreground'>
              <span>总数：{result.total}</span>
              <span>成功：{result.success_count}</span>
              <span>失败：{result.failed_count}</span>
            </div>

            <div className='grid gap-3 md:grid-cols-2'>
              <Select
                value={labelFilter}
                onValueChange={(v) => setLabelFilter(v as LabelFilter)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='标签过滤' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='all'>全部标签</SelectItem>
                  <SelectItem value='human'>仅 human</SelectItem>
                  <SelectItem value='bot'>仅 bot</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={scoreSort}
                onValueChange={(v) => setScoreSort(v as ScoreSort)}
              >
                <SelectTrigger>
                  <SelectValue placeholder='排序方式' />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='none'>默认顺序</SelectItem>
                  <SelectItem value='human-desc'>human 概率降序</SelectItem>
                  <SelectItem value='human-asc'>human 概率升序</SelectItem>
                  <SelectItem value='bot-desc'>bot 概率降序</SelectItem>
                  <SelectItem value='bot-asc'>bot 概率升序</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>标签</TableHead>
                    <TableHead>数量</TableHead>
                    <TableHead>占比</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>human</TableCell>
                    <TableCell>{labelStats.humanCount}</TableCell>
                    <TableCell>
                      {(labelStats.humanRatio * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>bot</TableCell>
                    <TableCell>{labelStats.botCount}</TableCell>
                    <TableCell>
                      {(labelStats.botRatio * 100).toFixed(2)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            <div className='text-xs text-muted-foreground'>
              当前结果显示：{filteredSortedRows.length} / {resultRows.length}
            </div>

            <div className='max-h-[320px] overflow-auto rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className='w-16'>索引</TableHead>
                    <TableHead>用户名</TableHead>
                    <TableHead>标签</TableHead>
                    <TableHead>置信度</TableHead>
                    <TableHead>human</TableHead>
                    <TableHead>bot</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSortedRows.length > 0 ? (
                    filteredSortedRows.map((row) => (
                      <TableRow key={row.index}>
                        <TableCell>{row.index}</TableCell>
                        <TableCell>
                          {items[row.index]?.screen_name || '-'}
                        </TableCell>
                        <TableCell>{row.label}</TableCell>
                        <TableCell>
                          {(row.confidence * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          {(row.probabilities.human * 100).toFixed(2)}%
                        </TableCell>
                        <TableCell>
                          {(row.probabilities.bot * 100).toFixed(2)}%
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className='text-center text-muted-foreground'
                      >
                        当前过滤条件下无结果
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {errorRows.length > 0 && (
              <div className='space-y-2 text-sm'>
                <p className='font-medium text-destructive'>失败项</p>
                <div className='rounded-md border border-destructive/40 bg-destructive/5 p-3'>
                  {errorRows.map((e) => (
                    <p key={`${e.index}-${e.error}`}>
                      索引 {e.index}: {e.error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
