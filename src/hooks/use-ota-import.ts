'use client'

import { useCallback } from 'react'
import { format } from 'date-fns'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { CHANNELS } from '@/lib/channels'
import { useCreateSyncLog } from './use-ota-sync'
import { useOtaConnections, useUpsertOtaConnection, useUpdateOtaConnection } from './use-ota-connections'

/**
 * OTA에서 스크래핑한 예약 데이터를 Supabase에 저장하는 재사용 가능한 훅.
 * 타임라인 페이지와 OTA 동기화 페이지 양쪽에서 사용 가능.
 */
export function useOtaImport() {
  const queryClient = useQueryClient()
  const { data: connections = [] } = useOtaConnections()
  const upsertConnection = useUpsertOtaConnection()
  const updateConnection = useUpdateOtaConnection()
  const createSyncLog = useCreateSyncLog()

  const importReservations = useCallback(async (
    channel: string,
    reservations: Record<string, unknown>[],
  ) => {
    const supabase = createClient()

    // 연결 정보 확인, 없으면 자동 생성
    let conn = connections.find((c) => c.channel === channel)
    if (!conn) {
      try {
        conn = await upsertConnection.mutateAsync({
          channel,
          is_enabled: true,
          partner_url: null,
        })
      } catch {
        toast.error('OTA 연결 정보를 생성할 수 없습니다')
        return { created: 0, skipped: 0 }
      }
    }

    try {
      // 1. room_types, rooms, 기존 OTA 매핑 조회
      const [{ data: roomTypes }, { data: rooms }, { data: existingMaps }] = await Promise.all([
        supabase.from('room_types').select('*').order('sort_order'),
        supabase.from('rooms').select('*'),
        supabase.from('ota_reservation_map').select('ota_reservation_id').eq('channel', channel),
      ])

      if (!roomTypes?.length || !rooms?.length) {
        throw new Error('객실 정보를 불러올 수 없습니다. 객실 관리에서 객실을 먼저 등록하세요.')
      }

      const existingOtaIds = new Set(
        (existingMaps ?? []).map((m: { ota_reservation_id: string }) => m.ota_reservation_id),
      )

      // 2. OTA 객실타입명 → PMS room_type 매핑
      const matchRoomType = (otaRoomName: string) => {
        if (!otaRoomName) return roomTypes[0]
        const matched = roomTypes.find((rt: { name: string }) => otaRoomName.includes(rt.name))
        if (matched) return matched
        const reverseMatched = roomTypes.find((rt: { name: string }) => rt.name.includes(otaRoomName))
        if (reverseMatched) return reverseMatched
        return roomTypes[0]
      }

      // 3. 기간 내 기존 예약 조회 (방 충돌 체크용)
      const validRes = reservations.filter((r) => {
        const status = String((r as Record<string, unknown>).otaStatus ?? (r as Record<string, unknown>).status ?? '')
        return !status.includes('취소') && status.toLowerCase() !== 'cancelled'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allCheckIns = validRes.map((r: any) => r.checkInDate || r.checkIn).filter(Boolean) as string[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allCheckOuts = validRes.map((r: any) => r.checkOutDate || r.checkOut).filter(Boolean) as string[]

      const minDate = allCheckIns.length ? allCheckIns.sort()[0] : format(new Date(), 'yyyy-MM-dd')
      const maxDate = allCheckOuts.length ? [...allCheckOuts].sort().reverse()[0] : format(new Date(), 'yyyy-MM-dd')

      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('room_id, check_in_date, check_out_date')
        .lt('check_in_date', maxDate)
        .gt('check_out_date', minDate)
        .in('status', ['confirmed', 'checked_in'])

      const occupiedList = [...(existingReservations ?? [])]
      const isRoomOccupied = (roomId: string, checkIn: string, checkOut: string) => {
        return occupiedList.some(
          (er) => er.room_id === roomId && er.check_in_date < checkOut && er.check_out_date > checkIn,
        )
      }

      // 4. 예약 생성 루프
      let created = 0
      let skipped = 0
      const channelLabel = CHANNELS[channel as keyof typeof CHANNELS]?.label ?? channel

      for (const res of reservations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = res as any
        const otaId = String(r.otaReservationId || r.id || '')
        const otaStatus = String(r.otaStatus || r.status || '')

        if (otaStatus.includes('취소') || otaStatus.toLowerCase() === 'cancelled') {
          skipped++
          continue
        }

        if (existingOtaIds.has(otaId)) {
          skipped++
          continue
        }

        const checkIn = String(r.checkInDate || r.checkIn || '')
        const checkOut = String(r.checkOutDate || r.checkOut || '')
        if (!checkIn || !checkOut) {
          skipped++
          continue
        }

        const roomType = matchRoomType(String(r.roomTypeName || r.room || ''))

        const typeRooms = rooms.filter((rm: { room_type_id: string }) => rm.room_type_id === roomType.id)
        let targetRoom = typeRooms.find((rm: { id: string }) => !isRoomOccupied(rm.id, checkIn, checkOut))

        if (!targetRoom) {
          targetRoom = rooms.find((rm: { id: string }) => !isRoomOccupied(rm.id, checkIn, checkOut))
        }

        if (!targetRoom) {
          skipped++
          continue
        }

        const { data: newReservation, error: insertError } = await supabase
          .from('reservations')
          .insert({
            room_id: targetRoom.id,
            room_type_id: roomType.id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_name: String(r.guestName || r.guest || 'OTA Guest'),
            guest_phone: r.guestPhone || null,
            status: 'confirmed' as const,
            entry_type: 'stay' as const,
            total_amount: Number(r.amount || 0),
            memo: `[${channelLabel}] 예약번호: ${otaId}`,
            custom_fields: { field_channel: channel },
          })
          .select()
          .single()

        if (insertError) {
          console.error('예약 생성 실패:', insertError)
          skipped++
          continue
        }

        await supabase.from('ota_reservation_map').upsert(
          {
            reservation_id: newReservation.id,
            channel,
            ota_reservation_id: otaId,
            ota_status: otaStatus,
            ota_amount: Number(r.amount || 0),
            ota_deposit_amount: Number(r.depositAmount || 0),
            raw_data: JSON.parse(JSON.stringify(r)),
          },
          { onConflict: 'channel,ota_reservation_id' },
        )

        occupiedList.push({ room_id: targetRoom.id, check_in_date: checkIn, check_out_date: checkOut })
        existingOtaIds.add(otaId)
        created++
      }

      // 5. 동기화 로그 저장
      await createSyncLog.mutateAsync({
        connection_id: conn.id,
        channel,
        sync_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'success',
        reservations_found: reservations.length,
        reservations_created: created,
        reservations_skipped: skipped,
        raw_data: JSON.parse(JSON.stringify({ reservations })),
      })

      // 6. 연결 상태 업데이트
      await updateConnection.mutateAsync({
        id: conn.id,
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })

      // 7. 관련 쿼리 갱신 (타임라인 자동 반영)
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['sameDayEntries'] })

      toast.success(`${channelLabel}: ${created}건 예약 생성 완료 (${skipped}건 스킵)`)
      return { created, skipped }
    } catch (error) {
      console.error('예약 저장 에러:', error)
      try {
        await updateConnection.mutateAsync({
          id: conn!.id,
          sync_status: 'error',
          error_message: error instanceof Error ? error.message : '저장 실패',
        })
      } catch { /* ignore */ }
      toast.error(`예약 데이터 저장 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      return { created: 0, skipped: 0 }
    }
  }, [connections, upsertConnection, updateConnection, createSyncLog, queryClient])

  return { importReservations }
}
