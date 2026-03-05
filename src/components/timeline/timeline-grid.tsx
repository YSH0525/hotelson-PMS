'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DndContext, DragOverlay } from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { format, addDays } from 'date-fns'
import { TimelineHeader } from './timeline-header'
import { TimelineCell } from './timeline-cell'
import { TimelineReservationBar } from './timeline-reservation-bar'
import { DraggableReservationBar } from './draggable-reservation-bar'
import { TimelineBarOverlay } from './timeline-bar-overlay'
import { useTimelineDrag } from '@/hooks/use-timeline-drag'
import { useTimelineLayout } from '@/hooks/use-timeline-layout'
import { useTimelineStore } from '@/stores/use-timeline-store'
import type { RoomYPosition } from '@/hooks/use-timeline-drag'
import { TIMELINE_CELL_HEIGHT, TIMELINE_ROOM_LIST_WIDTH } from '@/lib/constants'
import type { RoomType, Room, Reservation } from '@/types/database'

interface TimelineGridProps {
  startDate: Date
  daysToShow: number
}

export function TimelineGrid({ startDate, daysToShow }: TimelineGridProps) {
  const supabase = createClient()
  const hidePastDays = useTimelineStore((s) => s.hidePastDays)

  // layout 훅: 가변 셀 너비 + 과거 날짜 필터링
  const layout = useTimelineLayout(startDate, daysToShow, hidePastDays)

  // 데이터 쿼리는 항상 전체 범위로 (과거 예약도 바가 걸칠 수 있음)
  const startStr = format(startDate, 'yyyy-MM-dd')
  const endStr = format(addDays(startDate, daysToShow), 'yyyy-MM-dd')

  // 객실타입 + 호실 조회
  const { data: roomTypes = [] } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('room_types')
        .select('*')
        .order('sort_order')
      return (data ?? []) as RoomType[]
    },
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await supabase
        .from('rooms')
        .select('*')
      const list = (data ?? []) as Room[]
      return [...list].sort((a, b) =>
        a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
      )
    },
  })

  // 기간 내 예약 조회
  const { data: reservations = [] } = useQuery({
    queryKey: ['reservations', startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .lt('check_in_date', endStr)
        .gt('check_out_date', startStr)
        .not('status', 'in', '("cancelled","no_show")')
      return (data ?? []) as Reservation[]
    },
  })

  // 객실타입별 호실 그룹핑
  const roomsByType = useMemo(() => {
    const map = new Map<string, Room[]>()
    roomTypes.forEach((rt) => {
      map.set(rt.id, rooms.filter((r) => r.room_type_id === rt.id))
    })
    return map
  }, [roomTypes, rooms])

  // 날짜별 점유율 계산
  const occupancyByDate = useMemo(() => {
    const totalRooms = rooms.length
    if (totalRooms === 0) return {}
    const occ: Record<string, number> = {}
    layout.days.forEach((dayLayout) => {
      const dateStr = dayLayout.dateStr
      const occupied = reservations.filter(
        (r) => r.check_in_date <= dateStr && r.check_out_date > dateStr
      ).length
      occ[dateStr] = Math.round((occupied / totalRooms) * 100)
    })
    return occ
  }, [layout.days, reservations, rooms.length])

  // 플랫 호실 목록 (렌더링 순서대로)
  const flatRooms = useMemo(() => {
    const result: { room: Room; roomType: RoomType }[] = []
    roomTypes.forEach((rt) => {
      const typeRooms = roomsByType.get(rt.id) || []
      typeRooms.forEach((room) => {
        result.push({ room, roomType: rt })
      })
    })
    return result
  }, [roomTypes, roomsByType])

  // 대실/기타매출 조회 (같은 날짜 check_in=check_out인 항목도 포함)
  const { data: sameDayEntries = [] } = useQuery({
    queryKey: ['sameDayEntries', startStr, endStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .gte('check_in_date', startStr)
        .lt('check_in_date', endStr)
        .in('entry_type', ['hourly', 'other_revenue'])
        .not('status', 'in', '("cancelled","no_show")')
      return (data ?? []) as Reservation[]
    },
  })

  // 숙박+대실+기타매출 합쳐서 호실별로 그룹핑
  const allEntries = useMemo(() => {
    const combined = [...reservations, ...sameDayEntries]
    const map = new Map<string, Reservation>()
    combined.forEach((r) => map.set(r.id, r))
    return Array.from(map.values())
  }, [reservations, sameDayEntries])

  const entriesByRoom = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    allEntries.forEach((res) => {
      const arr = map.get(res.room_id) || []
      arr.push(res)
      map.set(res.room_id, arr)
    })
    return map
  }, [allEntries])

  // ── 드래그 앤 드롭: 객실 Y 위치 매핑 ──
  const roomYPositions = useMemo<RoomYPosition[]>(() => {
    const positions: RoomYPosition[] = []
    let yOffset = 0
    roomTypes.forEach((rt) => {
      const typeRooms = roomsByType.get(rt.id) || []
      if (typeRooms.length === 0) return
      yOffset += TIMELINE_CELL_HEIGHT // 객실타입 헤더 행
      typeRooms.forEach((room) => {
        positions.push({
          roomId: room.id,
          roomTypeId: rt.id,
          yStart: yOffset,
          yEnd: yOffset + TIMELINE_CELL_HEIGHT,
        })
        yOffset += TIMELINE_CELL_HEIGHT
      })
    })
    return positions
  }, [roomTypes, roomsByType])

  const {
    sensors,
    activeDragData,
    snapModifier,
    handleDragStart,
    handleDragEnd,
    handleDragCancel,
  } = useTimelineDrag({ roomYPositions, startDate, layout })

  return (
    <DndContext
      sensors={sensors}
      modifiers={[snapModifier]}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="relative">
        <TimelineHeader
          days={layout.days}
          occupancyByDate={occupancyByDate}
        />

        {/* 그리드 본문 */}
        {flatRooms.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            객실을 먼저 등록해주세요. 좌측 메뉴의 &apos;객실 관리&apos;에서 추가할 수 있습니다.
          </div>
        ) : (
          <div>
            {roomTypes.map((rt) => {
              const typeRooms = roomsByType.get(rt.id) || []
              if (typeRooms.length === 0) return null

              return (
                <div key={rt.id}>
                  {/* 객실타입 헤더 행 */}
                  <div className="flex sticky left-0 z-10">
                    <div
                      className="sticky left-0 z-20 bg-muted border-r border-b flex items-center px-3 text-sm font-semibold"
                      style={{ minWidth: TIMELINE_ROOM_LIST_WIDTH, width: TIMELINE_ROOM_LIST_WIDTH, height: TIMELINE_CELL_HEIGHT }}
                    >
                      <div
                        className="w-3 h-3 rounded-full mr-2 shrink-0"
                        style={{ backgroundColor: rt.color }}
                      />
                      {rt.name}
                      <span className="text-muted-foreground text-xs ml-1">({typeRooms.length})</span>
                    </div>
                    {layout.days.map((dayLayout) => (
                      <div
                        key={dayLayout.dateStr}
                        className="bg-muted border-r border-b"
                        style={{ minWidth: dayLayout.width, width: dayLayout.width, height: TIMELINE_CELL_HEIGHT }}
                      />
                    ))}
                  </div>

                  {/* 각 호실 행 */}
                  {typeRooms.map((room) => {
                    const roomEntries = entriesByRoom.get(room.id) || []

                    return (
                      <div key={room.id} className="flex relative">
                        {/* 호실명 */}
                        <div
                          className="sticky left-0 z-20 bg-background border-r border-b flex items-center px-3 text-sm"
                          style={{ minWidth: TIMELINE_ROOM_LIST_WIDTH, width: TIMELINE_ROOM_LIST_WIDTH, height: TIMELINE_CELL_HEIGHT }}
                        >
                          <span className="text-muted-foreground mr-2">└</span>
                          {room.room_number}호
                        </div>

                        {/* 날짜 셀 */}
                        <div className="flex relative z-0">
                          {layout.days.map((dayLayout) => (
                            <TimelineCell
                              key={dayLayout.dateStr}
                              date={dayLayout.dateStr}
                              roomId={room.id}
                              width={dayLayout.width}
                            />
                          ))}

                          {/* 예약/대실/기타매출 바 오버레이 */}
                          {roomEntries.map((res) => {
                            const entryType = res.entry_type ?? 'stay'
                            // 기타매출은 드래그 불가 → 기존 바 사용
                            if (entryType === 'other_revenue') {
                              return (
                                <TimelineReservationBar
                                  key={res.id}
                                  reservation={res}
                                  color={rt.color}
                                  dateToLayout={layout.dateToLayout}
                                  totalWidth={layout.totalWidth}
                                />
                              )
                            }
                            // 숙박/대실 → 드래그 가능 바
                            return (
                              <DraggableReservationBar
                                key={res.id}
                                reservation={res}
                                color={rt.color}
                                dateToLayout={layout.dateToLayout}
                                totalWidth={layout.totalWidth}
                              />
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 드래그 고스트 오버레이 */}
      <DragOverlay dropAnimation={null}>
        {activeDragData ? (
          <TimelineBarOverlay
            reservation={activeDragData.reservation}
            color={activeDragData.color}
            dateToLayout={layout.dateToLayout}
            totalWidth={layout.totalWidth}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}
