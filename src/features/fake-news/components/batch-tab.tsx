'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  type PaginationState,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { Loader2, Plus, Trash2, UploadCloud } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/data-table'
import { detectBatch } from '../api'
import type { DetectBatchResponse, DetectBatchResult } from '../api/types'

const createId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`

const formatRumorLabel = (label?: string, predictedClass?: number) => {
  if (predictedClass === 0) return '非谣言'
  if (predictedClass === 1) return '谣言'

  const value = label?.trim()
  if (!value) return '—'
  return value
    .replace(/虚假新闻|假新闻|虚假/g, '谣言')
    .replace(/真实新闻|真实/g, '非谣言')
}

const parseCsv = (text: string) => {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => {
    row.push(field)
    field = ''
  }
  const pushRow = () => {
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (inQuotes) {
      if (char === '"') {
        if (next === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      continue
    }

    if (char === ',') {
      pushField()
      continue
    }

    if (char === '\n') {
      pushField()
      pushRow()
      continue
    }

    if (char === '\r') {
      if (next === '\n') i += 1
      pushField()
      pushRow()
      continue
    }

    field += char
  }

  pushField()
  if (row.length > 1 || row[0]?.length) pushRow()
  return rows
}

type BatchItem = {
  id: string
  text: string
  imagePath?: string
}

type BatchTabProps = {
  modelLoaded: boolean
}

const getLastPageIndex = (total: number, pageSize: number) => {
  if (total <= 0) return 0
  return Math.max(0, Math.ceil(total / pageSize) - 1)
}

export function BatchTab({ modelLoaded }: BatchTabProps) {
  const [items, setItems] = useState<BatchItem[]>([])
  const [draftText, setDraftText] = useState('')
  const [draftImagePath, setDraftImagePath] = useState('')
  const [result, setResult] = useState<DetectBatchResponse | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [importingCsv, setImportingCsv] = useState(false)
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [resultPagination, setResultPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })

  const batchMutation = useMutation({
    mutationFn: detectBatch,
  })

  const handleAddItem = () => {
    if (!draftText.trim() && !draftImagePath.trim()) {
      toast.error('请输入文本或填写图片路径')
      return
    }
    const newItem: BatchItem = {
      id: createId(),
      text: draftText.trim(),
      imagePath: draftImagePath.trim() || undefined,
    }
    setItems((prev) => {
      const next = [...prev, newItem]
      setPagination((current) => ({
        ...current,
        pageIndex: getLastPageIndex(next.length, current.pageSize),
      }))
      return next
    })
    setDraftText('')
    setDraftImagePath('')
  }

  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id)
      setPagination((current) => ({
        ...current,
        pageIndex: Math.min(
          current.pageIndex,
          getLastPageIndex(next.length, current.pageSize)
        ),
      }))
      return next
    })
  }, [])

  const handleUploadCsv = async (file: File) => {
    const lowerName = file.name.toLowerCase()
    const looksLikeCsv =
      lowerName.endsWith('.csv') || file.type === 'text/csv' || !file.type
    if (!looksLikeCsv) {
      toast.error('请选择 CSV 文件')
      return
    }

    setImportingCsv(true)
    try {
      const raw = await file.text()
      const normalized = raw.replace(/^\uFEFF/, '')
      const rows = parseCsv(normalized).filter((row) =>
        row.some((cell) => cell.trim() !== '')
      )
      if (rows.length < 2) {
        toast.error('CSV 内容为空或无数据行')
        return
      }

      const headers = rows[0].map((header) => header.trim().toLowerCase())
      const contentIndex = headers.indexOf('content')
      const imageIndex = headers.indexOf('image')

      if (contentIndex === -1) {
        toast.error('CSV 缺少 content 字段')
        return
      }

      const imported: BatchItem[] = []
      for (let i = 1; i < rows.length; i += 1) {
        const dataRow = rows[i]
        const content = (dataRow[contentIndex] ?? '').trim()
        if (!content) {
          toast.error(`CSV 第 ${i + 1} 行缺少 content`)
          return
        }

        const imageValue =
          imageIndex === -1 ? '' : (dataRow[imageIndex] ?? '').trim()

        imported.push({
          id: createId(),
          text: content,
          imagePath: imageIndex === -1 || !imageValue ? undefined : imageValue,
        })
      }

      setItems(imported)
      setPagination((current) => ({ ...current, pageIndex: 0 }))
      setResult(null)
      toast.success(`已导入 ${imported.length} 条批量样本`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'CSV 解析失败')
    } finally {
      setImportingCsv(false)
    }
  }

  const columns = useMemo<ColumnDef<BatchItem>[]>(
    () => [
      {
        accessorKey: 'text',
        header: '文本',
        cell: ({ getValue }) => {
          const value = (getValue<string>() ?? '').trim()
          return (
            <div className='max-w-[240px] truncate'>{value ? value : '—'}</div>
          )
        },
        meta: { thClassName: 'w-[50%]' },
      },
      {
        accessorKey: 'imagePath',
        header: '图片路径',
        cell: ({ getValue }) => {
          const value = (getValue<string | undefined>() ?? '').trim()
          return (
            <div className='max-w-[240px] truncate'>{value ? value : '—'}</div>
          )
        },
      },
      {
        id: 'actions',
        header: '操作',
        cell: ({ row }) => (
          <Button
            type='button'
            variant='ghost'
            size='sm'
            onClick={() => handleRemoveItem(row.original.id)}
          >
            <Trash2 className='size-4' />
          </Button>
        ),
        meta: { thClassName: 'w-[80px]' },
      },
    ],
    [handleRemoveItem]
  )

  const table = useReactTable({
    data: items,
    columns,
    state: { pagination },
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  useEffect(() => {
    setPagination((current) => ({
      ...current,
      pageIndex: Math.min(
        items.length === 0 ? 0 : current.pageIndex,
        getLastPageIndex(items.length, current.pageSize)
      ),
    }))
  }, [items.length, pagination.pageSize])

  const handleDetect = async () => {
    if (!modelLoaded) {
      toast.error('请先加载模型')
      return
    }
    if (items.length === 0) {
      toast.error('请先添加批量样本')
      return
    }

    try {
      const response = await batchMutation.mutateAsync({
        items: items.map((item) => {
          const payload: { text?: string; image_path?: string } = {}
          if (item.text) payload.text = item.text
          if (item.imagePath) payload.image_path = item.imagePath
          return payload
        }),
      })
      if (!response.success) {
        toast.error(response.message ?? '批量检测失败')
        return
      }
      setResult(response)
      setResultPagination((current) => ({ ...current, pageIndex: 0 }))
      toast.success('批量检测完成')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '批量检测失败')
    }
  }

  const resultRows = useMemo(() => {
    return result?.results ?? []
  }, [result?.results])

  const resultColumns = useMemo<ColumnDef<DetectBatchResult>[]>(
    () => [
      {
        accessorKey: 'index',
        header: '索引',
        meta: { thClassName: 'w-[80px]' },
      },
      {
        accessorKey: 'label',
        header: '结果',
        cell: ({ row }) =>
          formatRumorLabel(row.original.label, row.original.predicted_class),
      },
      {
        accessorKey: 'confidence',
        header: '置信度',
        cell: ({ getValue }) => {
          const value = getValue<number | undefined>()
          return value !== undefined ? `${(value * 100).toFixed(1)}%` : '—'
        },
      },
      {
        accessorKey: 'success',
        header: '状态',
        cell: ({ row }) =>
          row.original.success
            ? '成功'
            : `失败：${row.original.error ?? '未知错误'}`,
      },
    ],
    []
  )

  const resultsTable = useReactTable({
    data: resultRows,
    columns: resultColumns,
    state: { pagination: resultPagination },
    onPaginationChange: setResultPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  useEffect(() => {
    setResultPagination((current) => ({
      ...current,
      pageIndex: Math.min(
        resultRows.length === 0 ? 0 : current.pageIndex,
        getLastPageIndex(resultRows.length, current.pageSize)
      ),
    }))
  }, [resultRows.length, resultPagination.pageSize])

  const resultStats = useMemo(() => {
    const total = result?.summary?.total ?? resultRows.length
    const success =
      result?.summary?.success ?? resultRows.filter((item) => item.success).length
    const error =
      result?.summary?.error ??
      Math.max(0, total - success)

    const successRate = total > 0 ? success / total : 0
    return { total, success, error, successRate }
  }, [result?.summary?.error, result?.summary?.success, result?.summary?.total, resultRows])

  const successFailData = useMemo(
    () => [
      { name: '成功', value: resultStats.success },
      { name: '失败', value: resultStats.error },
    ],
    [resultStats.error, resultStats.success]
  )

  const resultClassData = useMemo(() => {
    let real = 0
    let fake = 0
    let unknown = 0

    for (const item of resultRows) {
      if (!item.success) continue

      if (item.predicted_class === 0) {
        real += 1
        continue
      }
      if (item.predicted_class === 1) {
        fake += 1
        continue
      }

      const label = (item.label ?? '').trim()
      if (label.includes('真实') || label.includes('非谣言')) {
        real += 1
        continue
      }
      if (label.includes('虚假') || label.includes('谣言')) {
        fake += 1
        continue
      }

      unknown += 1
    }

    const data = [
      { name: '非谣言', value: real },
      { name: '谣言', value: fake },
    ]
    if (unknown > 0) data.push({ name: '未知', value: unknown })
    return data
  }, [resultRows])

  const confidenceData = useMemo(() => {
    return resultRows.map((item) => ({
      name: String(item.index),
      confidence:
        item.confidence === undefined
          ? undefined
          : Math.round(item.confidence * 1000) / 10,
    }))
  }, [resultRows])

  const confidenceTickInterval = useMemo(() => {
    if (confidenceData.length <= 20) return 0
    return Math.floor(confidenceData.length / 20)
  }, [confidenceData.length])

  const confidenceBarSize = useMemo(() => {
    const count = confidenceData.length
    if (count <= 30) return 12
    if (count <= 80) return 8
    if (count <= 160) return 5
    if (count <= 320) return 3
    if (count <= 600) return 2
    return 1
  }, [confidenceData.length])

  const showConfidenceTicks = confidenceData.length <= 60

  return (
    <div className='space-y-6'>
      <Card>
        <CardHeader>
          <CardTitle className='text-base'>批量检测</CardTitle>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 lg:grid-cols-[1.2fr_1fr_auto]'>
            <Input
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder='输入文本（可选）'
            />
            <div className='flex gap-2'>
              <Input
                value={draftImagePath}
                onChange={(event) => setDraftImagePath(event.target.value)}
                placeholder='图片路径（可选）'
              />
              <Button
                type='button'
                variant='outline'
                title='导入 CSV'
                onClick={() => fileInputRef.current?.click()}
                disabled={importingCsv}
              >
                {importingCsv ? (
                  <Loader2 className='size-4 animate-spin' />
                ) : (
                  <UploadCloud className='size-4' />
                )}
              </Button>
              <input
                ref={fileInputRef}
                type='file'
                accept='.csv,text/csv'
                className='hidden'
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void handleUploadCsv(file)
                  event.target.value = ''
                }}
              />
            </div>
            <Button type='button' onClick={handleAddItem}>
              <Plus className='size-4' />添加
            </Button>
          </div>

          <div className='rounded-md border'>
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead
                        key={header.id}
                        colSpan={header.colSpan}
                        className={header.column.columnDef.meta?.thClassName}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(
                              header.column.columnDef.header,
                              header.getContext()
                            )}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className='text-center text-muted-foreground'
                    >
                      暂无批量样本
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {items.length > 0 && <DataTablePagination table={table} />}

          {!modelLoaded && (
            <p className='text-xs text-destructive'>
              当前模型未加载，批量检测将被禁用
            </p>
          )}

          <Button
            type='button'
            className='w-full'
            onClick={handleDetect}
            disabled={batchMutation.isPending || items.length === 0 || !modelLoaded}
          >
            {batchMutation.isPending ? (
              <span className='inline-flex items-center gap-2'>
                <Loader2 className='size-4 animate-spin' />
                检测中
              </span>
            ) : (
              '开始批量检测'
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className='text-base'>批量检测结果</CardTitle>
          </CardHeader>
          <CardContent className='space-y-3 text-sm'>
            {result.summary && (
              <div className='flex flex-wrap gap-4 text-muted-foreground'>
                <span>总数：{result.summary.total}</span>
                <span>成功：{result.summary.success}</span>
                <span>失败：{result.summary.error}</span>
              </div>
            )}

            <div className='grid gap-4 lg:grid-cols-2'>
              <Card>
                <CardHeader>
                  <CardTitle className='text-sm'>任务成功率</CardTitle>
                </CardHeader>
                <CardContent className='h-[280px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={successFailData}
                        dataKey='value'
                        nameKey='name'
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        <Cell fill='#22c55e' />
                        <Cell fill='#ef4444' />
                      </Pie>
                      <Tooltip />
                      <Legend />
                      <text
                        x='50%'
                        y='50%'
                        textAnchor='middle'
                        dominantBaseline='middle'
                        className='fill-foreground text-base font-semibold'
                      >
                        {(resultStats.successRate * 100).toFixed(1)}%
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className='text-sm'>结果分类</CardTitle>
                </CardHeader>
                <CardContent className='h-[280px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <PieChart>
                      <Pie
                        data={resultClassData}
                        dataKey='value'
                        nameKey='name'
                        outerRadius={90}
                        paddingAngle={2}
                      >
                        <Cell fill='#22c55e' />
                        <Cell fill='#f97316' />
                        {resultClassData.length > 2 && <Cell fill='#94a3b8' />}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card className='lg:col-span-2'>
                <CardHeader>
                  <CardTitle className='text-sm'>置信度柱状图</CardTitle>
                </CardHeader>
                <CardContent className='h-[280px]'>
                  <ResponsiveContainer width='100%' height='100%'>
                    <BarChart
                      data={confidenceData}
                      barCategoryGap={1}
                      barGap={0}
                      margin={{ left: 0, right: 0 }}
                    >
                      <CartesianGrid vertical={false} strokeDasharray='3 3' />
                      <XAxis
                        dataKey='name'
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        interval={confidenceTickInterval}
                        tick={showConfidenceTicks}
                      />
                      <YAxis
                        domain={[0, 100]}
                        stroke='#888888'
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value) => `${value}%`}
                      />
                      <Tooltip
                        formatter={(value) =>
                          value === undefined || value === null
                            ? '—'
                            : `${value}%`
                        }
                        labelFormatter={(label) => `索引 ${label}`}
                      />
                      <Bar
                        dataKey='confidence'
                        barSize={confidenceBarSize}
                        minPointSize={1}
                        radius={[4, 4, 0, 0]}
                        className='fill-primary'
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className='rounded-md border'>
              <Table>
                <TableHeader>
                  {resultsTable.getHeaderGroups().map((headerGroup) => (
                    <TableRow key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <TableHead
                          key={header.id}
                          colSpan={header.colSpan}
                          className={header.column.columnDef.meta?.thClassName}
                        >
                          {header.isPlaceholder
                            ? null
                            : flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                        </TableHead>
                      ))}
                    </TableRow>
                  ))}
                </TableHeader>
                <TableBody>
                  {resultsTable.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <DataTablePagination table={resultsTable} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
