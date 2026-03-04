'use client'

import { cn } from '@/lib/utils'
import { TIMELINE_CELL_WIDTH, TIMELINE_ROOM_LIST_WIDTH } from '@/lib/constants'
import { getDaysInRange } from '@/lib/date-utils'
import { format } from 'date-fns'

interface TimelineOccupancyRowProps {
  startDate: Date
  daysToShow: number
  occupancyByDate: Record<string, number>
}

export function TimelineOccupancyRow({ startDate, daysToShow, occupancyByDate }: TimelineOccupancyRowProps) {
  const days = getDaysInRange(startDate, daysToShow)

  return (
    <div className="flex border-b">
      <div
        className="sticky left-0 z-20 bg-muted/50 border-r flex items-center justify-center text-xs text-muted-foreground font-medium"
        style={{ minWidth: TIMELINE_ROOM_LIST_WIDTH, width: TIMELINE_ROOM_LIST_WIDTH, height: 24 }}
      >
        점유율
      </div>
      {days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const occupancy = occupancyByDate[dateStr] ?? 0

        return (
          <div
            key={dateStr}
            className={cn(
              'flex items-center justify-center border-r text-[10px] font-medium',
              occupancy >= 90 ? 'text-red-600 bg-red-50' :
              occupancy >= 70 ? 'text-orange-600 bg-orange-50' :
              occupancy >= 50 ? 'text-yellow-600 bg-yellow-50' :
              'text-muted-foreground bg-muted/50'
            )}
            style={{ minWidth: TIMELINE_CELL_WIDTH, width: TIMELINE_CELL_WIDTH, height: 24 }}
          >
            {occupancy > 0 ? `${occupancy}%` : '-'}
          </div>
        )
      })}
    </div>
  )
}
