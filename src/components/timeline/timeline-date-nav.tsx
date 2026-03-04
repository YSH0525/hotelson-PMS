'use client'

import { useTimelineStore } from '@/stores/use-timeline-store'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays, Eye, EyeOff } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function TimelineDateNav() {
  const { startDate, goToPrevMonth, goToNextMonth, goToToday, hidePastDays, toggleHidePastDays } = useTimelineStore()

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-background">
      <Button variant="outline" size="sm" onClick={goToToday}>
        <CalendarDays className="h-4 w-4 mr-1" />
        오늘
      </Button>
      <Button variant="ghost" size="icon" onClick={goToPrevMonth}>
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="font-semibold text-lg min-w-[140px] text-center">
        {format(startDate, 'yyyy년 M월', { locale: ko })}
      </span>
      <Button variant="ghost" size="icon" onClick={goToNextMonth}>
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="ml-auto">
        <Button
          variant={hidePastDays ? 'default' : 'outline'}
          size="sm"
          onClick={toggleHidePastDays}
        >
          {hidePastDays ? (
            <EyeOff className="h-4 w-4 mr-1" />
          ) : (
            <Eye className="h-4 w-4 mr-1" />
          )}
          {hidePastDays ? '과거 숨김' : '전체 표시'}
        </Button>
      </div>
    </div>
  )
}
