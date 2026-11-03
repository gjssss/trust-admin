'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { LlmAnalysis } from '../api/types'

const riskVariantMap: Record<string, 'secondary' | 'destructive'> = {
  高: 'destructive',
  中: 'secondary',
}

type LlmAnalysisPanelProps = {
  analysis: LlmAnalysis
}

export function LlmAnalysisPanel({ analysis }: LlmAnalysisPanelProps) {
  const [openRaw, setOpenRaw] = useState(false)
  const overall = analysis.overall_assessment
  const basic = analysis.basic_analysis
  const sentiment = analysis.sentiment_analysis
  const suspicious = analysis.suspicious_words_analysis

  const rawJson = useMemo(() => JSON.stringify(analysis, null, 2), [analysis])

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>AI 深度分析</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 text-sm'>
        {overall && (
          <div className='rounded-md border p-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground'>综合风险</span>
              <Badge variant={riskVariantMap[overall.overall_risk_level ?? ''] ?? 'secondary'}>
                {overall.overall_risk_level ?? '未知'}
              </Badge>
            </div>
            {overall.summary && (
              <p className='mt-2 text-muted-foreground'>{overall.summary}</p>
            )}
            {overall.recommendation && (
              <p className='mt-2'>建议：{overall.recommendation}</p>
            )}
            {overall.risk_factors?.length ? (
              <ul className='mt-2 list-disc space-y-1 ps-5'>
                {overall.risk_factors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        {basic?.suspicious_points?.length ? (
          <div>
            <p className='font-medium'>可疑点</p>
            <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
              {basic.suspicious_points.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {basic?.suggestions?.length ? (
          <div>
            <p className='font-medium'>建议</p>
            <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
              {basic.suggestions.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {(sentiment?.overall_sentiment || sentiment?.sentiment_intensity) && (
          <div className='rounded-md border p-3'>
            <p className='font-medium'>情感倾向</p>
            <div className='mt-2 flex flex-wrap items-center gap-3 text-muted-foreground'>
              <span>整体：{sentiment?.overall_sentiment ?? '未知'}</span>
              {sentiment?.sentiment_intensity !== undefined && (
                <span>强度：{sentiment.sentiment_intensity}/10</span>
              )}
            </div>
            {sentiment?.primary_emotions?.length ? (
              <div className='mt-2 flex flex-wrap gap-2'>
                {sentiment.primary_emotions.map((item) => (
                  <Badge key={item} variant='outline'>
                    {item}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {suspicious && (
          <div className='rounded-md border p-3'>
            <p className='font-medium'>可疑表达</p>
            <div className='mt-2 flex flex-wrap items-center gap-3 text-muted-foreground'>
              <span>风险等级：{suspicious.risk_level ?? '未知'}</span>
              {suspicious.total_suspicious_count !== undefined && (
                <span>数量：{suspicious.total_suspicious_count}</span>
              )}
              {suspicious.average_suspicious_level !== undefined && (
                <span>平均等级：{suspicious.average_suspicious_level}/10</span>
              )}
            </div>
            {suspicious.analysis_summary && (
              <p className='mt-2 text-muted-foreground'>
                {suspicious.analysis_summary}
              </p>
            )}
          </div>
        )}

        <Collapsible open={openRaw} onOpenChange={setOpenRaw}>
          <CollapsibleTrigger asChild>
            <Button type='button' variant='ghost' size='sm'>
              {openRaw ? '收起原始数据' : '查看原始 JSON'}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <ScrollArea className='mt-2 h-64 rounded-md border bg-muted/30 p-3 text-xs'>
              <pre className='whitespace-pre-wrap'>{rawJson}</pre>
            </ScrollArea>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
