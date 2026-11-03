'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { ModelInfo } from '../api/types'

const formatMeta = (model?: ModelInfo | null) => {
  if (!model) return '未选择模型'
  const parts = [model.bert_type, model.resnet_type].filter(Boolean)
  return parts.length ? parts.join(' + ') : '模型信息不完整'
}

type ModelPanelProps = {
  models: ModelInfo[]
  selectedModelId: string
  loading: boolean
  loadLoading: boolean
  modelLoaded: boolean
  currentModel?: ModelInfo | null
  onSelectModel: (value: string) => void
  onRefresh: () => void | Promise<void>
  onLoad: () => void | Promise<void>
}

export function ModelPanel({
  models,
  selectedModelId,
  loading,
  loadLoading,
  modelLoaded,
  currentModel,
  onSelectModel,
  onRefresh,
  onLoad,
}: ModelPanelProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between'>
        <CardTitle className='text-base'>模型管理</CardTitle>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={onRefresh}
          disabled={loading}
        >
          {loading ? '加载中...' : '刷新列表'}
        </Button>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='space-y-2'>
          <Select value={selectedModelId} onValueChange={onSelectModel}>
            <SelectTrigger>
              <SelectValue placeholder='请选择模型' />
            </SelectTrigger>
            <SelectContent>
              {models.length === 0 ? (
                <SelectItem value='__empty' disabled>
                  暂无可用模型
                </SelectItem>
              ) : (
                models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className='text-xs text-muted-foreground'>{formatMeta(currentModel)}</p>
        </div>
        <Button
          type='button'
          className='w-full'
          onClick={onLoad}
          disabled={!selectedModelId || loadLoading || models.length === 0}
        >
          {loadLoading ? '加载中...' : modelLoaded ? '重新加载模型' : '加载模型'}
        </Button>
      </CardContent>
    </Card>
  )
}
