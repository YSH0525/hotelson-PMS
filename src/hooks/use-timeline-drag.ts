'use client'

import { useState, useCallback, useMemo } from 'react'
import { useSensor, useSensors, PointerSensor } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, Modifier } from '@dnd-kit/core'
import { addDays, parseISO, format, differenceInDays } from 'date-fns'
import { toast } from 'sonner'
import { TIMELINE_CELL_WIDTH, TIMELINE_CELL_HEIGHT } from '@/lib/constants'
import { useUpdateReservation } from '@/hooks/use-reservations'
import type { Reservation } from '@/types/database'
import type { TimelineLayout } from '@/hooks/use-timeline-layout'

// ── 타입 정의 ──

export interface RoomYPosition {
  roomId: string
  roomTypeId: string
  yStart: number
  yEnd: number
}

export interface DragData {
  reservation: Reservation
  color: string
  entryType: 'stay' | 'hourly'
}

// ── 유틸리티 ──

function findTargetRoom(
  currentRoomId: string,
  deltaY: number,
  roomYPositions: RoomYPosition[],
): RoomYPosition | null {
  const current = roomYPositions.find((r) => r.roomId === currentRoomId)
  if (!current) return null
  const targetCenterY = (current.yStart + current.yEnd) / 2 + deltaY
  return (
    roomYPositions.find((r) => targetCenterY >= r.yStart && targetCenterY < r.yEnd) ?? null
  )
}

// ── 메인 훅 ──

interface UseTimelineDragOptions {
  roomYPositions: RoomYPosition[]
  startDate: Date
  layout: TimelineLayout
}

export function useTimelineDrag({ roomYPositions, startDate, layout }: UseTimelineDragOptions) {
  const updateReservation = useUpdateReservation()
  const [activeDragData, setActiveDragData] = useState<DragData | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  )

  // 가변 너비 그리드 인식 스냅 모디파이어
  const snapModifier: Modifier = useMemo(() => {
    return ({ transform }) => {
      // X축: 일반 셀 너비(40px) 기준으로 근사 스냅
      // (오늘 셀이 80px이면 2칸분 위치에 스냅 - 시각적으로 충분)
      const snappedX = Math.round(transform.x / TIMELINE_CELL_WIDTH) * TIMELINE_CELL_WIDTH
      const snappedY = Math.round(transform.y / TIMELINE_CELL_HEIGHT) * TIMELINE_CELL_HEIGHT
      return { ...transform, x: snappedX, y: snappedY }
    }
  }, [])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current as DragData | undefined
    if (!data) return
    setActiveDragData(data)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      if (!activeDragData) {
        setActiveDragData(null)
        return
      }

      const { delta } = event
      const { reservation } = activeDragData

      // layout 기반 정확한 날짜 이동량 계산
      const originalLayout = layout.dateToLayout.get(reservation.check_in_date)
      let daysDelta: number

      if (originalLayout) {
        // 드래그 시작 위치(check_in의 xOffset)에서 delta.x만큼 이동한 곳의 날짜를 찾음
        const newX = originalLayout.xOffset + delta.x
        const targetDay = layout.getDateAtX(newX)
        if (targetDay) {
          daysDelta = differenceInDays(parseISO(targetDay.dateStr), parseISO(reservation.check_in_date))
        } else {
          // 범위 밖이면 기본 계산
          daysDelta = Math.round(delta.x / TIMELINE_CELL_WIDTH)
        }
      } else {
        // check_in이 표시 범위 밖이면 기본 계산
        daysDelta = Math.round(delta.x / TIMELINE_CELL_WIDTH)
      }

      // 목표 객실 계산
      const targetRoom = findTargetRoom(reservation.room_id, delta.y, roomYPositions)

      // 변경사항 없으면 취소
      if (daysDelta === 0 && (!targetRoom || targetRoom.roomId === reservation.room_id)) {
        setActiveDragData(null)
        return
      }

      if (!targetRoom) {
        setActiveDragData(null)
        return
      }

      // 새 날짜 계산
      const newCheckIn = format(addDays(parseISO(reservation.check_in_date), daysDelta), 'yyyy-MM-dd')
      const newCheckOut = format(addDays(parseISO(reservation.check_out_date), daysDelta), 'yyyy-MM-dd')

      // DB 업데이트
      updateReservation.mutate(
        {
          id: reservation.id,
          room_id: targetRoom.roomId,
          room_type_id: targetRoom.roomTypeId,
          check_in_date: newCheckIn,
          check_out_date: newCheckOut,
        },
        {
          onSuccess: () => {
            toast.success(`${reservation.guest_name} 예약이 이동되었습니다.`)
          },
          onError: () => {
            toast.error('예약 이동에 실패했습니다.')
          },
        },
      )

      setActiveDragData(null)
    },
    [activeDragData, roomYPositions, updateReservation, layout],
  )

  const handleDragCancel = useCallback(() => {
    setActiveDragData(null)
  }, [])

  return {
    sensors,
    activeDragData,
    snapModifier,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  }
}
