'use client'

import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type ContentSectionProps = {
  title: string
  desc: string
  titleRight?: React.ReactNode
  contentClassName?: string
  children: React.JSX.Element
}

export function ContentSection({
  title,
  desc,
  titleRight,
  contentClassName,
  children,
}: ContentSectionProps) {
  return (
    <div className='flex flex-1 flex-col'>
      <div className='flex-none'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h3 className='text-lg font-medium'>{title}</h3>
            <p className='text-sm text-muted-foreground'>{desc}</p>
          </div>
          {titleRight ? <div className='shrink-0'>{titleRight}</div> : null}
        </div>
      </div>
      <Separator className='my-4 flex-none' />
      <div className='faded-bottom h-full w-full overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className={cn('-mx-1 px-1.5 lg:max-w-xl', contentClassName)}>
          {children}
        </div>
      </div>
    </div>
  )
}
