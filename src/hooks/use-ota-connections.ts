'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { OtaConnection, OtaConnectionInsert, OtaConnectionUpdate } from '@/types/database'

export function useOtaConnections() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['otaConnections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ota_connections')
        .select('*')
        .order('channel')
      if (error) throw error
      return data as OtaConnection[]
    },
  })
}

export function useUpsertOtaConnection() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: OtaConnectionInsert) => {
      const { data, error } = await supabase
        .from('ota_connections')
        .upsert(input, { onConflict: 'channel' })
        .select()
        .single()
      if (error) throw error
      return data as OtaConnection
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otaConnections'] })
    },
  })
}

export function useUpdateOtaConnection() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: OtaConnectionUpdate & { id: string }) => {
      const { error } = await supabase
        .from('ota_connections')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['otaConnections'] })
    },
  })
}
