'use client'

import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { toast } from 'sonner'
import type { PublicUser } from '@/lib/auth-schema'
import { useAuth } from '@/context/auth-provider'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/password-input'

export function UsersActionDialog({
  currentRow,
  onClose,
  onSaved,
}: {
  currentRow?: PublicUser
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const password = String(form.get('password') ?? '')
    if (password !== String(form.get('confirmPassword') ?? '')) {
      setError('两次输入的密码不一致')
      return
    }
    const values = {
      username: String(form.get('username')),
      role: String(form.get('role')),
      enabled: form.get('enabled') === 'true',
      ...(password ? { password } : {}),
    }
    setBusy(true)
    setError('')
    try {
      if (currentRow) await axios.patch(`/api/users/${currentRow.id}`, values)
      else await axios.post('/api/users', values)
      toast.success(currentRow ? '用户已更新' : '用户已创建')
      if (
        currentRow &&
        currentRow.id === user?.id &&
        (password ||
          values.role !== currentRow.role ||
          values.enabled !== currentRow.enabled)
      ) {
        window.location.replace('/sign-in')
        return
      }
      await onSaved()
      onClose()
    } catch (cause) {
      setError(
        axios.isAxiosError(cause)
          ? cause.response?.data?.error || '保存失败，请重试'
          : '保存失败，请重试'
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{currentRow ? '编辑用户' : '创建用户'}</DialogTitle>
          <DialogDescription>
            {currentRow
              ? '可修改账号、角色和状态；填写新密码将重置密码。权限或密码变化后，原会话将失效。'
              : '使用用户名和密码创建账号。'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className='grid gap-4'>
          <div className='grid gap-2'>
            <Label htmlFor='edit-username'>用户名</Label>
            <Input
              id='edit-username'
              name='username'
              defaultValue={currentRow?.username ?? ''}
              required
              minLength={3}
              maxLength={64}
              autoComplete='off'
            />
            <p className='text-xs text-muted-foreground'>
              3–64 位字母、数字、下划线、点或短横线，以字母或数字开头。
            </p>
          </div>
          <div className='grid grid-cols-2 gap-4'>
            <div className='grid gap-2'>
              <Label htmlFor='edit-role'>角色</Label>
              <select
                id='edit-role'
                name='role'
                defaultValue={currentRow?.role ?? 'user'}
                className='h-9 rounded-md border bg-background px-3 text-sm'
              >
                <option value='user'>用户</option>
                <option value='admin'>管理员</option>
              </select>
            </div>
            <div className='grid gap-2'>
              <Label htmlFor='edit-enabled'>状态</Label>
              <select
                id='edit-enabled'
                name='enabled'
                defaultValue={String(currentRow?.enabled ?? true)}
                className='h-9 rounded-md border bg-background px-3 text-sm'
              >
                <option value='true'>启用</option>
                <option value='false'>禁用</option>
              </select>
            </div>
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='edit-password'>
              {currentRow ? '新密码（留空不修改）' : '密码'}
            </Label>
            <PasswordInput
              id='edit-password'
              name='password'
              autoComplete='new-password'
              required={!currentRow}
              minLength={8}
              maxLength={128}
            />
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='edit-confirm'>确认密码</Label>
            <PasswordInput
              id='edit-confirm'
              name='confirmPassword'
              autoComplete='new-password'
              required={!currentRow}
              maxLength={128}
            />
          </div>
          {error && (
            <p role='alert' className='text-sm text-destructive'>
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              disabled={busy}
              onClick={onClose}
            >
              取消
            </Button>
            <Button type='submit' disabled={busy}>
              {busy ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
