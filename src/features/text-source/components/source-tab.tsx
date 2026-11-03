'use client'

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { detectCnSource, detectCnText, detectEnSource, detectEnText } from '../api'
import type { SourceDetectResponse, TextDetectResponse } from '../api/types'

type SourceTabProps = {
  lang: 'cn' | 'en'
}

const normalizeProbability = (value: number) => {
  if (!Number.isFinite(value)) return 0
  const percent = value >= 0 && value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, percent))
}

const isValidSourceResult = (payload: SourceDetectResponse) =>
  Array.isArray(payload.res) &&
  Array.isArray(payload.model_list) &&
  typeof payload.model_name === 'string'

const isValidDetectResult = (payload: TextDetectResponse) =>
  Array.isArray(payload.preds) &&
  payload.preds.length === 2 &&
  payload.preds.every((item) => Number.isFinite(item)) &&
  typeof payload.jud === 'string'

type CombinedDetectResult = {
  source: SourceDetectResponse
  detect: TextDetectResponse
}

const pieColors = ['#0ea5e9', '#f97316']

export function SourceTab({ lang }: SourceTabProps) {
  const [text, setText] = useState('')
  const [result, setResult] = useState<CombinedDetectResult | null>(null)

  const detectMutation = useMutation({
    mutationFn: async (input: string) => {
      if (lang === 'cn') {
        const [detect, source] = await Promise.all([
          detectCnText(input),
          detectCnSource(input),
        ])
        return { detect, source }
      }

      const [detect, source] = await Promise.all([
        detectEnText(input),
        detectEnSource(input),
      ])
      return { detect, source }
    },
  })

  const handleDetect = async () => {
    const trimmedText = text.trim()
    if (!trimmedText) {
      toast.error(lang === 'cn' ? '请输入中文文本' : 'Please input English text')
      return
    }

    try {
      const response = await detectMutation.mutateAsync(trimmedText)
      if (
        !isValidDetectResult(response.detect) ||
        !isValidSourceResult(response.source)
      ) {
        toast.error('返回数据格式异常')
        return
      }

      setResult(response)
      toast.success('检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '检测失败')
    }
  }

  const humanPercent = result
    ? normalizeProbability(result.detect.preds[0])
    : 0
  const machinePercent = result
    ? normalizeProbability(result.detect.preds[1])
    : 0
  const pieData = [
    { name: 'human', value: humanPercent },
    { name: 'machine', value: machinePercent },
  ]

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>
            {lang === 'cn' ? '中文溯源检测' : 'English Source Detection'}
          </CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>
              {lang === 'cn' ? '检测文本' : 'Text'}
            </label>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={
                lang === 'cn'
                  ? '请输入中文文本进行模型溯源'
                  : 'Input English text for source tracing'
              }
              className='min-h-[180px]'
            />
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              onClick={handleDetect}
              disabled={detectMutation.isPending}
            >
              {detectMutation.isPending ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='size-4 animate-spin' />
                  检测中
                </span>
              ) : (
                '开始检测'
              )}
            </Button>
            <Button
              type='button'
              variant='outline'
              onClick={() => {
                setText('')
                setResult(null)
              }}
              disabled={detectMutation.isPending}
            >
              <RotateCcw className='size-4' />
              清空
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>检测结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>判定标签</p>
              <p className='mt-1 text-base font-semibold'>{result.detect.jud}</p>
            </div>

            {result.detect.res && (
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>判定描述</p>
                <p className='mt-1'>{result.detect.res}</p>
              </div>
            )}

            <div className='rounded-md border p-3'>
              <p className='mb-3 text-muted-foreground'>Result of Detecting</p>
              <div className='h-[320px]'>
                <ResponsiveContainer width='100%' height='100%'>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey='value'
                      nameKey='name'
                      cx='50%'
                      cy='50%'
                      outerRadius={110}
                      labelLine
                      label={({ name, value }) =>
                        `${name}: ${Number(value).toFixed(2)} %`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.name}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value).toFixed(2)} %`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>human</p>
                <p className='mt-1 text-base font-semibold'>
                  {humanPercent.toFixed(2)}%
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>machine</p>
                <p className='mt-1 text-base font-semibold'>
                  {machinePercent.toFixed(2)}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>溯源结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-4 text-sm'>
            <div className='rounded-md border p-3'>
              <p className='text-muted-foreground'>最终判定</p>
              <p className='mt-1 text-base font-semibold'>
                {result.source.model_name}
              </p>
            </div>

            {result.source.model_list.length > 0 && (
              <div className='rounded-md border p-3'>
                <p className='mb-2 text-muted-foreground'>候选模型</p>
                <p className='break-words'>{result.source.model_list.join('、')}</p>
              </div>
            )}

            <div className='space-y-3'>
              <p className='text-muted-foreground'>概率分布</p>
              {result.source.res.length > 0 ? (
                result.source.res.map(([modelName, probability], index) => {
                  const percent = normalizeProbability(probability)
                  return (
                    <div
                      key={`${modelName}-${index}`}
                      className='rounded-md border p-3'
                    >
                      <div className='mb-2 flex items-center justify-between'>
                        <span className='font-medium'>{modelName}</span>
                        <span>{percent.toFixed(2)}%</span>
                      </div>
                      <div className='h-2 rounded-full bg-muted'>
                        <div
                          className='h-2 rounded-full bg-primary'
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  )
                })
              ) : (
                <p className='text-muted-foreground'>暂无可展示的概率结果</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
