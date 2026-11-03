'use client'

import { useMemo, useState } from 'react'
import { CalendarClock, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { HistoryItem } from '../hooks/use-fake-news-history'
import { LlmAnalysisPanel } from './llm-analysis-panel'

const formatTime = (value: string) => new Date(value).toLocaleString()

const formatRumorLabel = (label: string, predictedClass: number) => {
  if (predictedClass === 0) return '非谣言'
  if (predictedClass === 1) return '谣言'
  return label
    .replace(/虚假新闻|假新闻|虚假/g, '谣言')
    .replace(/真实新闻|真实/g, '非谣言')
}

type HistoryTabProps = {
  items: HistoryItem[]
  onRemove: (id: string) => void
  onClear: () => void
  stats: {
    total: number
    real: number
    fake: number
    avgConfidence: number
  }
}

export function HistoryTab({ items, onRemove, onClear, stats }: HistoryTabProps) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<HistoryItem | null>(null)

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (filter === 'real' && item.result.predicted_class !== 0) return false
      if (filter === 'fake' && item.result.predicted_class !== 1) return false
      if (search.trim()) {
        const query = search.trim().toLowerCase()
        return item.text.toLowerCase().includes(query)
      }
      return true
    })
  }, [items, filter, search])

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader className='flex flex-row items-center justify-between'>
          <CardTitle className='text-base'>检测历史</CardTitle>
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => {
              if (window.confirm('确定要清空所有历史记录吗？')) onClear()
            }}
          >
            清空
          </Button>
        </CardHeader>
        <CardContent className='space-y-4 text-sm'>
          <div className='grid gap-3 md:grid-cols-4'>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>总记录</p>
              <p className='text-lg font-semibold'>{stats.total}</p>
            </div>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>非谣言</p>
              <p className='text-lg font-semibold'>{stats.real}</p>
            </div>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>谣言</p>
              <p className='text-lg font-semibold'>{stats.fake}</p>
            </div>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>平均置信度</p>
              <p className='text-lg font-semibold'>
                {(stats.avgConfidence * 100).toFixed(1)}%
              </p>
            </div>
          </div>

          <div className='flex flex-wrap gap-2'>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className='w-[160px]'>
                <SelectValue placeholder='筛选结果' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>全部结果</SelectItem>
                <SelectItem value='real'>非谣言</SelectItem>
                <SelectItem value='fake'>谣言</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder='搜索文本'
              className='max-w-[240px]'
            />
          </div>
        </CardContent>
      </Card>

      <ScrollArea className='h-[420px] rounded-md border'>
        <div className='space-y-3 p-4'>
          {filteredItems.length === 0 ? (
            <div className='text-center text-sm text-muted-foreground'>
              暂无匹配的历史记录
            </div>
          ) : (
            filteredItems.map((item) => (
              <Card key={item.id}>
                <CardContent className='space-y-2 p-4 text-sm'>
                  <div className='flex flex-wrap items-center justify-between gap-2'>
                    <div className='flex items-center gap-2'>
                      <Badge
                        variant={
                          item.result.predicted_class === 1
                            ? 'destructive'
                            : 'secondary'
                        }
                      >
                        {formatRumorLabel(
                          item.result.label,
                          item.result.predicted_class
                        )}
                      </Badge>
                      <span className='text-muted-foreground'>
                        置信度 {(item.result.confidence * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className='flex items-center gap-2 text-muted-foreground'>
                      <CalendarClock className='size-4' />
                      <span>{formatTime(item.timestamp)}</span>
                    </div>
                  </div>
                  <p className='max-h-12 overflow-hidden text-muted-foreground'>
                    {item.text || '无文本内容'}
                  </p>
                  <div className='flex flex-wrap gap-2'>
                    <Button
                      type='button'
                      size='sm'
                      variant='outline'
                      onClick={() => {
                        setSelected(item)
                        setOpen(true)
                      }}
                    >
                      查看详情
                    </Button>
                    <Button
                      type='button'
                      size='sm'
                      variant='ghost'
                      onClick={() => onRemove(item.id)}
                    >
                      <Trash2 className='size-4' />删除
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className='max-w-2xl'>
          <DialogHeader>
            <DialogTitle>检测详情</DialogTitle>
            <DialogDescription>
              {selected ? formatTime(selected.timestamp) : ''}
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className='space-y-4'>
              <div>
                <p className='text-sm text-muted-foreground'>文本内容</p>
                <p className='mt-2 whitespace-pre-wrap text-sm'>
                  {selected.text || '无文本内容'}
                </p>
              </div>
              {selected.image && (
                <div>
                  <p className='text-sm text-muted-foreground'>图片内容</p>
                  <img
                    src={selected.image}
                    alt='检测图片'
                    className='mt-2 max-h-56 w-full rounded-md object-contain'
                  />
                </div>
              )}
              <div className='rounded-md border p-3 text-sm'>
                <div className='flex flex-wrap items-center gap-2'>
                  <Badge
                    variant={
                      selected.result.predicted_class === 1
                        ? 'destructive'
                        : 'secondary'
                    }
                  >
                    {formatRumorLabel(
                      selected.result.label,
                      selected.result.predicted_class
                    )}
                  </Badge>
                  <span className='text-muted-foreground'>
                    置信度 {(selected.result.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div className='mt-2 flex flex-wrap gap-4 text-muted-foreground'>
                  <span>
                    非谣言概率 {(selected.result.probabilities.real * 100).toFixed(1)}%
                  </span>
                  <span>
                    谣言概率 {(selected.result.probabilities.fake * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
              {selected.llmAnalysis && (
                <LlmAnalysisPanel analysis={selected.llmAnalysis} />
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
