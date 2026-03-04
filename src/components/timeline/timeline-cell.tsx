'use client'

import { memo } from 'react'
import { cn } from '@/lib/utils'
import { TIMELINE_CELL_HEIGHT } from '@/lib/constants'
import { isToday, isWeekend, parseISO } from '@/lib/date-utils'
import { TimelineCellPopover } from './timeline-cell-popover'

interface TimelineCellProps {
  date: string
  roomId: string
  width: number
}

export const TimelineCell = memo(function TimelineCell({
  date,
  roomId,
  width,
}: TimelineCellProps) {
  const dateObj = parseISO(date)
  const today = isToday(dateObj)
  const weekend = isWeekend(dateObj)

  return (
    <TimelineCellPopover roomId={roomId} date={date}>
      <div
        className={cn(
          'border-r border-b cursor-pointer transition-colors hover:bg-accent/50',
          today && 'bg-primary/5',
          weekend && !today && 'bg-red-50/50 dark:bg-red-950/10',
        )}
        style={{ minWidth: width, width, height: TIMELINE_CELL_HEIGHT }}
      />
    </TimelineCellPopover>
  )
})
