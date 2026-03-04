'use client'

import { useTimelineStore } from '@/stores/use-timeline-store'
import { TimelineHeader } from './timeline-header'
import { TimelineDateNav } from './timeline-date-nav'
import { TimelineGrid } from './timeline-grid'

export function TimelineContainer() {
  const { startDate, daysToShow } = useTimelineStore()

  return (
    <div className="flex flex-col h-full">
      <TimelineDateNav />
      <div className="flex-1 overflow-auto relative">
        <TimelineGrid startDate={startDate} daysToShow={daysToShow} />
      </div>
    </div>
  )
}
