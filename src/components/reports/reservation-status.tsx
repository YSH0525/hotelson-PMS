'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, differenceInDays, subDays, eachDayOfInterval, startOfYear, eachMonthOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { extractChannelKey } from '@/lib/channels'
import { useChannelOptions } from '@/hooks/use-channel-options'
import { RESERVATION_STATUS } from '@/lib/constants'
import type { Reservation, Room, RoomType } from '@/types/database'

export interface ReservationStatusProps {
  reservations: Reservation[]
  cancelledReservations: Reservation[]
  rooms: Room[]
  roomTypes: RoomType[]
  period: 'daily' | 'monthly' | 'yearly'
  referenceDate: Date
}

export function ReservationStatus({
  reservations,
  cancelledReservations,
  rooms,
  roomTypes,
  period,
  referenceDate,
}: ReservationStatusProps) {
  const { getLabel: getChannelLabel } = useChannelOptions()
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  // 오늘 기준 실시간 데이터 (별도 쿼리)
  const supabase = createClient()
  const { data: todayReservations = [] } = useQuery({
    queryKey: ['todayReservations', todayStr],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .or(`check_in_date.eq.${todayStr},check_out_date.eq.${todayStr},and(check_in_date.lte.${todayStr},check_out_date.gt.${todayStr})`)
        .not('status', 'in', '("cancelled","no_show")')
      return (data ?? []) as Reservation[]
    },
    refetchInterval: 60_000,
  })

  // 오늘 체크인 예정 (숙박)
  const arrivals = useMemo(
    () => todayReservations.filter(
      (r) => r.check_in_date === todayStr && (!r.entry_type || r.entry_type === 'stay') && r.status === 'confirmed',
    ),
    [todayReservations, todayStr],
  )

  // 오늘 체크아웃 예정
  const departures = useMemo(
    () => todayReservations.filter(
      (r) => r.check_out_date === todayStr && (!r.entry_type || r.entry_type === 'stay') && r.status === 'checked_in',
    ),
    [todayReservations, todayStr],
  )

  // 투숙 중 (체크인 < 오늘 < 체크아웃)
  const inHouse = useMemo(
    () => todayReservations.filter(
      (r) =>
        (!r.entry_type || r.entry_type === 'stay') &&
        r.status === 'checked_in' &&
        r.check_in_date <= todayStr &&
        r.check_out_date > todayStr,
    ),
    [todayReservations, todayStr],
  )

  // 판매 가능 빈 객실
  const availableRoomCount = useMemo(
    () => rooms.filter((r) => r.status === 'available').length,
    [rooms],
  )
  const occupiedRoomIds = useMemo(() => {
    const ids = new Set<string>()
    todayReservations
      .filter((r) => (!r.entry_type || r.entry_type === 'stay') && r.check_in_date <= todayStr && r.check_out_date > todayStr)
      .forEach((r) => ids.add(r.room_id))
    return ids
  }, [todayReservations, todayStr])
  const emptyRoomCount = availableRoomCount - occupiedRoomIds.size

  // 객실타입명 매핑
  const roomTypeMap = useMemo(() => {
    const map = new Map<string, string>()
    roomTypes.forEach((rt) => map.set(rt.id, rt.name))
    return map
  }, [roomTypes])

  // 객실번호 매핑
  const roomMap = useMemo(() => {
    const map = new Map<string, Room>()
    rooms.forEach((r) => map.set(r.id, r))
    return map
  }, [rooms])

  // ── 취소/노쇼 분석 (기간 연동) ──
  const cancelCount = cancelledReservations.filter((r) => r.status === 'cancelled').length
  const noshowCount = cancelledReservations.filter((r) => r.status === 'no_show').length
  const totalWithCancelled = reservations.length + cancelledReservations.length
  const cancelRate = totalWithCancelled > 0 ? Math.round((cancelCount / totalWithCancelled) * 1000) / 10 : 0
  const noshowRate = totalWithCancelled > 0 ? Math.round((noshowCount / totalWithCancelled) * 1000) / 10 : 0

  // 채널별 취소/노쇼
  const channelCancelData = useMemo(() => {
    const map = new Map<string, { total: number; cancelled: number; noshow: number }>()
    const allRes = [...reservations, ...cancelledReservations]
    allRes.forEach((r) => {
      if (!r.entry_type || r.entry_type === 'stay') {
        const ch = getChannelLabel(extractChannelKey(r.custom_fields as Record<string, unknown>))
        const existing = map.get(ch) || { total: 0, cancelled: 0, noshow: 0 }
        existing.total += 1
        if (r.status === 'cancelled') existing.cancelled += 1
        if (r.status === 'no_show') existing.noshow += 1
        map.set(ch, existing)
      }
    })
    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        취소: data.cancelled,
        노쇼: data.noshow,
        정상: data.total - data.cancelled - data.noshow,
      }))
      .filter((d) => d.취소 > 0 || d.노쇼 > 0 || d.정상 > 0)
  }, [reservations, cancelledReservations])

  return (
    <div className="space-y-6">
      {/* 오늘 실시간 현황 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">🛬 체크인 예정</p>
            <p className="text-2xl font-bold text-blue-500">{arrivals.length}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">🛫 체크아웃 예정</p>
            <p className="text-2xl font-bold text-amber-500">{departures.length}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">🏨 투숙 중</p>
            <p className="text-2xl font-bold text-emerald-500">{inHouse.length}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">🚪 빈 객실</p>
            <p className="text-2xl font-bold">{emptyRoomCount > 0 ? emptyRoomCount : 0}실</p>
          </CardContent>
        </Card>
      </div>

      {/* 체크인 예정 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">오늘 체크인 예정 ({arrivals.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {arrivals.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">체크인 예정 예약이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>객실</TableHead>
                  <TableHead>투숙객</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>체크아웃</TableHead>
                  <TableHead className="text-right">박수</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                  <TableHead>채널</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {arrivals.map((r) => {
                  const room = roomMap.get(r.room_id)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {room?.room_number ?? '-'}호
                        <span className="text-xs text-muted-foreground ml-1">
                          ({roomTypeMap.get(r.room_type_id) ?? '-'})
                        </span>
                      </TableCell>
                      <TableCell>{r.guest_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.guest_phone ?? '-'}</TableCell>
                      <TableCell>{r.check_out_date}</TableCell>
                      <TableCell className="text-right">{r.nights ?? '-'}박</TableCell>
                      <TableCell className="text-right font-medium">{r.total_amount.toLocaleString()}원</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {getChannelLabel(extractChannelKey(r.custom_fields as Record<string, unknown>))}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 체크아웃 예정 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">오늘 체크아웃 예정 ({departures.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {departures.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">체크아웃 예정 예약이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>객실</TableHead>
                  <TableHead>투숙객</TableHead>
                  <TableHead>연락처</TableHead>
                  <TableHead>체크인일</TableHead>
                  <TableHead className="text-right">박수</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departures.map((r) => {
                  const room = roomMap.get(r.room_id)
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {room?.room_number ?? '-'}호
                        <span className="text-xs text-muted-foreground ml-1">
                          ({roomTypeMap.get(r.room_type_id) ?? '-'})
                        </span>
                      </TableCell>
                      <TableCell>{r.guest_name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.guest_phone ?? '-'}</TableCell>
                      <TableCell>{r.check_in_date}</TableCell>
                      <TableCell className="text-right">{r.nights ?? '-'}박</TableCell>
                      <TableCell className="text-right font-medium">{r.total_amount.toLocaleString()}원</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 투숙 중 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">현재 투숙 중 ({inHouse.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {inHouse.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">투숙 중인 예약이 없습니다.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>객실</TableHead>
                  <TableHead>투숙객</TableHead>
                  <TableHead>체크인일</TableHead>
                  <TableHead>체크아웃 예정</TableHead>
                  <TableHead className="text-right">잔여</TableHead>
                  <TableHead className="text-right">금액</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inHouse.map((r) => {
                  const room = roomMap.get(r.room_id)
                  const remainDays = differenceInDays(new Date(r.check_out_date + 'T00:00:00'), new Date(todayStr + 'T00:00:00'))
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {room?.room_number ?? '-'}호
                        <span className="text-xs text-muted-foreground ml-1">
                          ({roomTypeMap.get(r.room_type_id) ?? '-'})
                        </span>
                      </TableCell>
                      <TableCell>{r.guest_name}</TableCell>
                      <TableCell>{r.check_in_date}</TableCell>
                      <TableCell>{r.check_out_date}</TableCell>
                      <TableCell className="text-right">{remainDays}박</TableCell>
                      <TableCell className="text-right font-medium">{r.total_amount.toLocaleString()}원</TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 취소/노쇼 분석 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">취소 건수</p>
            <p className="text-2xl font-bold text-red-500">{cancelCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">노쇼 건수</p>
            <p className="text-2xl font-bold text-orange-500">{noshowCount}건</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">취소율</p>
            <p className="text-2xl font-bold">{cancelRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">노쇼율</p>
            <p className="text-2xl font-bold">{noshowRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* 채널별 취소/노쇼 차트 */}
      {channelCancelData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널별 예약 상태</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelCancelData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip />
                <Legend />
                <Bar dataKey="정상" stackId="status" fill="#3B82F6" />
                <Bar dataKey="취소" stackId="status" fill="#EF4444" />
                <Bar dataKey="노쇼" stackId="status" fill="#F97316" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
