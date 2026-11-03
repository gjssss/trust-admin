'use client'

import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2, RotateCcw, Sparkles, UploadCloud } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { detectSingle, analyzeAi } from '../api'
import type { DetectionResult, LlmAnalysis } from '../api/types'
import { fileToDataUrl, fetchToDataUrl } from '../utils/image'
import type { HistoryItemInput } from '../hooks/use-fake-news-history'
import { LlmAnalysisPanel } from './llm-analysis-panel'

const defaultAnalysis: LlmAnalysis | null = null

const formatRumorLabel = (label: string, predictedClass: number) => {
  if (predictedClass === 0) return '非谣言'
  if (predictedClass === 1) return '谣言'
  return label
    .replace(/虚假新闻|假新闻|虚假/g, '谣言')
    .replace(/真实新闻|真实/g, '非谣言')
}

type DetectionTabProps = {
  modelLoaded: boolean
  onAddHistory: (input: HistoryItemInput) => void
}

type ImageState = {
  preview: string | null
  dataUrl: string | null
}

export function DetectionTab({ modelLoaded, onAddHistory }: DetectionTabProps) {
  const [text, setText] = useState('')
  const [imageState, setImageState] = useState<ImageState>({
    preview: null,
    dataUrl: null,
  })
  const [result, setResult] = useState<DetectionResult | null>(null)
  const [analysis, setAnalysis] = useState<LlmAnalysis | null>(defaultAnalysis)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const detectMutation = useMutation({
    mutationFn: detectSingle,
  })
  const analyzeMutation = useMutation({
    mutationFn: analyzeAi,
  })
  // const demoMutation = useMutation({
  //   mutationFn: fetchDemoSamples,
  // })

  const resolveImagePayload = async () => {
    if (imageState.dataUrl) return imageState.dataUrl
    if (imageState.preview) return fetchToDataUrl(imageState.preview)
    return undefined
  }

  const handleImageFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('请选择图片文件')
      return
    }
    try {
      const dataUrl = await fileToDataUrl(file)
      setImageState({ preview: dataUrl, dataUrl })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '图片读取失败')
    }
  }

  const handleDetect = async () => {
    if (!modelLoaded) {
      toast.error('请先加载模型')
      return
    }

    const trimmedText = text.trim()
    const imagePayload = await resolveImagePayload()

    if (!trimmedText && !imagePayload) {
      toast.error('请至少输入文本或上传图片')
      return
    }

    try {
      const response = await detectMutation.mutateAsync({
        text: trimmedText,
        image: imagePayload,
      })

      if (!response.success) {
        toast.error(response.message ?? '检测失败')
        return
      }

      setResult(response.result)
      setAnalysis(response.llm_analysis ?? null)
      onAddHistory({
        text: trimmedText,
        image: imageState.preview,
        result: response.result,
        llmAnalysis: response.llm_analysis ?? null,
      })
      toast.success('检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '检测失败')
    }
  }

  const handleAnalyze = async () => {
    const trimmedText = text.trim()
    const imagePayload = await resolveImagePayload()

    if (!trimmedText && !imagePayload) {
      toast.error('请至少输入文本或上传图片')
      return
    }

    try {
      const response = await analyzeMutation.mutateAsync({
        text: trimmedText,
        image: imagePayload,
      })

      if (!response.success) {
        toast.error(response.message ?? 'AI 分析失败')
        return
      }

      setAnalysis(response.llm_analysis)
      toast.success('AI 分析完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 分析失败')
    }
  }

  // const handleLoadDemo = async () => {
  //   try {
  //     const response = await demoMutation.mutateAsync()
  //     if (!response.success || response.samples.length === 0) {
  //       toast.error(response.message ?? '没有可用的演示样本')
  //       return
  //     }
  //     const sample =
  //       response.samples[Math.floor(Math.random() * response.samples.length)]
  //     setText(sample.text ?? '')
  //     if (sample.image_path && sample.image_exists) {
  //       const imageUrl = getFakeNewsImageUrl(sample.image_path)
  //       setImageState({ preview: imageUrl, dataUrl: null })
  //     } else {
  //       setImageState({ preview: null, dataUrl: null })
  //     }
  //     setResult(null)
  //     setAnalysis(null)
  //     toast.success(`已加载演示样本${sample.label_text ? `（${sample.label_text}）` : ''}`)
  //   } catch (error) {
  //     toast.error(error instanceof Error ? error.message : '加载演示样本失败')
  //   }
  // }

  const handleClear = () => {
    setText('')
    setImageState({ preview: null, dataUrl: null })
    setResult(null)
    setAnalysis(null)
  }

  const isBusy = detectMutation.isPending || analyzeMutation.isPending

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>单样本检测</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>待检测文本</label>
            <Textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder='请输入需要检测的文本，可为空'
              className='min-h-[140px]'
            />
          </div>

          <div className='space-y-2'>
            <label className='text-sm font-medium'>图片内容</label>
            <div
              className={`flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm transition ${
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-muted-foreground/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragOver(true)
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setIsDragOver(false)
                const file = event.dataTransfer.files?.[0]
                if (file) void handleImageFile(file)
              }}
            >
              {imageState.preview ? (
                <div className='w-full space-y-3'>
                  <img
                    src={imageState.preview}
                    alt='预览图'
                    className='max-h-48 w-full rounded-md object-contain'
                  />
                  <Button
                    type='button'
                    variant='outline'
                    size='sm'
                    onClick={(event) => {
                      event.stopPropagation()
                      setImageState({ preview: null, dataUrl: null })
                    }}
                  >
                    移除图片
                  </Button>
                </div>
              ) : (
                <div className='space-y-2 text-muted-foreground'>
                  <UploadCloud className='mx-auto size-6' />
                  <p>点击或拖拽上传图片</p>
                  <p className='text-xs'>支持 jpg/png/webp 等格式</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type='file'
              accept='image/*'
              className='hidden'
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void handleImageFile(file)
              }}
            />
          </div>

          <Separator />

          {!modelLoaded && (
            <p className='text-xs text-destructive'>
              当前模型未加载，检测功能将被禁用
            </p>
          )}

          <div className='flex flex-wrap gap-2'>
            <Button
              type='button'
              onClick={handleDetect}
              disabled={isBusy || !modelLoaded}
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
              onClick={handleAnalyze}
              disabled={isBusy}
            >
              {analyzeMutation.isPending ? (
                <span className='inline-flex items-center gap-2'>
                  <Loader2 className='size-4 animate-spin' />
                  分析中
                </span>
              ) : (
                <span className='inline-flex items-center gap-2'>
                  <Sparkles className='size-4' />AI 分析
                </span>
              )}
            </Button>
            {/* <Button
              type='button'
              variant='secondary'
              onClick={handleLoadDemo}
              disabled={demoMutation.isPending}
            >
              {demoMutation.isPending ? '加载中...' : '加载演示样本'}
            </Button> */}
            <Button type='button' variant='ghost' onClick={handleClear}>
              <RotateCcw className='size-4' />清空
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
            <div className='flex flex-wrap items-center gap-2'>
              <span className='text-muted-foreground'>判定结果</span>
              <Badge variant={result.predicted_class === 1 ? 'destructive' : 'secondary'}>
                {formatRumorLabel(result.label, result.predicted_class)}
              </Badge>
              <span className='text-muted-foreground'>置信度</span>
              <span className='font-medium'>
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>非谣言概率</span>
                <span>{(result.probabilities.real * 100).toFixed(1)}%</span>
              </div>
              <div className='h-2 rounded-full bg-muted'>
                <div
                  className='h-2 rounded-full bg-emerald-500'
                  style={{ width: `${result.probabilities.real * 100}%` }}
                />
              </div>
              <div className='flex items-center justify-between text-xs text-muted-foreground'>
                <span>谣言概率</span>
                <span>{(result.probabilities.fake * 100).toFixed(1)}%</span>
              </div>
              <div className='h-2 rounded-full bg-muted'>
                <div
                  className='h-2 rounded-full bg-rose-500'
                  style={{ width: `${result.probabilities.fake * 100}%` }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {analysis && (analysis.should_analyze ?? true) && (
        <LlmAnalysisPanel analysis={analysis} />
      )}
    </div>
  )
}
