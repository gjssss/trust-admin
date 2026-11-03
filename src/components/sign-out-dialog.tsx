'use client'
import { useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/auth-provider'
import { ConfirmDialog } from '@/components/confirm-dialog'

export function SignOutDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { logout } = useAuth()
  const [busy, setBusy] = useState(false)
  async function handleSignOut() {
    if (busy) return
    setBusy(true)
    try {
      await logout()
    } catch {
      toast.error('退出失败，请重试')
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title='退出登录'
      cancelBtnText='取消'
      isLoading={busy}
      desc='退出后需要重新登录才能使用系统。'
      confirmText={busy ? '正在退出…' : '退出登录'}
      destructive
      handleConfirm={handleSignOut}
      className='sm:max-w-sm'
    />
  )
}
