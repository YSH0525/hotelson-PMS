'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, Plus } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { RESERVATION_STATUS, ENTRY_TYPE, REVENUE_CATEGORIES } from '@/lib/constants'
import { useUIStore } from '@/stores/use-ui-store'
import { useTimelineStore } from '@/stores/use-timeline-store'
import { ReservationDialog } from '@/components/reservations/reservation-dialog'
import { HourlyDialog } from '@/components/reservations/hourly-dialog'
import { OtherRevenueDialog } from '@/components/reservations/other-revenue-dialog'
import type { Reservation, Room, RoomType } from '@/types/database'

export default function ReservationsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('all')
  const openReservationDialog = useUIStore((s) => s.openReservationDialog)
  const openEditDialog = useUIStore((s) => s.openEditDialog)
  const setSelectedCell = useTimelineStore((s) => s.setSelectedCell)
  const supabase = createClient()

  const { data: reservations = [] } = useQuery({
    queryKey: ['allReservations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .order('check_in_date', { ascending: false })
        .limit(200)
      return (data ?? []) as Reservation[]
    },
  })

  const { data: rooms = [] } = useQuery({
    queryKey: ['rooms'],
    queryFn: async () => {
      const { data } = await supabase.from('rooms').select('*')
      const list = (data ?? []) as Room[]
      return [...list].sort((a, b) =>
        a.room_number.localeCompare(b.room_number, undefined, { numeric: true }),
      )
    },
  })

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const { data } = await supabase.from('room_types').select('*')
      return (data ?? []) as RoomType[]
    },
  })

  const filtered = reservations.filter((r) => {
    const matchSearch = !search ||
      r.guest_name.includes(search) ||
      r.guest_phone?.includes(search) ||
      rooms.find((rm) => rm.id === r.room_id)?.room_number.includes(search)
    const matchStatus = statusFilter === 'all' || r.status === statusFilter
    const matchEntryType = entryTypeFilter === 'all' || (r.entry_type ?? 'stay') === entryTypeFilter
    return matchSearch && matchStatus && matchEntryType
  })

  const handleNewReservation = () => {
    setSelectedCell(null, null)
    openReservationDialog()
  }

  const handleRowClick = (res: Reservation) => {
    const entryType = res.entry_type ?? 'stay'
    openEditDialog(entryType, res.id)
  }

  const renderNightsOrInfo = (res: Reservation) => {
    const entryType = res.entry_type ?? 'stay'
    switch (entryType) {
      case 'hourly':
        if (res.check_in_time && res.check_out_time) {
          return `${res.check_in_time} ~ ${res.check_out_time}`
        }
        return '-'
      case 'other_revenue': {
        const category = REVENUE_CATEGORIES.find((c) => c.value === res.revenue_category)
        return category?.label ?? res.revenue_category ?? '-'
      }
      case 'stay':
      default:
        return `${res.nights}박`
    }
  }

  return (
    <>
      <Header title="예약 목록" />
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="투숙객명, 연락처, 호실 검색"
                className="pl-10 w-[300px]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="상태 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(RESERVATION_STATUS).map(([key, info]) => (
                  <SelectItem key={key} value={key}>{info.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entryTypeFilter} onValueChange={setEntryTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="유형 필터" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {Object.entries(ENTRY_TYPE).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.icon} {info.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleNewReservation}>
            <Plus className="h-4 w-4 mr-1" />
            새 예약
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>유형</TableHead>
              <TableHead>객실</TableHead>
              <TableHead>투숙객</TableHead>
              <TableHead>연락처</TableHead>
              <TableHead>체크인</TableHead>
              <TableHead>체크아웃</TableHead>
              <TableHead>박수/정보</TableHead>
              <TableHead>상태</TableHead>
              <TableHead className="text-right">금액</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  예약이 없습니다.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((res) => {
                const room = rooms.find((r) => r.id === res.room_id)
                const roomType = roomTypes.find((rt) => rt.id === res.room_type_id)
                const statusInfo = RESERVATION_STATUS[res.status]
                const entryType = res.entry_type ?? 'stay'
                const entryInfo = ENTRY_TYPE[entryType]
                return (
                  <TableRow
                    key={res.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => handleRowClick(res)}
                  >
                    <TableCell>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {entryInfo.icon} {entryInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {roomType && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roomType.color }} />
                        )}
                        <span className="text-xs text-muted-foreground">{roomType?.name}</span>
                        <span className="font-medium">{room?.room_number}호</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{res.guest_name}</TableCell>
                    <TableCell className="text-sm">{res.guest_phone ?? '-'}</TableCell>
                    <TableCell className="text-sm">{res.check_in_date}</TableCell>
                    <TableCell className="text-sm">{res.check_out_date}</TableCell>
                    <TableCell className="text-sm">{renderNightsOrInfo(res)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {statusInfo?.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {res.total_amount.toLocaleString()}원
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
      <ReservationDialog />
      <HourlyDialog />
      <OtherRevenueDialog />
    </>
  )
}
