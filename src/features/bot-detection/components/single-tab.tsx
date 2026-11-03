'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { detectBotSingle } from '../api'
import {
  DEFAULT_USER_PROFILE,
  type BotDetectionSingleRequest,
  type BotDetectionSingleResult,
  type UserProfile,
} from '../api/types'

type SingleTabProps = {
  serviceHealthy: boolean
}

const BOOL_FIELDS: { key: keyof UserProfile; label: string }[] = [
  { key: 'verified', label: '已认证' },
  { key: 'default_profile_image', label: '默认头像' },
  { key: 'default_profile', label: '默认主页' },
  { key: 'protected', label: '受保护' },
]

const NUM_FIELDS: { key: keyof UserProfile; label: string }[] = [
  { key: 'followers_count', label: '粉丝数' },
  { key: 'friends_count', label: '关注数' },
  { key: 'listed_count', label: '列表数' },
  { key: 'favourites_count', label: '收藏数' },
  { key: 'statuses_count', label: '推文数' },
]

export function BotDetectionSingleTab({ serviceHealthy }: SingleTabProps) {
  const [user, setUser] = useState<UserProfile>({ ...DEFAULT_USER_PROFILE })
  const [tweetsText, setTweetsText] = useState('')
  const [result, setResult] = useState<BotDetectionSingleResult | null>(null)

  const detectMutation = useMutation({
    mutationFn: (payload: BotDetectionSingleRequest) => detectBotSingle(payload),
  })

  const setBool = (key: keyof UserProfile, val: boolean) =>
    setUser((prev) => ({ ...prev, [key]: val }))
  const setNum = (key: keyof UserProfile, val: string) =>
    setUser((prev) => ({ ...prev, [key]: Number(val) || 0 }))
  const setStr = (key: keyof UserProfile, val: string) =>
    setUser((prev) => ({ ...prev, [key]: val }))

  const handleDetect = async () => {
    setResult(null)
    const tweets = tweetsText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const payload = { user: { ...user, tweets } }

    try {
      const response = await detectMutation.mutateAsync(payload)
      if (!response.success || !response.data) {
        toast.error(response.message || '检测失败')
        return
      }
      setResult(response.data)
      toast.success('检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '检测失败')
    }
  }

  const handleReset = () => {
    setUser({ ...DEFAULT_USER_PROFILE })
    setTweetsText('')
    setResult(null)
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>单条检测</CardTitle>
        </CardHeader>
        <CardContent className='space-y-6'>
          {/* Bool fields */}
          <div className='space-y-2'>
            <Label>账号属性</Label>
            <div className='flex flex-wrap gap-4'>
              {BOOL_FIELDS.map(({ key, label }) => (
                <label
                  key={key}
                  className='flex items-center gap-2 text-sm'
                >
                  <Checkbox
                    checked={user[key] as boolean}
                    onCheckedChange={(v) => setBool(key, Boolean(v))}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Numeric fields */}
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {NUM_FIELDS.map(({ key, label }) => (
              <div key={key} className='space-y-1'>
                <Label className='text-xs'>{label}</Label>
                <Input
                  type='number'
                  min={0}
                  value={user[key] as number}
                  onChange={(e) => setNum(key, e.target.value)}
                />
              </div>
            ))}
          </div>

          {/* Text fields */}
          <div className='grid gap-4 sm:grid-cols-2'>
            <div className='space-y-1'>
              <Label className='text-xs'>用户名 (screen_name)</Label>
              <Input
                value={user.screen_name}
                onChange={(e) => setStr('screen_name', e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>昵称 (name)</Label>
              <Input
                value={user.name}
                onChange={(e) => setStr('name', e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>注册时间 (created_at)</Label>
              <Input
                type='datetime-local'
                value={user.created_at}
                onChange={(e) => setStr('created_at', e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>个人链接</Label>
              <Input
                value={user.url}
                onChange={(e) => setStr('url', e.target.value)}
              />
            </div>
            <div className='space-y-1'>
              <Label className='text-xs'>所在地</Label>
              <Input
                value={user.location}
                onChange={(e) => setStr('location', e.target.value)}
              />
            </div>
          </div>

          <div className='space-y-1'>
            <Label className='text-xs'>个人简介</Label>
            <Input
              value={user.description}
              onChange={(e) => setStr('description', e.target.value)}
            />
          </div>

          {/* Tweets */}
          <div className='space-y-2'>
            <Label>推文内容（每行一条）</Label>
            <Textarea
              value={tweetsText}
              onChange={(e) => setTweetsText(e.target.value)}
              placeholder={'推文1\n推文2\n推文3'}
              className='min-h-[120px]'
            />
          </div>

          {!serviceHealthy && (
            <p className='text-xs text-destructive'>
              当前服务不可用，检测功能暂时禁用
            </p>
          )}

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              onClick={handleDetect}
              disabled={detectMutation.isPending || !serviceHealthy}
            >
              {detectMutation.isPending ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='size-4 animate-spin' />
                  检测中
                </span>
              ) : (
                '开始检测'
              )}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={handleReset}
              disabled={detectMutation.isPending}
            >
              <RotateCcw className='size-4' /> 清空
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>检测结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>判定标签</p>
                <p className='mt-1 text-base font-semibold'>{result.label}</p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>置信度</p>
                <p className='mt-1 text-base font-semibold'>
                  {(result.confidence * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>human 概率</p>
                <p className='mt-1'>
                  {(result.probabilities.human * 100).toFixed(2)}%
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>bot 概率</p>
                <p className='mt-1'>
                  {(result.probabilities.bot * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>预测值</p>
              <p className='mt-1'>{result.prediction}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
