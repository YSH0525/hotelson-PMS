'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, addDays } from 'date-fns'
import { createClient } from '@/lib/supabase/client'
import { useRoomTypes } from '@/hooks/use-room-types'
import { useRooms } from '@/hooks/use-rooms'
import type { RoomType } from '@/types/database'

// ── 타입 정의 ──

export interface RoomTypeRow {
  roomType: RoomType
  total: number                // 판매 가능 객실 수 (정비/불가 제외)
  availableByDate: number[]    // 날짜별 잔여 수량
}

export interface InventoryRangeResult {
  dateColumns: string[]        // ['2026-03-04', '2026-03-05', ...]
  rows: RoomTypeRow[]
  totalsByDate: number[]       // 날짜별 합계 잔여
  totalRooms: number           // 전체 판매 가능 합계
}

// ── 훅 ──

export function useRoomInventory(startDate: string, days: number) {
  const supabase = createClient()
  const { data: roomTypes } = useRoomTypes()
  const { data: rooms } = useRooms()

  const endDate = format(addDays(new Date(startDate + 'T00:00:00'), days), 'yyyy-MM-dd')

  // 범위 내 점유 예약 조회 (30초 자동 갱신)
  const { data: reservations } = useQuery({
    queryKey: ['inventory-reservations', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('room_id, check_in_date, check_out_date, entry_type')
        .lte('check_in_date', format(addDays(new Date(endDate + 'T00:00:00'), -1), 'yyyy-MM-dd'))
        .gte('check_out_date', startDate)
        .in('status', ['confirmed', 'checked_in'])
        .in('entry_type', ['stay', 'hourly'])

      if (error) throw error
      return data ?? []
    },
    refetchInterval: 30_000,
    enabled: !!startDate && days > 0,
  })

  const result = useMemo<InventoryRangeResult>(() => {
    // 날짜 열 생성
    const dateColumns: string[] = []
    for (let i = 0; i < days; i++) {
      dateColumns.push(format(addDays(new Date(startDate + 'T00:00:00'), i), 'yyyy-MM-dd'))
    }

    if (!roomTypes || !rooms) {
      return { dateColumns, rows: [], totalsByDate: new Array(days).fill(0), totalRooms: 0 }
    }

    // 날짜별 점유 room_id Set 생성
    const occupiedByDate: Map<string, Set<string>> = new Map()
    for (const d of dateColumns) {
      occupiedByDate.set(d, new Set())
    }

    if (reservations) {
      for (const r of reservations) {
        for (const d of dateColumns) {
          // 숙박: check_in <= d < check_out
          // 대실: check_in == d == check_out
          const isStayOccupied =
            r.entry_type === 'stay' && r.check_in_date <= d && r.check_out_date > d
          const isHourlyOccupied =
            r.entry_type === 'hourly' && r.check_in_date === d

          if (isStayOccupied || isHourlyOccupied) {
            occupiedByDate.get(d)!.add(r.room_id)
          }
        }
      }
    }

    // 타입별 행 계산
    const rows: RoomTypeRow[] = roomTypes.map((rt) => {
      const typeRooms = rooms.filter(
        (r) => r.room_type_id === rt.id && r.status === 'available',
      )
      const total = typeRooms.length

      const availableByDate = dateColumns.map((d) => {
        const occupied = typeRooms.filter((r) => occupiedByDate.get(d)!.has(r.id)).length
        return total - occupied
      })

      return { roomType: rt, total, availableByDate }
    })

    // 합계 행
    const totalsByDate = dateColumns.map((_, i) =>
      rows.reduce((sum, row) => sum + row.availableByDate[i], 0),
    )
    const totalRooms = rows.reduce((sum, row) => sum + row.total, 0)

    return { dateColumns, rows, totalsByDate, totalRooms }
  }, [roomTypes, rooms, reservations, startDate, days])

  return result
}
