'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import LoadingBar, { type LoadingBarRef } from 'react-top-loading-bar'

export function NavigationProgress() {
  const ref = useRef<LoadingBarRef>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    ref.current?.complete()
  }, [pathname, searchParams])

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined
    const start = () => {
      ref.current?.continuousStart()
      clearTimeout(timeout)
      timeout = setTimeout(() => ref.current?.complete(), 15000)
    }
    const onClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.download ||
        (anchor.target && anchor.target !== '_self') ||
        anchor.getAttribute('aria-disabled') === 'true'
      )
        return
      const url = new URL(anchor.href)
      if (
        url.origin === window.location.origin &&
        (url.pathname !== window.location.pathname ||
          url.search !== window.location.search)
      )
        start()
    }
    document.addEventListener('click', onClick, true)
    window.addEventListener('popstate', start)
    return () => {
      clearTimeout(timeout)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('popstate', start)
    }
  }, [])

  return (
    <LoadingBar
      color='var(--muted-foreground)'
      ref={ref}
      shadow={true}
      height={2}
    />
  )
}
