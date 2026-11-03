'use client'

import { useState } from 'react'
import axios from 'axios'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { PublicUser } from '@/lib/auth-schema'
import { Button } from '@/components/ui/button'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { UsersActionDialog } from './components/users-action-dialog'
import { UsersDeleteDialog } from './components/users-delete-dialog'
import { UsersTable } from './components/users-table'

export function Users() {
  const client = useQueryClient()
  const [editing, setEditing] = useState<PublicUser | 'new' | null>(null)
  const [deleting, setDeleting] = useState<PublicUser | null>(null)
  const query = useQuery({
    queryKey: ['users'],
    queryFn: async () =>
      (await axios.get<{ users: PublicUser[] }>('/api/users')).data.users,
  })
  async function refresh() {
    await client.invalidateQueries({ queryKey: ['users'] })
  }
  return (
    <>
      <Header fixed>
        <Search />
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ConfigDrawer />
          <ProfileDropdown />
        </div>
      </Header>
      <Main className='flex flex-1 flex-col gap-4 sm:gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-2'>
          <div>
            <h2 className='text-2xl font-bold tracking-tight'>用户管理</h2>
            <p className='text-muted-foreground'>管理账号、角色和登录权限。</p>
          </div>
          <Button onClick={() => setEditing('new')}>创建用户</Button>
        </div>
        {query.isPending ? (
          <p role='status'>正在加载用户…</p>
        ) : query.isError ? (
          <div role='alert'>
            <p>无法加载用户列表。</p>
            <Button variant='outline' onClick={() => query.refetch()}>
              重试
            </Button>
          </div>
        ) : (
          <UsersTable
            data={query.data}
            onEdit={setEditing}
            onDelete={setDeleting}
          />
        )}
      </Main>
      {editing && (
        <UsersActionDialog
          key={editing === 'new' ? 'new' : editing.id}
          currentRow={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {deleting && (
        <UsersDeleteDialog
          user={deleting}
          onClose={() => setDeleting(null)}
          onSaved={refresh}
        />
      )}
    </>
  )
}
