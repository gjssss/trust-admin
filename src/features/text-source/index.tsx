'use client'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SourceTab } from './components/source-tab'

export function TextSourceMonitor() {
  return (
    <>
      <Header>
        <div>
          <h1 className='text-lg font-semibold'>文本溯源检测</h1>
          <p className='text-xs text-muted-foreground'>
            支持中英文文本来源模型溯源
          </p>
        </div>
      </Header>

      <Main>
        <Tabs defaultValue='cn' className='space-y-4'>
          <TabsList>
            <TabsTrigger value='cn'>中文检测</TabsTrigger>
            <TabsTrigger value='en'>英文检测</TabsTrigger>
          </TabsList>
          <TabsContent value='cn'>
            <SourceTab lang='cn' />
          </TabsContent>
          <TabsContent value='en'>
            <SourceTab lang='en' />
          </TabsContent>
        </Tabs>
      </Main>
    </>
  )
}
