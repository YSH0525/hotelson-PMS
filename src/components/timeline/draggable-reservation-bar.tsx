'use client'

import { memo, useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { cn } from '@/lib/utils'
import { TIMELINE_ZONES, ENTRY_TYPE, RESERVATION_STATUS } from '@/lib/constants'
import { useUIStore } from '@/stores/use-ui-store'
import type { Reservation } from '@/types/database'
import type { DayLayout } from '@/hooks/use-timeline-layout'

interface DraggableReservationBarProps {
  reservation: Reservation
  color: string
  dateToLayout: Map<string, DayLayout>
  totalWidth: number
}

export const DraggableReservationBar = memo(function DraggableReservationBar({
  reservation,
  color,
  dateToLayout,
  totalWidth,
}: DraggableReservationBarProps) {
  const openEditDialog = useUIStore((s) => s.openEditDialog)
  const entryType = reservation.entry_type ?? 'stay'

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: reservation.id,
    data: {
      reservation,
      color,
      entryType,
    },
  })

  // layout 기반 위치 계산
  const style = useMemo(() => {
    const zone = TIMELINE_ZONES[entryType]
    const layouts = Array.from(dateToLayout.values())
    if (layouts.length === 0) return null

    const firstDateStr = layouts[0].dateStr
    const lastLayout = layouts[layouts.length - 1]
    const endBound = lastLayout.xOffset + lastLayout.width

    const checkInStr = reservation.check_in_date
    const checkOutStr = reservation.check_out_date

    // 대실: 같은 날
    if (checkInStr === checkOutStr) {
      const dayLayout = dateToLayout.get(checkInStr)
      if (!dayLayout) return null
      return {
        left: dayLayout.xOffset + 2,
        width: dayLayout.width - 4,
        top: zone.top,
        height: zone.height,
      }
    }

    // 숙박: 여러 날
    if (checkOutStr <= firstDateStr) return null

    const startLayout = dateToLayout.get(checkInStr)
    const left = startLayout ? startLayout.xOffset + 2 : 2

    const endLayout = dateToLayout.get(checkOutStr)
    let right: number
    if (endLayout) {
      right = endLayout.xOffset - 2
    } else if (checkOutStr > lastLayout.dateStr) {
      right = endBound - 2
    } else {
      return null
    }

    const width = right - left
    if (width <= 0) return null

    return { left, width, top: zone.top, height: zone.height }
  }, [reservation, dateToLayout, entryType, totalWidth])

  if (!style) return null

  const statusInfo = RESERVATION_STATUS[reservation.status]
  const isHourly = entryType === 'hourly'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    openEditDialog(entryType, reservation.id)
  }

  // 대실: 빨간색 바, 이름 표시 (12px 높이)
  if (isHourly) {
    const timeStr = reservation.check_in_time && reservation.check_out_time
      ? `${reservation.check_in_time.slice(0, 5)}~${reservation.check_out_time.slice(0, 5)}`
      : ''
    return (
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className={cn(
          'absolute rounded px-1 flex items-center text-white text-[9px] font-medium',
          'hover:brightness-110 transition-all truncate',
          isDragging ? 'opacity-30 cursor-grabbing' : 'cursor-grab',
        )}
        style={{
          ...style,
          backgroundColor: '#EF4444',
          opacity: isDragging ? 0.3 : 0.9,
        }}
        onClick={handleClick}
        title={`[대실] ${reservation.guest_name} ${timeStr} ${statusInfo.label}`}
      >
        <span className="truncate">
          {reservation.guest_name}
        </span>
      </div>
    )
  }

  // 숙박: 메인 바 (18px 높이)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'absolute rounded-md px-1.5 flex items-center text-white text-[10px] font-medium',
        'hover:brightness-110 transition-all shadow-sm truncate',
        isDragging ? 'opacity-30 cursor-grabbing' : 'cursor-grab',
      )}
      style={{
        ...style,
        backgroundColor: color,
        opacity: isDragging ? 0.3 : (reservation.status === 'checked_out' ? 0.6 : 1),
      }}
      onClick={handleClick}
      title={`${reservation.guest_name} (${reservation.check_in_date} ~ ${reservation.check_out_date}) ${statusInfo.label}`}
    >
      <span className="truncate">
        {reservation.guest_name}
        {reservation.nights ? ` (${reservation.nights}박)` : ''}
      </span>
    </div>
  )
})
