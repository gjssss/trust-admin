'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  AlertCircle,
  Bot,
  FileSearch,
  Loader2,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { cn } from '@/lib/utils'
import {
  detectBotSingle,
  fetchBotDetectionHealth,
} from '@/features/bot-detection/api'
import {
  DEFAULT_USER_PROFILE,
  type BotDetectionSingleResult,
  type UserProfile,
} from '@/features/bot-detection/api/types'
import {
  detectBatch,
  fetchHealth,
} from '@/features/fake-news/api'
import type { DetectBatchResponse } from '@/features/fake-news/api/types'
import {
  detectCnSource,
  detectCnText,
  detectEnSource,
  detectEnText,
} from '@/features/text-source/api'
import type {
  SourceDetectResponse,
  TextDetectResponse,
} from '@/features/text-source/api/types'

type BoolField =
  | 'verified'
  | 'default_profile_image'
  | 'default_profile'
  | 'protected'

type NumField =
  | 'followers_count'
  | 'friends_count'
  | 'listed_count'
  | 'favourites_count'
  | 'statuses_count'

type TextField =
  | 'screen_name'
  | 'name'
  | 'created_at'
  | 'url'
  | 'location'
  | 'description'

type SourceLanguage = 'cn' | 'en'

type ContentSample = {
  id: string
  text: string
}

type SubmissionSample = {
  index: number
  text: string
}

type Submission = {
  profile: UserProfile
  samples: SubmissionSample[]
  language: SourceLanguage
}

type ModuleResult<T> =
  | {
      status: 'success'
      data: T
    }
  | {
      status: 'error'
      error: string
    }

type TextSourceSampleResult = {
  index: number
  text: string
  detect?: TextDetectResponse
  source?: SourceDetectResponse
  error?: string
}

type IntegratedResults = {
  bot: ModuleResult<BotDetectionSingleResult>
  fakeNews: ModuleResult<DetectBatchResponse>
  textSource: ModuleResult<TextSourceSampleResult[]>
}

type RiskLevel = 'normal' | 'suspect' | 'high'

type IntegratedRiskScore = {
  account: number | null
  rumor: number | null
  aiSource: number | null
  total: number | null
}

const BOOL_FIELDS: { key: BoolField; label: string }[] = [
  { key: 'verified', label: '已认证' },
  { key: 'default_profile_image', label: '默认头像' },
  { key: 'default_profile', label: '默认主页' },
  { key: 'protected', label: '受保护' },
]

const NUM_FIELDS: { key: NumField; label: string }[] = [
  { key: 'followers_count', label: '粉丝数' },
  { key: 'friends_count', label: '关注数' },
  { key: 'listed_count', label: '列表数' },
  { key: 'favourites_count', label: '收藏数' },
  { key: 'statuses_count', label: '推文数' },
]

const TEXT_FIELDS: { key: TextField; label: string; type?: string }[] = [
  { key: 'screen_name', label: '用户名 (screen_name)' },
  { key: 'name', label: '昵称 (name)' },
  { key: 'created_at', label: '注册时间', type: 'datetime-local' },
  { key: 'url', label: '个人链接' },
  { key: 'location', label: '所在地' },
  { key: 'description', label: '个人简介' },
]

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const createSample = (): ContentSample => ({
  id: createId(),
  text: '',
})

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

const normalizeProbability = (value: number) => {
  if (!Number.isFinite(value)) return 0
  const percent = value >= 0 && value <= 1 ? value * 100 : value
  return Math.max(0, Math.min(100, percent))
}

const normalizeUnitScore = (value: number | undefined | null) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const unit = value >= 0 && value <= 1 ? value : value / 100
  return Math.max(0, Math.min(1, unit))
}

