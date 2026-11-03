'use client'

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const data = [
  {
    name: 'Jan',
    total: 4200,
  },
  {
    name: 'Feb',
    total: 3100,
  },
  {
    name: 'Mar',
    total: 5400,
  },
  {
    name: 'Apr',
    total: 2800,
  },
  {
    name: 'May',
    total: 4600,
  },
  {
    name: 'Jun',
    total: 3900,
  },
  {
    name: 'Jul',
    total: 5800,
  },
  {
    name: 'Aug',
    total: 3400,
  },
  {
    name: 'Sep',
    total: 4900,
  },
  {
    name: 'Oct',
    total: 2600,
  },
  {
    name: 'Nov',
    total: 4400,
  },
  {
    name: 'Dec',
    total: 5100,
  },
]

export function Overview() {
  return (
    <ResponsiveContainer width='100%' height={350}>
      <BarChart data={data}>
        <XAxis
          dataKey='name'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          direction='ltr'
          stroke='#888888'
          fontSize={12}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => `$${value}`}
        />
        <Bar
          dataKey='total'
          fill='currentColor'
          radius={[4, 4, 0, 0]}
          className='fill-primary'
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
