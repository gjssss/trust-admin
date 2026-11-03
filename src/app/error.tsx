'use client'
import { Button } from '@/components/ui/button'

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className='flex min-h-svh flex-col items-center justify-center gap-4'>
      <h1 className='text-2xl font-semibold'>页面暂时无法加载</h1>
      <p>请稍后重试，或联系管理员检查服务状态。</p>
      <Button onClick={reset}>重试</Button>
    </main>
  )
}
