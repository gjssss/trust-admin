'use client'

import { useQuery } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fetchHealth } from './api'
import { DetectionTab } from './components/detection-tab'
import { BatchTab } from './components/batch-tab'
import { TestsetTab } from './components/testset-tab'
import { HistoryTab } from './components/history-tab'
import { useFakeNewsHistory } from './hooks/use-fake-news-history'

export function FakeNewsMonitor() {
  const { items, stats, addItem, removeItem, clear } = useFakeNewsHistory()

  const healthQuery = useQuery({
    queryKey: ['fake-news', 'health'],
    queryFn: fetchHealth,
    refetchOnMount: 'always',
  })

  const modelLoaded = healthQuery.data?.success ? healthQuery.data.model_loaded : false

  return (
    <>
      <Header>
        <div>
          <h1 className='text-lg font-semibold'>谣言检测</h1>
          <p className='text-xs text-muted-foreground'>
            多模态谣言检测与 AI 深度分析
          </p>
        </div>
      </Header>

      <Main>
        <Tabs defaultValue='detect' className='space-y-4'>
          <TabsList className='flex flex-wrap'>
            <TabsTrigger value='detect'>单样本检测</TabsTrigger>
            <TabsTrigger value='batch'>批量检测</TabsTrigger>
            {/* <TabsTrigger value='testset'>测试集检测</TabsTrigger> */}
            <TabsTrigger value='history'>历史记录</TabsTrigger>
          </TabsList>
          <TabsContent value='detect'>
            <DetectionTab modelLoaded={modelLoaded} onAddHistory={addItem} />
          </TabsContent>
          <TabsContent value='batch'>
            <BatchTab modelLoaded={modelLoaded} />
          </TabsContent>
          <TabsContent value='testset'>
            <TestsetTab modelLoaded={modelLoaded} />
          </TabsContent>
          <TabsContent value='history'>
            <HistoryTab
              items={items}
              stats={stats}
              onRemove={removeItem}
              onClear={clear}
            />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
