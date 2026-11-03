'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-provider'
import type { DetectionResult, LlmAnalysis } from '../api/types'

export type HistoryItem = {
  id: string
  timestamp: string
  text: string
  image?: string | null
  result: DetectionResult
  llmAnalysis?: LlmAnalysis | null
}

export type HistoryItemInput = Omit<HistoryItem, 'id' | 'timestamp'>

const STORAGE_KEY = 'fakeNewsDetectionHistory'
const EMPTY_HISTORY: HistoryItem[] = []

function readHistory(key: string): HistoryItem[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is HistoryItem =>
            item &&
            typeof item.id === 'string' &&
            typeof item.timestamp === 'string' &&
            typeof item.text === 'string' &&
            item.result &&
            typeof item.result.confidence === 'number' &&
            (item.result.predicted_class === 0 ||
              item.result.predicted_class === 1)
        )
      : []
  } catch {
    return []
  }
}

export function useFakeNewsHistory() {
  const { user } = useAuth()
  const storageKey = user ? `${STORAGE_KEY}:${user.id}` : null
  const [history, setHistory] = useState<{
    key: string | null
    items: HistoryItem[]
  }>({ key: null, items: [] })
  const currentHistory = useRef(history)

  useEffect(() => {
    const next = {
      key: storageKey,
      items: storageKey ? readHistory(storageKey) : [],
    }
    currentHistory.current = next
    setHistory(next)
  }, [storageKey])

  const update = useCallback(
    (change: (items: HistoryItem[]) => HistoryItem[]) => {
      if (!storageKey) return
      const previous =
        currentHistory.current.key === storageKey
          ? currentHistory.current.items
          : readHistory(storageKey)
      const next = { key: storageKey, items: change(previous) }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next.items))
      } catch {
        toast.error('历史记录保存失败，请检查浏览器存储空间或隐私设置。')
      }
      if (currentHistory.current.key === storageKey) {
        currentHistory.current = next
        setHistory(next)
      }
    },
    [storageKey]
  )

  const addItem = useCallback(
    (input: HistoryItemInput) => {
      const item: HistoryItem = {
        ...input,
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        timestamp: new Date().toISOString(),
      }
      update((previous) => [item, ...previous])
      return item
    },
    [update]
  )

  const removeItem = useCallback(
    (id: string) => {
      update((previous) => previous.filter((item) => item.id !== id))
    },
    [update]
  )

  const clear = useCallback(() => update(() => []), [update])
  const items = history.key === storageKey ? history.items : EMPTY_HISTORY

  const stats = useMemo(() => {
    const total = items.length
    const real = items.filter(
      (item) => item.result.predicted_class === 0
    ).length
    const fake = total - real
    const avgConfidence =
      total === 0
        ? 0
        : items.reduce((sum, item) => sum + item.result.confidence, 0) / total
    return { total, real, fake, avgConfidence }
  }, [items])

  return { items, stats, addItem, removeItem, clear }
}
