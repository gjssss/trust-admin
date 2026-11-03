'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchHealth, fetchModels, loadModel } from '@/features/fake-news/api'
import { ModelPanel } from '@/features/fake-news/components/model-panel'
import { StatusPanel } from '@/features/fake-news/components/status-panel'
import { ContentSection } from '../components/content-section'

export function SettingsFakeNews() {
  const [selectedModelId, setSelectedModelId] = useState('')

  const healthQuery = useQuery({
    queryKey: ['fake-news', 'health'],
    queryFn: fetchHealth,
    refetchOnMount: 'always',
  })

  const modelsQuery = useQuery({
    queryKey: ['fake-news', 'models'],
    queryFn: fetchModels,
    refetchOnMount: 'always',
  })

  const loadMutation = useMutation({
    mutationFn: loadModel,
  })

  const models = useMemo(() => {
    return modelsQuery.data?.success ? modelsQuery.data.models : []
  }, [modelsQuery.data])

  const resolvedModelId = useMemo(() => {
    return selectedModelId || models[0]?.id || ''
  }, [models, selectedModelId])

  const currentModel = useMemo(() => {
    if (!resolvedModelId) return null
    return models.find((model) => model.id === resolvedModelId) ?? null
  }, [models, resolvedModelId])

  const modelLoaded = healthQuery.data?.success ? healthQuery.data.model_loaded : false

  const handleLoadModel = async () => {
    if (!resolvedModelId) {
      toast.error('请先选择模型')
      return
    }
    try {
      const response = await loadMutation.mutateAsync(resolvedModelId)
      if (!response.success) {
        toast.error(response.message ?? '模型加载失败')
        return
      }
      await healthQuery.refetch()
      toast.success(`模型 ${response.model.name} 加载成功`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '模型加载失败')
    }
  }

  return (
    <ContentSection
      title='谣言检测'
      desc='管理运行状态、模型列表与加载状态。'
      contentClassName='lg:max-w-none'
    >
      <div className='space-y-6'>
        <StatusPanel
          health={healthQuery.data}
          loading={healthQuery.isFetching}
          onRefresh={async () => {
            await healthQuery.refetch()
          }}
        />

        <ModelPanel
          models={models}
          selectedModelId={resolvedModelId}
          loading={modelsQuery.isFetching}
          loadLoading={loadMutation.isPending}
          modelLoaded={modelLoaded}
          currentModel={currentModel}
          onSelectModel={setSelectedModelId}
          onRefresh={async () => {
            await modelsQuery.refetch()
          }}
          onLoad={handleLoadModel}
        />

        <Card>
          <CardHeader>
            <CardTitle className='text-base'>模型加载状态</CardTitle>
          </CardHeader>
          <CardContent className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>当前状态</span>
            <Badge variant={modelLoaded ? 'secondary' : 'destructive'}>
              {modelLoaded ? '模型已加载' : '模型未加载'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </ContentSection>
  )
}
