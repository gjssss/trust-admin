'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { HealthResponse } from '../api/types'

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  healthy: { label: '正常', variant: 'secondary' },
}

type StatusPanelProps = {
  health?: HealthResponse
  loading?: boolean
  onRefresh: () => void | Promise<void>
}

export function StatusPanel({ health, loading, onRefresh }: StatusPanelProps) {
  const status = health?.status ?? 'unknown'
  const statusConfig = statusMap[status] ?? {
    label: '异常',
    variant: 'destructive',
  }
  const loadingLabel = loading && !health ? '加载中' : statusConfig.label
  const loadingVariant = loading && !health ? 'secondary' : statusConfig.variant
  const modelLoaded = health?.model_loaded

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle className='text-base'>运行状态</CardTitle>
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
          <span className='text-muted-foreground'>服务状态</span>
          <Badge variant={loadingVariant}>{loadingLabel}</Badge>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>设备</span>
          <span>{health?.device ?? '未知'}</span>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>模型状态</span>
          <Badge variant={modelLoaded ? 'secondary' : 'destructive'}>
            {modelLoaded ? '已加载' : '未加载'}
          </Badge>
        </div>
        <div className='flex items-center justify-between'>
          <span className='text-muted-foreground'>更新时间</span>
          <span>{health?.timestamp ?? '-'}</span>
        </div>
      </CardContent>
    </Card>
  )
}
