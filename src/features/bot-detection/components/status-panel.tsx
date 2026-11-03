'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  BotDetectionHealthData,
  BotDetectionHealthResponse,
} from '../api/types'

const statusMap: Record<
  string,
  { label: string; variant: 'default' | 'secondary' | 'destructive' }
> = {
  healthy: { label: '正常', variant: 'secondary' },
}

const formatEmbedding = (data?: BotDetectionHealthData | null) => {
  if (!data) return '-'

  if (data.embedding) {
    const size = data.embedding.qwen_size?.trim()
    const dimension = data.embedding.embedding_dim
    const model = ['Qwen3 Embedding', size].filter(Boolean).join(' ')

    return Number.isFinite(dimension) ? `${model} (${dimension}维)` : model
  }

  return data.embedding_models
    ? Object.entries(data.embedding_models)
        .map(([key, model]) => `${key}: ${model}`)
        .join(', ')
    : '-'
}

type StatusPanelProps = {
  health?: BotDetectionHealthResponse
  loading?: boolean
  onRefresh: () => void | Promise<void>
}

export function BotDetectionStatusPanel({
  health,
  loading,
  onRefresh,
}: StatusPanelProps) {
  const status = health?.data?.status ?? 'unknown'
  const statusConfig = statusMap[status] ?? {
    label: '异常',
    variant: 'destructive',
  }

  const embeddingDisplay = formatEmbedding(health?.data)

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle className='text-base'>服务状态</CardTitle>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '刷新中...' : '刷新'}
        </Button>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>服务健康</span>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>分类模型</span>
          <span>{health?.data?.model ?? '-'}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>计算设备</span>
          <span>{health?.data?.device ?? '-'}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>嵌入模型</span>
          <span className='text-right text-xs'>{embeddingDisplay}</span>
        </div>
      </CardContent>
    </Card>
  )
}
