'use client'
import { useAuth } from '@/context/auth-provider'
import { SidebarMenu, SidebarMenuItem } from '@/components/ui/sidebar'
import { ProfileDropdown } from '@/components/profile-dropdown'

export function NavUser(_props: {
  user?: { name: string; email: string; avatar: string }
}) {
  const { user } = useAuth()
  return (
    <SidebarMenu>
      <SidebarMenuItem className='flex items-center gap-3 px-2 py-2'>
        <ProfileDropdown />
        <div className='truncate text-sm'>
          <p>{user?.username}</p>
          <p className='text-xs text-muted-foreground'>
            {user?.role === 'admin' ? '管理员' : '用户'}
          </p>
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
