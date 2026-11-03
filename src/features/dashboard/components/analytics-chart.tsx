'use client'

import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const data = [
  {
    name: 'Mon',
    clicks: 640,
    uniques: 420,
  },
  {
    name: 'Tue',
    clicks: 820,
    uniques: 560,
  },
  {
    name: 'Wed',
    clicks: 510,
    uniques: 350,
  },
  {
    name: 'Thu',
    clicks: 760,
    uniques: 490,
  },
  {
    name: 'Fri',
    clicks: 930,
    uniques: 670,
  },
  {
    name: 'Sat',
    clicks: 580,
    uniques: 380,
  },
  {
    name: 'Sun',
    clicks: 710,
    uniques: 460,
  },
]

export function AnalyticsChart() {
  return (
    <ResponsiveContainer width='100%' height={300}>
      <AreaChart data={data}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <Area
          type='monotone'
          dataKey='clicks'
          stroke='currentColor'
          className='text-primary'
          fill='currentColor'
          fillOpacity={0.15}
        />
        <Area
          type='monotone'
          dataKey='uniques'
          stroke='currentColor'
          className='text-muted-foreground'
          fill='currentColor'
          fillOpacity={0.1}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
