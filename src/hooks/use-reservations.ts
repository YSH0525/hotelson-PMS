'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Reservation, ReservationInsert, ReservationUpdate } from '@/types/database'

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

  return useMutation({
    mutationFn: async (input: ReservationInsert) => {
      const { data, error } = await supabase
        .from('reservations')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Reservation
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
