'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { RoomType, RoomTypeInsert } from '@/types/database'

export function useRoomTypes() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('room_types')
        .select('*')
        .order('sort_order')
      if (error) throw error
      return data as RoomType[]
    },
  })
}

export function useCreateRoomType() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RoomTypeInsert) => {
      const { data, error } = await supabase
        .from('room_types')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as RoomType
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}

export function useUpdateRoomType() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<RoomType> & { id: string }) => {
      const { error } = await supabase
        .from('room_types')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}

export function useDeleteRoomType() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('room_types')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useReorderRoomTypes() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('room_types').update({ sort_order: index }).eq('id', id)
      )
      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roomTypes'] })
    },
  })
}
