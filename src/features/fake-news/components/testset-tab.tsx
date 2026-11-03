'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { detectTestset } from '../api'
import type { DetectTestsetResponse } from '../api/types'

const formatPercent = (value?: number) => {
  if (value === undefined) return '—'
  return `${(value * 100).toFixed(2)}%`
}

type TestsetTabProps = {
  modelLoaded: boolean
}

export function TestsetTab({ modelLoaded }: TestsetTabProps) {
  const [maxSamples, setMaxSamples] = useState('')
  const [result, setResult] = useState<DetectTestsetResponse | null>(null)

  const testsetMutation = useMutation({
    mutationFn: detectTestset,
  })

  const handleDetect = async () => {
    if (!modelLoaded) {
      toast.error('请先加载模型')
      return
    }

    const parsed = Number(maxSamples)
    const payload = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined

    try {
      const response = await testsetMutation.mutateAsync({
        max_samples: payload,
      })
      if (!response.success) {
        toast.error(response.message ?? '测试集检测失败')
        return
      }
      setResult(response)
      toast.success('测试集检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '测试集检测失败')
    }
  }

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>测试集检测</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='flex flex-wrap items-center gap-3'>
            <Input
              type='number'
              min='1'
              value={maxSamples}
              onChange={(event) => setMaxSamples(event.target.value)}
              placeholder='最大样本数（留空为全部）'
              className='max-w-[240px]'
            />
            <Button type='button' onClick={handleDetect} disabled={!modelLoaded}>
              {testsetMutation.isPending ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='size-4 animate-spin' />
                  检测中
                </span>
              ) : (
                <span className='inline-flex items-center gap-2'>
                  <Play className='size-4' />开始检测
                </span>
              )}
            </Button>
            {!modelLoaded && (
              <span className='text-xs text-destructive'>模型未加载</span>
            )}
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>评估结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='flex flex-wrap gap-4 text-muted-foreground'>
              <span>准确率：{formatPercent(result.evaluation?.accuracy)}</span>
              {result.summary && (
                <>
                  <span>总数：{result.summary.total}</span>
                  <span>成功：{result.summary.success}</span>
                  <span>失败：{result.summary.error}</span>
                </>
              )}
            </div>
            {result.evaluation?.confusion_matrix && (
              <div className='rounded-md border p-3'>
                <p className='mb-2 font-medium'>混淆矩阵</p>
                <pre className='whitespace-pre-wrap text-xs text-muted-foreground'>
                  {JSON.stringify(result.evaluation.confusion_matrix, null, 2)}
                </pre>
              </div>
            )}
            {result.evaluation?.classification_report && (
              <div className='rounded-md border p-3'>
                <p className='mb-2 font-medium'>分类报告</p>
                <pre className='whitespace-pre-wrap text-xs text-muted-foreground'>
                  {JSON.stringify(result.evaluation.classification_report, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
