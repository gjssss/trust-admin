'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/context/auth-provider'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { SignOutDialog } from '@/components/sign-out-dialog'

export function ProfileDropdown() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            variant='ghost'
            className='relative h-8 w-8 rounded-full'
            aria-label='账号菜单'
          >
            <Avatar className='h-8 w-8'>
              <AvatarFallback>
                {user?.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className='w-56' align='end'>
          <DropdownMenuLabel>
            <p>{user?.username}</p>
            <p className='text-xs font-normal text-muted-foreground'>
              {user?.role === 'admin' ? '管理员' : '用户'}
            </p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href='/settings'>设置</Link>
          </DropdownMenuItem>
          {user?.role === 'admin' && (
            <DropdownMenuItem asChild>
              <Link href='/users'>用户管理</Link>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={() => setOpen(true)}>
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <SignOutDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
