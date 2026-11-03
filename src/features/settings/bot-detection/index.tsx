'use client'

import { useQuery } from '@tanstack/react-query'
import { fetchBotDetectionHealth } from '@/features/bot-detection/api'
import { BotDetectionStatusPanel } from '@/features/bot-detection/components/status-panel'
import { ContentSection } from '../components/content-section'

export function SettingsBotDetection() {
  const healthQuery = useQuery({
    queryKey: ['bot-detection', 'health'],
    queryFn: fetchBotDetectionHealth,
    refetchOnMount: 'always',
  })

  return (
    <ContentSection
      title='机器人账号检测'
      desc='查看机器人账号检测服务的运行状态。'
      contentClassName='lg:max-w-none'
    >
      <div className='space-y-6'>
        <BotDetectionStatusPanel
          health={healthQuery.data}
          loading={healthQuery.isFetching}
          onRefresh={async () => {
            await healthQuery.refetch()
          }}
        />
      </div>
    </ContentSection>
  )
}
