'use client'

import { memo, useMemo } from 'react'
import { TIMELINE_ZONES } from '@/lib/constants'
import type { Reservation } from '@/types/database'
import type { DayLayout } from '@/hooks/use-timeline-layout'

interface TimelineBarOverlayProps {
  reservation: Reservation
  color: string
  dateToLayout: Map<string, DayLayout>
  totalWidth: number
}

export const TimelineBarOverlay = memo(function TimelineBarOverlay({
  reservation,
  color,
  dateToLayout,
  totalWidth,
}: TimelineBarOverlayProps) {
  const entryType = reservation.entry_type ?? 'stay'
  const isHourly = entryType === 'hourly'
  const zone = TIMELINE_ZONES[entryType]

  const barWidth = useMemo(() => {
    const layouts = Array.from(dateToLayout.values())
    if (layouts.length === 0) return 36

    const checkInStr = reservation.check_in_date
    const checkOutStr = reservation.check_out_date
    const lastLayout = layouts[layouts.length - 1]
    const endBound = lastLayout.xOffset + lastLayout.width

    // 대실: 같은 날 → 셀 절반 너비
    if (checkInStr === checkOutStr) {
      const dayLayout = dateToLayout.get(checkInStr)
      return dayLayout ? Math.floor(dayLayout.width / 2) - 2 : 18
    }

    // 숙박: 여러 날
    const startLayout = dateToLayout.get(checkInStr)
    const left = startLayout ? startLayout.xOffset + 2 : 2

    const endLayout = dateToLayout.get(checkOutStr)
    let right: number
    if (endLayout) {
      right = endLayout.xOffset - 2
    } else {
      right = endBound - 2
    }

    return Math.max(right - left, 20)
  }, [reservation, dateToLayout, totalWidth])

  if (isHourly) {
    return (
      <div
        className="rounded px-1 flex items-center text-white text-[9px] font-medium shadow-lg truncate pointer-events-none"
        style={{
          width: barWidth,
          height: zone.height,
          backgroundColor: '#EF4444',
          opacity: 0.8,
        }}
      >
        <span className="truncate">{reservation.guest_name}</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-md px-1.5 flex items-center text-white text-[10px] font-medium shadow-lg truncate pointer-events-none"
      style={{
        width: barWidth,
        height: zone.height,
        backgroundColor: color,
        opacity: 0.8,
      }}
    >
      <span className="truncate">
        {reservation.guest_name}
        {reservation.nights ? ` (${reservation.nights}박)` : ''}
      </span>
    </div>
  )
})
