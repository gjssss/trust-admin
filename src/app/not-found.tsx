import Link from 'next/link'

export default function NotFound() {
  return (
    <main className='flex min-h-svh flex-col items-center justify-center gap-4'>
      <h1 className='text-3xl font-bold'>404 · 页面不存在</h1>
      <Link className='underline' href='/'>
        返回首页
      </Link>
    </main>
  )
}
