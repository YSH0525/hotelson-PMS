'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Reservation, ReservationInsert, ReservationUpdate, CashLedgerInsert } from '@/types/database'
import { useAuthStore } from '@/stores/use-auth-store'

export function useReservations(startDate: string, endDate: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['reservations', startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .lt('check_in_date', endDate)
        .gt('check_out_date', startDate)
        .not('status', 'in', '("cancelled","no_show")')
      if (error) throw error
      return data as Reservation[]
    },
  })
}

export function useReservation(id: string | null) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['reservation', id],
    queryFn: async () => {
      if (!id) return null
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw error
      return data as Reservation
    },
    enabled: !!id,
  })
}

export function useCreateReservation() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const profile = useAuthStore((s) => s.profile)

  return useMutation({
    mutationFn: async (input: ReservationInsert) => {
      const { data, error } = await supabase
        .from('reservations')
        .insert(input)
        .select()
        .single()
      if (error) throw error

      // 현금 결제 시 cash_ledger에 자동 입금 기록
      const reservation = data as Reservation
      const customFields = (reservation.custom_fields ?? {}) as Record<string, unknown>
      const paymentType = String(customFields['field_payment_type'] ?? '')
      if (paymentType === '현금' && reservation.total_amount > 0) {
        const entryTypeLabel =
          reservation.entry_type === 'stay'
            ? '숙박'
            : reservation.entry_type === 'hourly'
              ? '대실'
              : '기타매출'
        const cashEntry: CashLedgerInsert = {
          entry_date: reservation.check_in_date,
          entry_type: 'income',
          category: entryTypeLabel,
          description: `${reservation.guest_name}`,
          amount: reservation.total_amount,
          reservation_id: reservation.id,
          created_by: profile?.id ?? null,
        }
        await supabase.from('cash_ledger').insert(cashEntry)
      }

      return reservation
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['sameDayEntries'] })
      queryClient.invalidateQueries({ queryKey: ['dailyStayReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyHourlyReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyOtherRevenue'] })
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] })
    },
  })
}

export function useUpdateReservation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: ReservationUpdate & { id: string }) => {
      const { error } = await supabase
        .from('reservations')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['reservation'] })
      queryClient.invalidateQueries({ queryKey: ['sameDayEntries'] })
      queryClient.invalidateQueries({ queryKey: ['dailyStayReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyHourlyReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyOtherRevenue'] })
    },
  })
}

export function useDeleteReservation() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] })
      queryClient.invalidateQueries({ queryKey: ['sameDayEntries'] })
      queryClient.invalidateQueries({ queryKey: ['dailyStayReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyHourlyReservations'] })
      queryClient.invalidateQueries({ queryKey: ['dailyOtherRevenue'] })
    },
  })
}
