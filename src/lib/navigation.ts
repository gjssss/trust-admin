'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'

type SearchRecord = Record<string, unknown>

export function parseSearchParams(params: URLSearchParams): SearchRecord {
  const result: SearchRecord = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    const value = values[0]
    if (values.length > 1) {
      result[key] = values
    } else if (value.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(value)
        result[key] = Array.isArray(parsed) ? parsed : value
      } catch {
        result[key] = value
      }
    } else {
      result[key] = value
    }
  }
  return result
}

export function useUrlSearch() {
  const params = useSearchParams()
  const search = useMemo(
    () => parseSearchParams(new URLSearchParams(params.toString())),
    [params]
  )

  const navigate = ({
    search: update,
    replace = false,
  }: {
    search: SearchRecord | ((previous: SearchRecord) => SearchRecord)
    replace?: boolean
  }) => {
    const url = new URL(window.location.href)
    const previous = parseSearchParams(url.searchParams)
    const next = typeof update === 'function' ? update(previous) : update
    url.search = ''
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === null || value === '') continue
      if (Array.isArray(value)) {
        if (value.length) url.searchParams.set(key, JSON.stringify(value))
      } else {
        url.searchParams.set(key, String(value))
      }
    }
    if (url.href === window.location.href) return
    // Next integrates native history updates with useSearchParams, including back/forward.
    window.history[replace ? 'replaceState' : 'pushState'](null, '', url.href)
  }

  return { search, navigate }
}
