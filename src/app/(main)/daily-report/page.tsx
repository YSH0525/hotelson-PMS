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
import { CalendarDays, Printer, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { RESERVATION_STATUS, ENTRY_TYPE, REVENUE_CATEGORIES } from '@/lib/constants'
import type { Reservation, RoomType, Room } from '@/types/database'

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const dateStr = format(selectedDate, 'yyyy-MM-dd')
  const printRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

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
    // 숙박 시트
    const stayRows = stayReservations.map((res) => {
      const room = rooms.find((r) => r.id === res.room_id)
      const roomType = roomTypes.find((rt) => rt.id === res.room_type_id)
      const customFields = (res.custom_fields ?? {}) as Record<string, unknown>
      return {
        '객실타입': roomType?.name ?? '',
        '호실': room?.room_number ? `${room.room_number}호` : '',
        '투숙객': res.guest_name,
        '연락처': res.guest_phone ?? '',
        '체크인': res.check_in_date,
        '체크아웃': res.check_out_date,
        '박수': res.nights,
        '상태': RESERVATION_STATUS[res.status]?.label ?? res.status,
        '금액': res.total_amount,
        '예약채널': String(customFields['field_channel'] ?? ''),
        '결제구분': String(customFields['field_payment_type'] ?? ''),
        '메모': res.memo ?? '',
      }
    })

    // 대실 시트
    const hourlyRows = hourlyReservations.map((res) => {
      const room = rooms.find((r) => r.id === res.room_id)
      return {
        '호실': room?.room_number ? `${room.room_number}호` : '',
        '이용자': res.guest_name,
        '연락처': res.guest_phone ?? '',
        '입실시간': res.check_in_time ?? '',
        '퇴실시간': res.check_out_time ?? '',
        '상태': RESERVATION_STATUS[res.status]?.label ?? res.status,
        '금액': res.total_amount,
        '메모': res.memo ?? '',
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
          {/* 요약 카드 - Row 1: 객실/점유 */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">전체 객실</p>
                <p className="text-2xl font-bold">{totalRooms}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">투숙 (숙박)</p>
                <p className="text-2xl font-bold">{stayOccupied}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">대실</p>
                <p className="text-2xl font-bold">{hourlyCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">점유율</p>
                <p className="text-2xl font-bold">{occupancyRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* 요약 카드 - Row 2: 매출 */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">숙박매출</p>
                <p className="text-2xl font-bold">{stayAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">대실매출</p>
                <p className="text-2xl font-bold">{hourlyAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">기타매출</p>
                <p className="text-2xl font-bold">{otherRevenueAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground">총매출</p>
                <p className="text-2xl font-bold text-primary">{totalAmount.toLocaleString()}원</p>
              </CardContent>
            </Card>
          </div>

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
                    <TableHead className="w-[80px]">객실타입</TableHead>
                    <TableHead className="w-[60px]">호실</TableHead>
                    <TableHead>투숙객</TableHead>
                    <TableHead>연락처</TableHead>
                    <TableHead className="w-[90px]">체크인</TableHead>
                    <TableHead className="w-[90px]">체크아웃</TableHead>
                    <TableHead className="w-[40px]">박</TableHead>
                    <TableHead className="w-[60px]">상태</TableHead>
                    <TableHead className="text-right w-[80px]">금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map(({ roomType, roomData }) =>
                    roomData.map(({ room, reservation }) => (
                      <TableRow key={room.id} className={!reservation ? 'text-muted-foreground' : ''}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: roomType.color }} />
                            <span className="text-xs">{roomType.name}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{room.room_number}호</TableCell>
                        {reservation ? (
                          <>
                            <TableCell>{reservation.guest_name}</TableCell>
                            <TableCell className="text-xs">{reservation.guest_phone ?? '-'}</TableCell>
                            <TableCell className="text-xs">{reservation.check_in_date}</TableCell>
                            <TableCell className="text-xs">{reservation.check_out_date}</TableCell>
                            <TableCell>{reservation.nights}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {RESERVATION_STATUS[reservation.status]?.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {reservation.total_amount.toLocaleString()}
                            </TableCell>
                          </>
                        ) : (
                          <>
                            <TableCell colSpan={7} className="text-center text-xs">
                              — 공실 —
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={8} className="font-bold">숙박 합계</TableCell>
                    <TableCell className="text-right font-bold">
                      {stayAmount.toLocaleString()}원
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* 대실 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {ENTRY_TYPE.hourly.icon} {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 대실
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hourlyReservations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  해당 날짜의 대실 내역이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">호실</TableHead>
                      <TableHead>이용자</TableHead>
                      <TableHead className="w-[120px]">시간</TableHead>
                      <TableHead className="w-[80px]">상태</TableHead>
                      <TableHead className="text-right w-[100px]">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {hourlyReservations.map((res) => {
                      const room = rooms.find((r) => r.id === res.room_id)
                      return (
                        <TableRow key={res.id}>
                          <TableCell className="font-medium">
                            {room?.room_number ? `${room.room_number}호` : '-'}
                          </TableCell>
                          <TableCell>{res.guest_name}</TableCell>
                          <TableCell className="text-xs">
                            {res.check_in_time ?? '-'} ~ {res.check_out_time ?? '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-[10px]">
                              {RESERVATION_STATUS[res.status]?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {res.total_amount.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={4} className="font-bold">대실 합계</TableCell>
                      <TableCell className="text-right font-bold">
                        {hourlyAmount.toLocaleString()}원
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* 기타매출 테이블 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {ENTRY_TYPE.other_revenue.icon} {format(selectedDate, 'yyyy년 M월 d일', { locale: ko })} 기타매출
              </CardTitle>
            </CardHeader>
            <CardContent>
              {otherRevenueEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  해당 날짜의 기타매출 내역이 없습니다.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">호실</TableHead>
                      <TableHead className="w-[100px]">카테고리</TableHead>
                      <TableHead>내역</TableHead>
                      <TableHead className="text-right w-[100px]">금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {otherRevenueEntries.map((res) => {
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
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={3} className="font-bold">기타매출 합계</TableCell>
                      <TableCell className="text-right font-bold">
                        {otherRevenueAmount.toLocaleString()}원
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
