'use client'

import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { createClient } from '@/lib/supabase/client'
import { useUpdateReservation } from '@/hooks/use-reservations'
import type { Reservation, Room } from '@/types/database'

export function TimelineCheckinPopover() {
  const supabase = createClient()
  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const updateReservation = useUpdateReservation()
  const queryClient = useQueryClient()

  // 당일 체크인 예정 예약 조회
  const { data: arrivals = [] } = useQuery({
    queryKey: ['todayArrivals', todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_in_date', todayStr)
        .eq('status', 'confirmed')
        .in('entry_type', ['stay'])
      return (data ?? []) as Reservation[]
    },
    refetchInterval: 30_000,
  })

  // 객실 정보
  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('*')
      return (data ?? []) as Room[]
    },
  })

  const roomMap = useMemo(() => {
    const map = new Map<string, Room>()
    rooms.forEach((r) => map.set(r.id, r))
    return map
  }, [rooms])

  const handleCheckin = (reservation: Reservation) => {
    updateReservation.mutate(
      { id: reservation.id, status: 'checked_in' },
      {
        onSuccess: () => {
          toast.success(`${reservation.guest_name} 체크인 완료`)
          queryClient.invalidateQueries({ queryKey: ['todayArrivals'] })
        },
        onError: () => {
          toast.error('체크인 처리에 실패했습니다.')
        },
      },
    )
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative">
          <LogIn className="h-4 w-4 mr-1" />
          체크인
          {arrivals.length > 0 && (
            <Badge className="absolute -top-2 -right-2 h-5 min-w-5 px-1 text-[10px] bg-blue-500 hover:bg-blue-500">
              {arrivals.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="end">
        <div className="px-4 py-3 border-b">
          <p className="font-semibold text-sm">오늘 체크인 예정</p>
          <p className="text-xs text-muted-foreground">{todayStr} · {arrivals.length}건</p>
        </div>
        {arrivals.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">체크인 예정 예약이 없습니다.</p>
        ) : (
          <div className="max-h-[300px] overflow-y-auto">
            {arrivals.map((r) => {
              const room = roomMap.get(r.room_id)
              return (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5 border-b last:border-b-0 hover:bg-accent/50">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{r.guest_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {room?.room_number ?? '-'}호 · {r.nights ?? '-'}박 · {r.total_amount.toLocaleString()}원
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    className="ml-2 shrink-0 h-7 text-xs"
                    onClick={() => handleCheckin(r)}
                    disabled={updateReservation.isPending}
                  >
                    {updateReservation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      '체크인'
                    )}
                  </Button>
                </div>
              )
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
