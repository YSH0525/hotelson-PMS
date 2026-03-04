'use client'

import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { formatKoreanDate } from '@/lib/date-utils'

interface HeaderProps {
  title: string
}

export function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />
      <h1 className="font-semibold text-lg">{title}</h1>
      <div className="ml-auto text-sm text-muted-foreground">
        {formatKoreanDate(new Date())}
      </div>
    </header>
  )
}
