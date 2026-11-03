'use client'

import { useSearchParams } from 'next/navigation'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const search = useSearchParams()
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>登录</CardTitle>
          <CardDescription>输入用户名和密码，登录检测平台。</CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={search.get('redirect') ?? undefined} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
