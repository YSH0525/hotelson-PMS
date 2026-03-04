'use client'

import { isWeekend } from '@/lib/date-utils'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { TIMELINE_ROOM_LIST_WIDTH } from '@/lib/constants'
import type { DayLayout } from '@/hooks/use-timeline-layout'

interface TimelineHeaderProps {
  days: DayLayout[]
  occupancyByDate?: Record<string, number>
}

export function TimelineHeader({ days, occupancyByDate = {} }: TimelineHeaderProps) {
  return (
    <div className="sticky top-0 z-20 bg-background border-b">
      {/* 날짜 행 */}
      <div className="flex">
        <div
          className="sticky left-0 z-30 bg-background border-r border-b flex items-center justify-center font-semibold text-sm"
          style={{ minWidth: TIMELINE_ROOM_LIST_WIDTH, width: TIMELINE_ROOM_LIST_WIDTH, height: 40 }}
        >
          객실
        </div>
        {days.map((dayLayout) => {
          const dayOfWeek = format(dayLayout.date, 'EEE', { locale: ko })
          const isWeekendDate = isWeekend(dayLayout.date)

          return (
            <div
              key={dayLayout.dateStr}
              className={cn(
                'flex flex-col items-center justify-center border-r border-b text-xs',
                dayLayout.isToday && 'bg-primary/10 font-bold',
                isWeekendDate && !dayLayout.isToday && 'bg-red-50 dark:bg-red-950/20',
              )}
              style={{ minWidth: dayLayout.width, width: dayLayout.width, height: 40 }}
            >
              <span className={cn(
                isWeekendDate && 'text-red-500',
                dayLayout.isToday && 'text-primary',
              )}>
                {format(dayLayout.date, 'd')}
              </span>
              <span className={cn(
                'text-[10px]',
                isWeekendDate ? 'text-red-400' : 'text-muted-foreground',
                dayLayout.isToday && 'text-primary',
              )}>
                {dayLayout.isToday ? '오늘' : dayOfWeek}
              </span>
            </div>
          )
        })}
      </div>

      {/* 점유율 행 */}
      <div className="flex">
        <div
          className="sticky left-0 z-30 bg-muted/50 border-r flex items-center justify-center text-xs text-muted-foreground font-medium"
          style={{ minWidth: TIMELINE_ROOM_LIST_WIDTH, width: TIMELINE_ROOM_LIST_WIDTH, height: 24 }}
        >
          점유율
        </div>
        {days.map((dayLayout) => {
          const occupancy = occupancyByDate[dayLayout.dateStr] ?? 0

          return (
            <div
              key={`occ-${dayLayout.dateStr}`}
              className={cn(
                'flex items-center justify-center border-r text-[10px] font-medium',
                occupancy >= 90 ? 'text-red-600 bg-red-50' :
                occupancy >= 70 ? 'text-orange-600 bg-orange-50' :
                occupancy >= 50 ? 'text-yellow-600 bg-yellow-50' :
                'text-muted-foreground bg-muted/50'
              )}
              style={{ minWidth: dayLayout.width, width: dayLayout.width, height: 24 }}
            >
              {occupancy > 0 ? `${occupancy}%` : '-'}
            </div>
          )
        })}
      </div>
    </div>
  )
}
