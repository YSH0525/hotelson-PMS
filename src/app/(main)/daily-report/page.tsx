'use client'

import { useState, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { useReactToPrint } from 'react-to-print'
import * as XLSX from 'xlsx'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { CalendarDays, Printer, Download, Plus, DoorOpen, DoorClosed } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { RESERVATION_STATUS, ENTRY_TYPE, REVENUE_CATEGORIES } from '@/lib/constants'
import { useChannelOptions } from '@/hooks/use-channel-options'
import { useUIStore } from '@/stores/use-ui-store'
import { useTimelineStore } from '@/stores/use-timeline-store'
import { useUpdateReservation } from '@/hooks/use-reservations'
import { toast } from 'sonner'
import { ReservationDialog } from '@/components/reservations/reservation-dialog'
import { HourlyDialog } from '@/components/reservations/hourly-dialog'
import { OtherRevenueDialog } from '@/components/reservations/other-revenue-dialog'
import type { Reservation, RoomType, Room } from '@/types/database'

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()
  const { openReservationDialog, openHourlyDialog, openOtherRevenueDialog } = useUIStore()
  const { setSelectedCell } = useTimelineStore()
  const updateReservation = useUpdateReservation()
  const { getLabel: getChannelLabel } = useChannelOptions()

  const openHourly = () => {
    setSelectedCell(null, dateStr)
    openHourlyDialog()
  }

  const openOtherRevenue = () => {
    setSelectedCell(null, dateStr)
    openOtherRevenueDialog()
  }

  const handleCheckIn = async (reservationId: string) => {
    try {
      await updateReservation.mutateAsync({ id: reservationId, status: 'checked_in' })
      toast.success('체크인 되었습니다.')
    } catch {
      toast.error('체크인에 실패했습니다.')
    }
  }

  const { data: roomTypes = [] } = useQuery({
    queryKey: ['roomTypes'],
    queryFn: async () => {
      const { data } = await supabase.from('room_types').select('*').order('sort_order')
      return (data ?? []) as RoomType[]
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

  // 숙박 예약 (체크인 <= 날짜 < 체크아웃)
  const { data: stayReservations = [] } = useQuery({
    queryKey: ['dailyStayReservations', dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .lte('check_in_date', dateStr)
        .gt('check_out_date', dateStr)
        .eq('entry_type', 'stay')
        .not('status', 'in', '("cancelled","no_show")')
        .order('check_in_date')
      return (data ?? []) as Reservation[]
    },
  })

  // 대실 예약 (당일 체크인)
  const { data: hourlyReservations = [] } = useQuery({
    queryKey: ['dailyHourlyReservations', dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_in_date', dateStr)
        .eq('entry_type', 'hourly')
        .not('status', 'in', '("cancelled","no_show")')
        .order('check_in_date')
      return (data ?? []) as Reservation[]
    },
  })

  // 기타매출 (당일)
  const { data: otherRevenueEntries = [] } = useQuery({
    queryKey: ['dailyOtherRevenue', dateStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .eq('check_in_date', dateStr)
        .eq('entry_type', 'other_revenue')
        .not('status', 'in', '("cancelled","no_show")')
        .order('check_in_date')
      return (data ?? []) as Reservation[]
    },
  })

  // 숙박 테이블 데이터
  const reportData = useMemo(() => {
    return roomTypes.map((rt) => {
      const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)
      const roomData = typeRooms.map((room) => {
        const reservation = stayReservations.find((r) => r.room_id === room.id)
        return { room, reservation }
      })
      return { roomType: rt, roomData }
    })
  }, [roomTypes, rooms, stayReservations])

  // 매출 계산
  const stayAmount = stayReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const hourlyAmount = hourlyReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const otherRevenueAmount = otherRevenueEntries.reduce((sum, r) => sum + r.total_amount, 0)
  const totalAmount = stayAmount + hourlyAmount + otherRevenueAmount

  const totalRooms = rooms.length
  const stayOccupied = stayReservations.length
  const hourlyCount = hourlyReservations.length
  const occupancyRate = totalRooms > 0 ? Math.round(((stayOccupied + hourlyCount) / totalRooms) * 100) : 0

  // 기타매출 카테고리 라벨 헬퍼
  const getRevenueCategoryLabel = (value: string | null) => {
    if (!value) return '-'
    const found = REVENUE_CATEGORIES.find((c) => c.value === value)
    return found ? found.label : value
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
  })

  const handleExcelExport = () => {
    // 숙박 시트 — 전체 객실 (공실 포함)
    const stayRows = reportData.flatMap(({ roomType, roomData }) =>
      roomData.map(({ room, reservation }) => {
        const cf = (reservation?.custom_fields ?? {}) as Record<string, unknown>
        const status = !reservation ? '공실' : reservation.status === 'checked_in' ? '투숙' : reservation.status === 'checked_out' ? '퇴실' : '예약'
        return {
          '상태': status,
          '객실타입': roomType.name,
          '호실': `${room.room_number}호`,
          '예약채널': reservation ? getChannelLabel(String(cf['field_channel'] ?? '')) : '',
          '이름': reservation?.guest_name ?? '',
          '박수': reservation?.nights ?? '',
          '결제': String(cf['field_payment_type'] ?? ''),
          '금액': reservation?.total_amount ?? '',
          '차량': String(cf['field_vehicle'] ?? ''),
          '비고': reservation?.memo ?? '',
        }
      })
    )

    // 대실 시트
    const hourlyRows = hourlyReservations.map((res) => {
      const room = rooms.find((r) => r.id === res.room_id)
      const cf = (res.custom_fields ?? {}) as Record<string, unknown>
      return {
        '호실': room?.room_number ? `${room.room_number}호` : '',
        '채널': getChannelLabel(String(cf['field_channel'] ?? '')),
        '이름': res.guest_name,
        '결제': String(cf['field_payment_type'] ?? ''),
        '금액': res.total_amount,
        '차량': String(cf['field_vehicle'] ?? ''),
        '비고': res.memo ?? '',
      }
    })

    // 기타매출 시트
    const otherRows = otherRevenueEntries.map((res) => {
      const room = rooms.find((r) => r.id === res.room_id)
      return {
        '호실': room?.room_number ? `${room.room_number}호` : '',
        '카테고리': getRevenueCategoryLabel(res.revenue_category),
        '내역': res.guest_name,
        '금액': res.total_amount,
        '메모': res.memo ?? '',
      }
    })

    const wb = XLSX.utils.book_new()

    const wsStay = XLSX.utils.json_to_sheet(stayRows)
    XLSX.utils.book_append_sheet(wb, wsStay, '숙박')

    const wsHourly = XLSX.utils.json_to_sheet(hourlyRows)
    XLSX.utils.book_append_sheet(wb, wsHourly, '대실')

    const wsOther = XLSX.utils.json_to_sheet(otherRows)
    XLSX.utils.book_append_sheet(wb, wsOther, '기타매출')

    // 요약 시트
    const summaryRows = [
      { '항목': '숙박매출', '금액': stayAmount },
      { '항목': '대실매출', '금액': hourlyAmount },
      { '항목': '기타매출', '금액': otherRevenueAmount },
      { '항목': '총매출', '금액': totalAmount },
    ]
    const wsSummary = XLSX.utils.json_to_sheet(summaryRows)
    XLSX.utils.book_append_sheet(wb, wsSummary, '요약')

    XLSX.writeFile(wb, `판매일지_${dateStr}.xlsx`)
  }

  return (
    <>
      <Header title="당일판매일지" />
      <div className="p-6 space-y-4">
        {/* 상단 컨트롤 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarDays className="h-4 w-4 mr-2" />
                  {format(selectedDate, 'yyyy년 M월 d일 (EEE)', { locale: ko })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => d && setSelectedDate(d)}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handlePrint()}>
              <Printer className="h-4 w-4 mr-1" />
              인쇄
            </Button>
            <Button variant="outline" onClick={handleExcelExport}>
              <Download className="h-4 w-4 mr-1" />
              엑셀
            </Button>
          </div>
        </div>

        <div ref={printRef} className="space-y-4">
          {/* 요약 바 */}
          <Card>
            <CardContent className="py-3">
              <div className="flex items-center divide-x text-sm">
                <div className="px-4 first:pl-0">
                  <span className="text-muted-foreground">객실</span>{' '}
                  <span className="font-semibold">{totalRooms}</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">투숙</span>{' '}
                  <span className="font-semibold">{stayOccupied}</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">대실</span>{' '}
                  <span className="font-semibold">{hourlyCount}</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">점유율</span>{' '}
                  <span className="font-semibold">{occupancyRate}%</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">숙박</span>{' '}
                  <span className="font-semibold">{stayAmount.toLocaleString()}원</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">대실</span>{' '}
                  <span className="font-semibold">{hourlyAmount.toLocaleString()}원</span>
                </div>
                <div className="px-4">
                  <span className="text-muted-foreground">기타</span>{' '}
                  <span className="font-semibold">{otherRevenueAmount.toLocaleString()}원</span>
                </div>
                <div className="px-4 text-primary">
                  <span className="font-medium">총매출</span>{' '}
                  <span className="font-bold">{totalAmount.toLocaleString()}원</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 숙박 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {ENTRY_TYPE.stay.icon} {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 숙박 판매일지
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[44px] text-center">체크인</TableHead>
                    <TableHead className="w-[50px]">상태</TableHead>
                    <TableHead className="w-[70px]">객실타입</TableHead>
                    <TableHead className="w-[50px]">호실</TableHead>
                    <TableHead className="w-[80px]">예약채널</TableHead>
                    <TableHead className="w-[80px]">이름</TableHead>
                    <TableHead className="w-[40px] text-center">박수</TableHead>
                    <TableHead className="w-[60px]">결제</TableHead>
                    <TableHead className="text-right w-[80px]">금액</TableHead>
                    <TableHead className="w-[80px]">차량</TableHead>
                    <TableHead className="min-w-[80px]">비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map(({ roomType, roomData }) =>
                    roomData.map(({ room, reservation }) => {
                      const customFields = (reservation?.custom_fields ?? {}) as Record<string, unknown>
                      const isCheckedIn = reservation?.status === 'checked_in' || reservation?.status === 'checked_out'
                      return (
                        <TableRow
                          key={room.id}
                          className={cn(
                            !reservation && 'text-muted-foreground',
                            reservation?.status === 'confirmed' && 'bg-amber-50 dark:bg-amber-950/20',
                            reservation?.status === 'checked_in' && 'bg-blue-50 dark:bg-blue-950/20',
                            reservation?.status === 'checked_out' && 'bg-gray-50 dark:bg-gray-950/20',
                          )}
                        >
                          {/* 체크인 아이콘 */}
                          <TableCell className="text-center">
                            {!reservation ? null : isCheckedIn ? (
                              <DoorClosed className="h-4 w-4 mx-auto text-muted-foreground" />
                            ) : (
                              <button
                                onClick={() => handleCheckIn(reservation.id)}
                                className="inline-flex items-center justify-center hover:text-primary transition-colors"
                                title="체크인"
                              >
                                <DoorOpen className="h-4 w-4 text-amber-500 hover:text-primary animate-pulse" />
                              </button>
                            )}
                          </TableCell>
                          {/* 상태 (공실/예약/투숙) */}
                          <TableCell>
                            {!reservation ? (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-400">공실</Badge>
                            ) : reservation.status === 'checked_in' ? (
                              <Badge variant="default" className="text-[10px] bg-blue-500">투숙</Badge>
                            ) : reservation.status === 'checked_out' ? (
                              <Badge variant="secondary" className="text-[10px]">퇴실</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-400">예약</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roomType.color }} />
                              <span className="text-xs">{roomType.name}</span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{room.room_number}호</TableCell>
                          {reservation ? (
                            <>
                              <TableCell className="text-xs">
                                {getChannelLabel(String(customFields['field_channel'] ?? ''))}
                              </TableCell>
                              <TableCell>{reservation.guest_name}</TableCell>
                              <TableCell className="text-center">{reservation.nights}</TableCell>
                              <TableCell className="text-xs">
                                {String(customFields['field_payment_type'] ?? '-')}
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {reservation.total_amount.toLocaleString()}
                              </TableCell>
                              <TableCell className="text-xs">
                                {String(customFields['field_vehicle'] ?? '-')}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {reservation.memo ?? '-'}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell colSpan={7}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs text-primary"
                                  onClick={() => {
                                    setSelectedCell(room.id, dateStr)
                                    openReservationDialog()
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  예약 입력
                                </Button>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8} className="font-bold">숙박 합계</TableCell>
                    <TableCell className="text-right font-bold">
                      {stayAmount.toLocaleString()}원
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* 대실 + 기타매출 좌우 배치 */}
          <div className="grid grid-cols-2 gap-4">
          {/* 대실 테이블 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {ENTRY_TYPE.hourly.icon} {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 대실
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs print:hidden"
                onClick={openHourly}
              >
                <Plus className="h-3 w-3 mr-1" />
                예약입력
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[70px]">호실</TableHead>
                    <TableHead className="w-[80px]">채널</TableHead>
                    <TableHead className="w-[80px]">이름</TableHead>
                    <TableHead className="w-[70px]">결제</TableHead>
                    <TableHead className="text-right w-[90px]">금액</TableHead>
                    <TableHead className="w-[90px]">차량</TableHead>
                    <TableHead className="min-w-[80px]">비고</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {hourlyReservations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                        해당 날짜의 대실 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    hourlyReservations.map((res) => {
                      const room = rooms.find((r) => r.id === res.room_id)
                      const cf = (res.custom_fields ?? {}) as Record<string, unknown>
                      return (
                        <TableRow key={res.id}>
                          <TableCell className="font-medium">
                            {room?.room_number ? `${room.room_number}호` : '-'}
                          </TableCell>
                          <TableCell className="text-xs">
                            {getChannelLabel(String(cf['field_channel'] ?? ''))}
                          </TableCell>
                          <TableCell>{res.guest_name}</TableCell>
                          <TableCell className="text-xs">
                            {String(cf['field_payment_type'] ?? '-')}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {res.total_amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs">
                            {String(cf['field_vehicle'] ?? '-')}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {res.memo ?? '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-bold">대실 합계</TableCell>
                    <TableCell className="text-right font-bold">
                      {hourlyAmount.toLocaleString()}원
                    </TableCell>
                    <TableCell colSpan={2} />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* 기타매출 테이블 */}
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">
                {ENTRY_TYPE.other_revenue.icon} {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 기타매출
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs print:hidden"
                onClick={openOtherRevenue}
              >
                <Plus className="h-3 w-3 mr-1" />
                입력
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">호실</TableHead>
                    <TableHead className="w-[100px]">카테고리</TableHead>
                    <TableHead>내역</TableHead>
                    <TableHead className="text-right w-[100px]">금액</TableHead>
                    <TableHead className="min-w-[80px]">메모</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {otherRevenueEntries.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                        해당 날짜의 기타매출 내역이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    otherRevenueEntries.map((res) => {
                      const room = rooms.find((r) => r.id === res.room_id)
                      return (
                        <TableRow key={res.id}>
                          <TableCell className="font-medium">
                            {room?.room_number ? `${room.room_number}호` : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {getRevenueCategoryLabel(res.revenue_category)}
                            </Badge>
                          </TableCell>
                          <TableCell>{res.guest_name}</TableCell>
                          <TableCell className="text-right font-medium">
                            {res.total_amount.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {res.memo ?? '-'}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={3} className="font-bold">기타매출 합계</TableCell>
                    <TableCell className="text-right font-bold">
                      {otherRevenueAmount.toLocaleString()}원
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
          </div>
        </div>
      </div>
      <ReservationDialog />
      <HourlyDialog />
      <OtherRevenueDialog />
    </>
  )
}
