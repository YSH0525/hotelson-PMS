'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Room, RoomInsert } from '@/types/database'

/** room_number 기준 자연 정렬 (숫자 인식: "2" < "10" < "101") */
export function sortRoomsByNumber(rooms: Room[]): Room[] {
  return [...rooms].sort((a, b) =>
    a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
  )
}

export function useRooms() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
      if (error) throw error
      return sortRoomsByNumber(data as Room[])
    },
  })
}

export function useRoomsByType(roomTypeId: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['rooms', roomTypeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rooms')
        .select('*')
        .eq('room_type_id', roomTypeId)
      if (error) throw error
      return sortRoomsByNumber(data as Room[])
    },
    enabled: !!roomTypeId,
  })
}

export function useCreateRoom() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: RoomInsert) => {
      const { data, error } = await supabase
        .from('rooms')
        .insert(input)
        .select()
        .single()
      if (error) throw error
      return data as Room
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useUpdateRoom() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...data }: Partial<Room> & { id: string }) => {
      const { error } = await supabase
        .from('rooms')
        .update(data)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useDeleteRoom() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('rooms')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}

export function useReorderRooms() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase.from('rooms').update({ sort_order: index }).eq('id', id),
      )
      await Promise.all(updates)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] })
    },
  })
}
