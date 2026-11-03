'use client'

import { useAuth } from '@/context/auth-provider'
import {
  Users,
  AudioWaveform,
  Bot,
  Command,
  Fingerprint,
  GalleryVerticalEnd,
  LayoutDashboard,
  Settings,
  ShieldCheck,
} from 'lucide-react'
import { type SidebarData } from '../types'

const sidebarData: SidebarData = {
  user: {
    name: 'satnaing',
    email: 'satnaingdev@gmail.com',
    avatar: '/avatars/shadcn.jpg',
  },
  teams: [
    {
      name: 'Shadcn Admin',
      logo: Command,
      plan: 'Vite + ShadcnUI',
    },
    {
      name: 'Acme Inc',
      logo: GalleryVerticalEnd,
      plan: 'Enterprise',
    },
    {
      name: 'Acme Corp.',
      logo: AudioWaveform,
      plan: 'Startup',
    },
  ],
  navGroups: [
    {
      title: '监测中心',
      items: [
        {
          title: '综合检测',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: '谣言检测',
          url: '/fake-news',
          icon: ShieldCheck,
        },
        {
          title: '机器人账号检测',
          url: '/bot-detection',
          icon: Bot,
        },
        {
          title: '文本溯源检测',
          url: '/text-source',
          icon: Fingerprint,
        },
      ],
    },
    {
      title: '系统',
      items: [
        {
          title: '设置',
          url: '/settings',
          icon: Settings,
        },
      ],
    },
  ],
}

export function useSidebarData(): SidebarData {
  const { user } = useAuth()
  return {
    ...sidebarData,
    user: { name: user?.username ?? '', email: user?.role === 'admin' ? '管理员' : '用户', avatar: '' },
    navGroups: sidebarData.navGroups.map((group) => group.title === '系统' && user?.role === 'admin'
      ? { ...group, items: [...group.items, { title: '用户管理', url: '/users', icon: Users }] }
      : group),
  }
}
