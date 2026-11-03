'use client'

import { useState } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import type { PublicUser } from '@/lib/auth-schema'
import { useAuth } from '@/context/auth-provider'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

export function UsersDeleteDialog({
  user,
  onClose,
  onSaved,
}: {
  user: PublicUser
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { user: current } = useAuth()
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    if (busy || value !== user.username) return
    setBusy(true)
    setError('')
    try {
      await axios.delete(`/api/users/${user.id}`)
      toast.success('用户已删除')
      if (current?.id === user.id) {
        window.location.replace('/sign-in')
        return
      }
      await onSaved()
      onClose()
    } catch (cause) {
      setError(
        axios.isAxiosError(cause)
          ? cause.response?.data?.error || '删除失败'
          : '删除失败'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      handleConfirm={remove}
      disabled={busy || value !== user.username}
      title='删除用户'
      cancelBtnText='取消'
      isLoading={busy}
      desc={
        <div className='space-y-4'>
          <p>
            删除后账号及其登录会话将被移除。输入用户名{' '}
            <strong>{user.username}</strong> 确认。
          </p>
          <Label htmlFor='delete-username'>用户名</Label>
          <Input
            id='delete-username'
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoComplete='off'
          />
          {error && (
            <p role='alert' className='text-destructive'>
              {error}
            </p>
          )}
        </div>
      }
      confirmText={busy ? '删除中…' : '删除'}
      destructive
    />
  )
}