const average = (values: number[]) => {
  if (values.length === 0) return null
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

const getBotLabelSign = (result: BotDetectionSingleResult) => {
  const label = result.label.trim().toLowerCase()
  if (label === 'human' || label.includes('人类')) return 1
  if (label === 'bot' || label.includes('robot') || label.includes('机器人')) {
    return -1
  }
  if (result.prediction === 0) return 1
  if (result.prediction === 1) return -1
  return null
}

const calculateAccountRisk = (
  result: ModuleResult<BotDetectionSingleResult>
) => {
  if (result.status === 'error') return null
  const confidence = normalizeUnitScore(result.data.confidence)
  const labelSign = getBotLabelSign(result.data)
  if (confidence === null || labelSign === null) return null
  return Math.max(0, Math.min(1, 0.5 - (confidence / 2) * labelSign))
}

const calculateRumorRisk = (result: ModuleResult<DetectBatchResponse>) => {
  if (result.status === 'error') return null
  const scores = result.data.results
    .filter((item) => item.success)
    .map((item) => {
      const confidence = normalizeUnitScore(item.confidence)
      const fakeProbability = normalizeUnitScore(item.probabilities?.fake)
      if (confidence === null || fakeProbability === null) return null
      return confidence * fakeProbability
    })
    .filter((score): score is number => score !== null)
  return average(scores)
}

const calculateAiSourceRisk = (
  result: ModuleResult<TextSourceSampleResult[]>
) => {
  if (result.status === 'error') return null
  const scores = result.data
    .map((item) => {
      if (item.error || !item.detect) return null
      return normalizeUnitScore(item.detect.preds[1])
    })
    .filter((score): score is number => score !== null)
  return average(scores)
}

const calculateIntegratedRisk = (
  results: IntegratedResults
): IntegratedRiskScore => {
  const account = calculateAccountRisk(results.bot)
  const rumor = calculateRumorRisk(results.fakeNews)
  const aiSource = calculateAiSourceRisk(results.textSource)
  const total =
    account === null || rumor === null || aiSource === null
      ? null
      : 0.4 * account + 0.4 * rumor + 0.2 * aiSource

  return { account, rumor, aiSource, total }
}

const getRiskLevel = (score: number): RiskLevel => {
  if (score <= 0.5) return 'normal'
  if (score <= 0.8) return 'suspect'
  return 'high'
}

const formatRumorLabel = (label?: string, predictedClass?: number) => {
  if (predictedClass === 0) return '非谣言'
  if (predictedClass === 1) return '谣言'

  const value = label?.trim()
  if (!value) return '—'
  return value
    .replace(/虚假新闻|假新闻|虚假/g, '谣言')
    .replace(/真实新闻|真实/g, '非谣言')
}

const riskTheme: Record<
  RiskLevel,
  {
    label: string
    textClassName: string
    barClassName: string
    panelClassName: string
  }
> = {
  normal: {
    label: '正常账号',
    textClassName: 'text-emerald-600 dark:text-emerald-400',
    barClassName: 'bg-emerald-500',
    panelClassName: 'border-emerald-500/30 bg-emerald-500/5',
  },
  suspect: {
    label: '疑似水军',
    textClassName: 'text-amber-600 dark:text-amber-400',
    barClassName: 'bg-amber-500',
    panelClassName: 'border-amber-500/30 bg-amber-500/5',
  },
  high: {
    label: '高度疑似水军',
    textClassName: 'text-rose-600 dark:text-rose-400',
    barClassName: 'bg-rose-500',
    panelClassName: 'border-rose-500/30 bg-rose-500/5',
  },
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

const toModuleResult = <T,>(settled: PromiseSettledResult<T>): ModuleResult<T> =>
  settled.status === 'fulfilled'
    ? { status: 'success', data: settled.value }
    : {
        status: 'error',
        error: getErrorMessage(settled.reason, '模块检测失败'),
      }

async function runFakeNewsDetection(samples: SubmissionSample[]) {
  const response = await detectBatch({
    items: samples.map((sample) => ({
      text: sample.text,
    })),
  })
  if (!response.success) {
    throw new Error(response.message ?? '谣言检测失败')
  }
  return response
}

async function runBotDetection(profile: UserProfile) {
  const response = await detectBotSingle(
    { user: profile },
    { includeAnalysis: true }
  )
  if (!response.success || !response.data) {
    throw new Error(response.message || '机器人账号检测失败')
  }
  return response.data
}

async function runTextSourceDetection(
  samples: SubmissionSample[],
  language: SourceLanguage
) {
  const detectText = language === 'cn' ? detectCnText : detectEnText
  const detectSource = language === 'cn' ? detectCnSource : detectEnSource

  return Promise.all(
    samples.map(async (sample): Promise<TextSourceSampleResult> => {
      try {
        const [detect, source] = await Promise.all([
          detectText(sample.text),
          detectSource(sample.text),
        ])
        if (!isValidDetectResult(detect) || !isValidSourceResult(source)) {
          throw new Error('返回数据格式异常')
        }
        return {
          index: sample.index,
          text: sample.text,
          detect,
          source,
        }
      } catch (error) {
        return {
          index: sample.index,
          text: sample.text,
          error: getErrorMessage(error, '文本溯源检测失败'),
        }
      }
    })
  )
}

async function runIntegratedDetection({
  profile,
  samples,
  language,
}: Submission): Promise<IntegratedResults> {
  const [bot, fakeNews, textSource] = await Promise.allSettled([
    runBotDetection(profile),
    runFakeNewsDetection(samples),
    runTextSourceDetection(samples, language),
  ])

  return {
    bot: toModuleResult(bot),
    fakeNews: toModuleResult(fakeNews),
    textSource: toModuleResult(textSource),
  }
}

export function IntegratedMonitor() {
  const [account, setAccount] = useState<UserProfile>({
    ...DEFAULT_USER_PROFILE,
  })
  const [sourceLanguage, setSourceLanguage] = useState<SourceLanguage>('cn')
  const [samples, setSamples] = useState<ContentSample[]>([createSample()])
  const [results, setResults] = useState<IntegratedResults | null>(null)

  const fakeNewsHealthQuery = useQuery({
    queryKey: ['fake-news', 'health'],
    queryFn: fetchHealth,
    refetchOnMount: 'always',
  })

  const botHealthQuery = useQuery({
    queryKey: ['bot-detection', 'health'],
    queryFn: fetchBotDetectionHealth,
    refetchOnMount: 'always',
  })

  const runMutation = useMutation({
    mutationFn: runIntegratedDetection,
  })

  const modelLoaded = fakeNewsHealthQuery.data?.success
    ? fakeNewsHealthQuery.data.model_loaded
    : false

  const botHealthy =
    botHealthQuery.data?.success &&
    botHealthQuery.data.data?.status === 'healthy'

  const resultSummary = useMemo(() => {
    if (!results) return null
    const moduleResults = [results.bot, results.fakeNews, results.textSource]
    const success = moduleResults.filter((item) => item.status === 'success').length
    return {
      success,
      error: moduleResults.length - success,
      total: moduleResults.length,
    }
  }, [results])

  const riskSummary = useMemo(
    () => (results ? calculateIntegratedRisk(results) : null),
    [results]
  )

  const setBool = (key: BoolField, value: boolean) => {
    setAccount((prev) => ({ ...prev, [key]: value }))
  }

  const setNum = (key: NumField, value: string) => {
    const parsed = Number(value)
    setAccount((prev) => ({
      ...prev,
      [key]: Number.isFinite(parsed) ? parsed : 0,
    }))
  }

  const setStr = (key: TextField, value: string) => {
    setAccount((prev) => ({ ...prev, [key]: value }))
  }

  const updateSampleText = (id: string, value: string) => {
    setSamples((prev) =>
      prev.map((sample) =>
        sample.id === id ? { ...sample, text: value } : sample
      )
    )
  }

  const removeSample = (id: string) => {
    setSamples((prev) => prev.filter((sample) => sample.id !== id))
  }

  const resetForm = () => {
    setAccount({ ...DEFAULT_USER_PROFILE })
    setSourceLanguage('cn')
    setSamples([createSample()])
    setResults(null)
  }

  const buildSubmission = (): Submission | null => {
    if (!botHealthy) {
      toast.error('机器人账号检测服务不可用')
      return null
    }
    if (!modelLoaded) {
      toast.error('请先在设置中加载谣言检测模型')
      return null
    }

    const submissionSamples: SubmissionSample[] = samples.map((sample, index) => ({
      index,
      text: sample.text.trim(),
    }))

    return {
      language: sourceLanguage,
      samples: submissionSamples,
      profile: {
        ...account,
        tweets: submissionSamples.map((sample) => sample.text),
      },
    }
  }

  const handleRun = async () => {
    setResults(null)
    const submission = buildSubmission()
    if (!submission) return

    try {
      const nextResults = await runMutation.mutateAsync(submission)
      setResults(nextResults)
      toast.success('综合检测完成')
    } catch (error) {
      toast.error(getErrorMessage(error, '综合检测失败'))
    }
  }

  return (
    <>
      <Header>
        <div>
          <h1 className='text-lg font-semibold'>综合检测</h1>
          <p className='text-xs text-muted-foreground'>
            聚合机器人账号、谣言与文本溯源检测
          </p>
        </div>
      </Header>

      <Main>
        <div className='space-y-6'>
          <Card>
            <CardHeader>
              <CardTitle className='text-base'>运行状态</CardTitle>
            </CardHeader>
            <CardContent className='grid gap-3 text-sm md:grid-cols-3'>
              <StatusItem
                icon={Bot}
                label='机器人账号检测'
                healthy={Boolean(botHealthy)}
                healthyText='服务可用'
                unhealthyText='服务不可用'
              />
              <StatusItem
                icon={ShieldCheck}
                label='谣言检测'
                healthy={Boolean(modelLoaded)}
                healthyText='模型已加载'
                unhealthyText='模型未加载'
              />
              <StatusItem
                icon={FileSearch}
                label='文本溯源检测'
                healthy
                healthyText='按语言调用'
                unhealthyText='不可用'
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className='text-base'>账号信息</CardTitle>
            </CardHeader>
            <CardContent className='space-y-6'>
              <div className='space-y-2'>
                <Label>账号属性</Label>
                <div className='flex flex-wrap gap-4'>
                  {BOOL_FIELDS.map(({ key, label }) => (
                    <label key={key} className='flex items-center gap-2 text-sm'>
                      <Checkbox
                        checked={account[key]}
                        onCheckedChange={(value) => setBool(key, Boolean(value))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>

              <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
                {NUM_FIELDS.map(({ key, label }) => (
                  <div key={key} className='space-y-1'>
                    <Label className='text-xs'>{label}</Label>
                    <Input
                      type='number'
                      min={0}
                      value={account[key]}
                      onChange={(event) => setNum(key, event.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className='grid gap-4 sm:grid-cols-2'>
                {TEXT_FIELDS.map(({ key, label, type }) => (
                  <div key={key} className='space-y-1'>
                    <Label className='text-xs'>{label}</Label>
                    <Input
                      type={type ?? 'text'}
                      value={account[key]}
                      onChange={(event) => setStr(key, event.target.value)}
                    />
                  </div>
                ))}
              </div>

              <div className='space-y-1'>
                <Label className='text-xs'>文本溯源语言</Label>
                <Select
                  value={sourceLanguage}
                  onValueChange={(value: SourceLanguage) =>
                    setSourceLanguage(value)
                  }
                >
                  <SelectTrigger className='w-40'>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value='cn'>中文</SelectItem>
                    <SelectItem value='en'>英文</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between gap-3'>
              <CardTitle className='text-base'>内容样本</CardTitle>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={() => setSamples((prev) => [...prev, createSample()])}
                disabled={runMutation.isPending}
              >
                <Plus className='size-4' />
                添加样本
              </Button>
            </CardHeader>
            <CardContent className='space-y-4'>
              <div className='max-h-[1000px] space-y-4 overflow-y-auto pr-1'>
                {samples.map((sample, index) => (
                  <div key={sample.id} className='rounded-md border p-4'>
                    <div className='mb-3 flex items-center justify-between gap-3'>
                      <p className='text-sm font-medium'>样本 {index + 1}</p>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={() => removeSample(sample.id)}
                        disabled={runMutation.isPending || samples.length === 1}
                      >
                        <Trash2 className='size-4' />
                      </Button>
                    </div>
                    <div className='space-y-2'>
                      <Label className='text-xs'>推文文本</Label>
                      <Textarea
                        value={sample.text}
                        onChange={(event) =>
                          updateSampleText(sample.id, event.target.value)
                        }
                        placeholder='请输入该账号发布的推文文本'
                        className='min-h-[120px]'
                        disabled={runMutation.isPending}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className='flex flex-wrap gap-2'>
                <Button
                  type='button'
                  onClick={() => {
                    void handleRun()
                  }}
                  disabled={runMutation.isPending}
                >
                  {runMutation.isPending ? (
                    <span className='inline-flex items-center gap-2'>
                      <Loader2 className='size-4 animate-spin' />
                      检测中
                    </span>
                  ) : (
                    '开始综合检测'
                  )}
                </Button>
                <Button
                  type='button'
                  variant='outline'
                  onClick={resetForm}
                  disabled={runMutation.isPending}
                >
                  <RotateCcw className='size-4' />
                  清空
                </Button>
              </div>
            </CardContent>
          </Card>

          {results && (
            <div className='space-y-6'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-base'>综合结果</CardTitle>
                </CardHeader>
                <CardContent className='space-y-5 text-sm'>
                  {riskSummary && <IntegratedRiskBlock score={riskSummary} />}
                  <div className='flex flex-wrap gap-3'>
                    <Badge variant='secondary'>
                      成功 {resultSummary?.success ?? 0}/{resultSummary?.total ?? 3}
                    </Badge>
                    <Badge
                      variant={resultSummary?.error ? 'destructive' : 'secondary'}
                    >
                      失败 {resultSummary?.error ?? 0}
                    </Badge>
                    <ModuleBadge label='机器人账号' result={results.bot} />
                    <ModuleBadge label='谣言' result={results.fakeNews} />
                    <ModuleBadge label='文本溯源' result={results.textSource} />
                  </div>
                </CardContent>
              </Card>

              <BotResultSection result={results.bot} />
              <FakeNewsResultSection result={results.fakeNews} />
              <TextSourceResultSection result={results.textSource} />
            </div>
          )}
        </div>
      </Main>
    </>
  )
}

function IntegratedRiskBlock({ score }: { score: IntegratedRiskScore }) {
  const level = score.total === null ? null : getRiskLevel(score.total)
  const theme = level ? riskTheme[level] : null

  return (
    <div className='space-y-4'>
      <div
        className={cn(
          'rounded-md border p-4',
          theme?.panelClassName ?? 'border-muted bg-muted/20'
        )}
      >
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <p className='text-sm text-muted-foreground'>账号结果分析</p>
            <p
              className={cn(
                'mt-2 text-3xl font-semibold',
                theme?.textClassName ?? 'text-muted-foreground'
              )}
            >
              {theme?.label ?? '无法计算'}
            </p>
          </div>
          <div className='text-left sm:text-right'>
            <p className='text-sm text-muted-foreground'>综合风险分</p>
            <p
              className={cn(
                'mt-2 text-2xl font-semibold',
                theme?.textClassName ?? 'text-muted-foreground'
              )}
            >
              {score.total === null
                ? '无法计算'
                : `${(score.total * 100).toFixed(1)}%`}
            </p>
          </div>
        </div>
      </div>

      <div className='grid gap-3 md:grid-cols-3'>
        <RiskProgress label='账号检测风险' value={score.account} />
        <RiskProgress label='谣言检测风险' value={score.rumor} />
        <RiskProgress label='AI溯源风险' value={score.aiSource} />
      </div>
    </div>
  )
}

function RiskProgress({ label, value }: { label: string; value: number | null }) {
  const level = value === null ? null : getRiskLevel(value)
  const theme = level ? riskTheme[level] : null
  const percent = value === null ? 0 : value * 100

  return (
    <div className='rounded-md border p-3'>
      <div className='mb-2 flex items-center justify-between gap-3'>
        <span className='font-medium'>{label}</span>
        <span
          className={cn(
            'shrink-0 text-sm font-semibold',
            theme?.textClassName ?? 'text-muted-foreground'
          )}
        >
          {value === null ? '暂无数据' : `${percent.toFixed(1)}%`}
        </span>
      </div>
      <div className='h-2.5 rounded-full bg-muted'>
        <div
          className={cn(
            'h-2.5 rounded-full transition-all',
            theme?.barClassName ?? 'bg-muted-foreground/30'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function StatusItem({
  icon: Icon,
  label,
  healthy,
  healthyText,
  unhealthyText,
}: {
  icon: React.ElementType
  label: string
  healthy: boolean
  healthyText: string
  unhealthyText: string
}) {
  return (
    <div className='flex items-center justify-between gap-3 rounded-md border p-3'>
      <div className='flex items-center gap-2'>
        <Icon className='size-4 text-muted-foreground' />
        <span>{label}</span>
      </div>
      <Badge variant={healthy ? 'secondary' : 'destructive'}>
        {healthy ? healthyText : unhealthyText}
      </Badge>
    </div>
  )
}

function ModuleBadge<T>({
  label,
  result,
}: {
  label: string
  result: ModuleResult<T>
}) {
  return (
    <Badge variant={result.status === 'success' ? 'secondary' : 'destructive'}>
      {label}：{result.status === 'success' ? '完成' : '失败'}
    </Badge>
  )
}

function ErrorBlock({ message }: { message: string }) {
  return (
    <Alert variant='destructive'>
      <AlertCircle />
      <AlertTitle>检测失败</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}

function BotResultSection({
  result,
}: {
  result: ModuleResult<BotDetectionSingleResult>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>机器人账号检测结果</CardTitle>
      </CardHeader>
      <CardContent className='space-y-4 text-sm'>
        {result.status === 'error' ? (
          <ErrorBlock message={result.error} />
        ) : (
          <>
            <div className='grid gap-3 sm:grid-cols-2'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>判定标签</p>
                <p className='mt-1 text-base font-semibold'>
                  {result.data.label}
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>置信度</p>
                <p className='mt-1 text-base font-semibold'>
                  {(result.data.confidence * 100).toFixed(2)}%
                </p>
              </div>
            </div>
            <div className='grid gap-3 sm:grid-cols-3'>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>human 概率</p>
                <p className='mt-1'>
                  {(result.data.probabilities.human * 100).toFixed(2)}%
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>bot 概率</p>
                <p className='mt-1'>
                  {(result.data.probabilities.bot * 100).toFixed(2)}%
                </p>
              </div>
              <div className='rounded-md border p-3'>
                <p className='text-muted-foreground'>预测值</p>
                <p className='mt-1'>{result.data.prediction}</p>
              </div>
            </div>
            {result.data.analysis && (
              <BotAnalysisBlock analysis={result.data.analysis} />
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function BotAnalysisBlock({
  analysis,
}: {
  analysis: BotDetectionSingleResult['analysis']
}) {
  if (!analysis) return null

  return (
    <div className='space-y-3 rounded-md border p-3'>
      <div className='flex flex-wrap items-center gap-2'>
        <p className='font-medium'>LLM 解读</p>
        <Badge
          variant={analysis.status === 'error' ? 'destructive' : 'secondary'}
        >
          {analysis.status}
        </Badge>
        {analysis.risk_level && (
          <Badge
            variant={analysis.risk_level === 'high' ? 'destructive' : 'outline'}
          >
            {analysis.risk_level}
          </Badge>
        )}
      </div>
      {analysis.summary && (
        <p className='text-muted-foreground'>{analysis.summary}</p>
      )}
      {analysis.behavior_anomalies && (
        <BehaviorAnomaliesBlock anomalies={analysis.behavior_anomalies} />
      )}
      {analysis.key_factors?.length ? (
        <AnalysisList title='关键因素' items={analysis.key_factors} />
      ) : null}
      {analysis.content_signals?.length ? (
        <AnalysisList title='内容信号' items={analysis.content_signals} />
      ) : null}
      {analysis.recommendations?.length ? (
        <AnalysisList title='建议' items={analysis.recommendations} />
      ) : null}
    </div>
  )
}

const BEHAVIOR_LABELS = {
  like_behavior: '点赞行为',
  posting_behavior: '发帖行为',
  follow_behavior: '关注行为',
  profile_behavior: '资料行为',
  comment_behavior: '评论行为',
} as const

function BehaviorAnomaliesBlock({
  anomalies,
}: {
  anomalies: NonNullable<BotDetectionSingleResult['analysis']>['behavior_anomalies']
}) {
  if (!anomalies) return null

  const entries = Object.entries(BEHAVIOR_LABELS)
    .map(([key, label]) => ({
      key,
      label,
      items: anomalies[key as keyof typeof BEHAVIOR_LABELS] ?? [],
    }))
    .filter(({ items }) => items.length > 0)

  if (!entries.length) return null

  return (
    <div className='space-y-2'>
      <p className='text-muted-foreground'>异常行为分析</p>
      <div className='grid gap-3 md:grid-cols-2'>
        {entries.map(({ key, label, items }) => (
          <div key={key} className='rounded-md border p-3'>
            <p className='font-medium'>{label}</p>
            <ul className='mt-2 list-disc space-y-1 ps-5 text-muted-foreground'>
              {items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function AnalysisList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className='text-muted-foreground'>{title}</p>
      <ul className='mt-1 list-disc space-y-1 ps-5'>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}

function FakeNewsResultSection({
  result,
}: {
  result: ModuleResult<DetectBatchResponse>
}) {
  const rows = result.status === 'success' ? result.data.results : []
  const summary = result.status === 'success' ? result.data.summary : undefined

  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>谣言检测结果</CardTitle>
      </CardHeader>
      <CardContent className='max-h-[500px] space-y-4 overflow-y-auto text-sm'>
        {result.status === 'error' ? (
          <ErrorBlock message={result.error} />
        ) : (
          <>
            <div className='flex flex-wrap gap-3 text-muted-foreground'>
              <span>总数：{summary?.total ?? rows.length}</span>
              <span>
                成功：
                {summary?.success ?? rows.filter((item) => item.success).length}
              </span>
              <span>
                失败：
                {summary?.error ?? rows.filter((item) => !item.success).length}
              </span>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>样本</TableHead>
                  <TableHead>结果</TableHead>
                  <TableHead>置信度</TableHead>
                  <TableHead>非谣言概率</TableHead>
                  <TableHead>谣言概率</TableHead>
                  <TableHead>状态</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((item) => (
                  <TableRow key={item.index}>
                    <TableCell>{item.index + 1}</TableCell>
                    <TableCell>
                      {formatRumorLabel(item.label, item.predicted_class)}
                    </TableCell>
                    <TableCell>
                      {item.confidence === undefined
                        ? '—'
                        : `${(item.confidence * 100).toFixed(1)}%`}
                    </TableCell>
                    <TableCell>
                      {item.probabilities
                        ? `${(item.probabilities.real * 100).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {item.probabilities
                        ? `${(item.probabilities.fake * 100).toFixed(1)}%`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {item.success ? '成功' : `失败：${item.error ?? '未知错误'}`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </CardContent>
    </Card>
  )
}

function TextSourceResultSection({
  result,
}: {
  result: ModuleResult<TextSourceSampleResult[]>
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-base'>文本溯源检测结果</CardTitle>
      </CardHeader>
      <CardContent className='max-h-[1000px] space-y-4 overflow-y-auto text-sm'>
        {result.status === 'error' ? (
          <ErrorBlock message={result.error} />
        ) : (
          <div className='space-y-4'>
            {result.data.map((item) => {
              const humanPercent = item.detect
                ? normalizeProbability(item.detect.preds[0])
                : 0
              const machinePercent = item.detect
                ? normalizeProbability(item.detect.preds[1])
                : 0

              return (
                <div key={item.index} className='rounded-md border p-4'>
                  <div className='mb-3 flex flex-wrap items-center justify-between gap-3'>
                    <p className='font-medium'>样本 {item.index + 1}</p>
                    {item.error ? (
                      <Badge variant='destructive'>失败</Badge>
                    ) : (
                      <Badge variant='secondary'>完成</Badge>
                    )}
                  </div>

                  {item.error ? (
                    <p className='text-destructive'>{item.error}</p>
                  ) : (
                    <div className='space-y-3'>
                      <p className='line-clamp-2 text-muted-foreground'>
                        {item.text}
                      </p>
                      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                        <div className='rounded-md border p-3'>
                          <p className='text-muted-foreground'>判定标签</p>
                          <p className='mt-1 font-semibold'>
                            {item.detect?.jud ?? '—'}
                          </p>
                        </div>
                        <div className='rounded-md border p-3'>
                          <p className='text-muted-foreground'>最终溯源</p>
                          <p className='mt-1 font-semibold'>
                            {item.source?.model_name ?? '—'}
                          </p>
                        </div>
                        <div className='rounded-md border p-3'>
                          <p className='text-muted-foreground'>human</p>
                          <p className='mt-1'>{humanPercent.toFixed(2)}%</p>
                        </div>
                        <div className='rounded-md border p-3'>
                          <p className='text-muted-foreground'>machine</p>
                          <p className='mt-1'>{machinePercent.toFixed(2)}%</p>
                        </div>
                      </div>

                      {item.source?.model_list.length ? (
                        <div className='rounded-md border p-3'>
                          <p className='mb-2 text-muted-foreground'>候选模型</p>
                          <p className='break-words'>
                            {item.source.model_list.join('、')}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
