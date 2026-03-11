'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type {
  OtaSyncLog,
  OtaSyncLogInsert,
  OtaReservationMap,
  OtaReservationMapInsert,
} from '@/types/database'

/** 특정 OTA 채널의 동기화 로그 조회 */
export function useOtaSyncLogs(channel?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['otaSyncLogs', channel],
    queryFn: async () => {
      let query = supabase
        .from('ota_sync_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (channel) {
        query = query.eq('channel', channel)
      }

      const { data, error } = await query
      if (error) throw error
      return data as OtaSyncLog[]
    },
  })
}

/** 동기화 로그 생성 */
export function useCreateSyncLog() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: OtaSyncLogInsert) => {
      const { data, error } = await supabase
        .from('ota_sync_logs')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as OtaSyncLog
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otaSyncLogs'] })
    },
  })
}

/** 동기화 로그 업데이트 */
export function useUpdateSyncLog() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<OtaSyncLog> & { id: string }) => {
      const { error } = await supabase
        .from('ota_sync_logs')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otaSyncLogs'] })
    },
  })
}

/** OTA 예약번호로 기존 매핑 확인 */
export function useOtaReservationMap(channel: string, otaReservationId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['otaReservationMap', channel, otaReservationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ota_reservation_map')
        .select('*')
        .eq('channel', channel)
        .eq('ota_reservation_id', otaReservationId)
        .maybeSingle()
      if (error) throw error
      return data as OtaReservationMap | null
    },
    enabled: !!channel && !!otaReservationId,
  })
}

/** OTA 예약 매핑 생성 */
export function useCreateOtaReservationMap() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: OtaReservationMapInsert) => {
      const { data, error } = await supabase
        .from('ota_reservation_map')
        .upsert(input, { onConflict: 'channel,ota_reservation_id' })
        .select()
        .single()
      if (error) throw error
      return data as OtaReservationMap
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otaReservationMap'] })
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
    },
  })
}

/** 채널별 OTA 매핑 목록 조회 */
export function useOtaReservationMaps(channel?: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['otaReservationMaps', channel],
    queryFn: async () => {
      let query = supabase
        .from('ota_reservation_map')
        .select('*')
        .order('synced_at', { ascending: false })
        .limit(100)

      if (channel) {
        query = query.eq('channel', channel)
      }

      const { data, error } = await query
      if (error) throw error
      return data as OtaReservationMap[]
    },
  })
}
