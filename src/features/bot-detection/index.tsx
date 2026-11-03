'use client'

import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { fetchBotDetectionHealth } from './api'
import { BotDetectionBatchTab } from './components/batch-tab'
import { BotDetectionSingleTab } from './components/single-tab'

export function BotDetectionMonitor() {
  const healthQuery = useQuery({
    queryKey: ['bot-detection', 'health'],
    queryFn: fetchBotDetectionHealth,
    refetchOnMount: 'always',
  })

  const serviceHealthy =
    healthQuery.data?.success && healthQuery.data.data?.status === 'healthy'

  return (
    <>
      <Header>
        <div>
          <h1 className='text-lg font-semibold'>机器人账号检测</h1>
          <p className='text-xs text-muted-foreground'>
            支持单条检测与批量检测，服务状态请查看设置页面
          </p>
        </div>
      </Header>

      <Main>
        <Tabs defaultValue='single' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='single'>单条检测</TabsTrigger>
            <TabsTrigger value='batch'>批量检测</TabsTrigger>
          </TabsList>
          <TabsContent value='single'>
            <BotDetectionSingleTab serviceHealthy={Boolean(serviceHealthy)} />
          </TabsContent>
          <TabsContent value='batch'>
            <BotDetectionBatchTab serviceHealthy={Boolean(serviceHealthy)} />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
