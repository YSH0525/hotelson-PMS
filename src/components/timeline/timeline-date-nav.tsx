'use client'

import { useTimelineStore } from '@/stores/use-timeline-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, ChevronRight, CalendarDays, Eye, EyeOff, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { TimelineCheckinPopover } from './timeline-checkin-popover'

export function TimelineDateNav() {
  const { startDate, goToPrevMonth, goToNextMonth, goToToday, hidePastDays, toggleHidePastDays, searchQuery, setSearchQuery } = useTimelineStore()

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

      <div className="ml-auto flex items-center gap-2">
        {/* 예약자 검색 */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="예약자 검색"
            className="pl-8 pr-8 h-8 w-[160px]"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* 당일 체크인 */}
        <TimelineCheckinPopover />

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
