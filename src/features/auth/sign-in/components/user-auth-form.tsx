'use client'

import { useState, type FormEvent } from 'react'
import { Loader2, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

export function UserAuthForm({ redirectTo }: { redirectTo?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: data.get('username'),
          password: data.get('password'),
        }),
      })
      const result = await response.json()
      if (!response.ok)
        throw new Error(result.error || result.message || '登录失败')
      const target =
        redirectTo &&
        redirectTo.startsWith('/') &&
        !redirectTo.startsWith('//') &&
        !redirectTo.includes('\\') &&
        ![...redirectTo].some((character) => character.charCodeAt(0) < 32)
          ? redirectTo
          : '/'
      window.location.replace(target)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '网络连接失败，请重试')
      setLoading(false)
    }
  }
  return (
    <form onSubmit={submit} className='grid gap-4'>
      <div className='grid gap-2'>
        <Label htmlFor='username'>用户名</Label>
        <Input
          id='username'
          name='username'
          autoComplete='username'
          autoFocus
          required
          maxLength={64}
        />
      </div>
      <div className='grid gap-2'>
        <Label htmlFor='password'>密码</Label>
        <PasswordInput
          id='password'
          name='password'
          autoComplete='current-password'
          required
          maxLength={128}
        />
      </div>
      {error && (
        <p role='alert' className='text-sm text-destructive'>
          {error}
        </p>
      )}
      <Button disabled={loading} type='submit'>
        {loading ? <Loader2 className='animate-spin' /> : <LogIn />}登录
      </Button>
      <p className='text-sm text-muted-foreground'>
        如需创建账号或重置密码，请联系管理员。
      </p>
    </form>
  )
}
