'use client'

import { useMemo } from 'react'
import { format, subDays, eachDayOfInterval, startOfYear, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ComposedChart, Line,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { Reservation, Room, RoomType } from '@/types/database'

export interface RevenueAnalysisProps {
  reservations: Reservation[]
  rooms: Room[]
  roomTypes: RoomType[]
  period: 'daily' | 'monthly' | 'yearly'
  referenceDate: Date
}

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export function RevenueAnalysis({
  reservations,
  rooms,
  roomTypes,
  period,
  referenceDate,
}: RevenueAnalysisProps) {

  const availableRooms = useMemo(
    () => rooms.filter((r) => r.status === 'available'),
    [rooms],
  )
  const availableRoomCount = availableRooms.length

  // 숙박 예약만
  const stayReservations = useMemo(
    () => reservations.filter((r) => !r.entry_type || r.entry_type === 'stay'),
    [reservations],
  )

  const stayRevenue = stayReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const totalRevenue = reservations.reduce((sum, r) => sum + r.total_amount, 0)
  const totalRoomNightsSold = stayReservations.reduce((sum, r) => sum + (r.nights ?? 0), 0)

  // 기간 일수
  const periodDays = useMemo(() => {
    if (period === 'daily') return 31
    if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const end = endOfMonth(referenceDate)
      return eachDayOfInterval({ start, end }).length
    }
    return 365 * 3
  }, [period, referenceDate])

  const adr = totalRoomNightsSold > 0 ? Math.round(stayRevenue / totalRoomNightsSold) : 0
  const revpar = availableRoomCount > 0 && periodDays > 0
    ? Math.round(stayRevenue / (availableRoomCount * periodDays))
    : 0
  const occupancyRate = availableRoomCount > 0 && periodDays > 0
    ? Math.round((totalRoomNightsSold / (availableRoomCount * periodDays)) * 1000) / 10
    : 0

  // ── ADR & RevPAR 추이 차트 ──
  const kpiTrendData = useMemo(() => {
    if (period === 'daily') {
      const start = subDays(referenceDate, 30)
      const days = eachDayOfInterval({ start, end: referenceDate })
      return days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayStay = stayReservations.filter(
          (r) => r.check_in_date <= dateStr && r.check_out_date > dateStr,
        )
        const dayRevenue = dayStay.reduce((sum, r) => sum + Math.round(r.total_amount / (r.nights || 1)), 0)
        const occupied = dayStay.length
        const dayAdr = occupied > 0 ? Math.round(dayRevenue / occupied) : 0
        const dayRevpar = availableRoomCount > 0 ? Math.round(dayRevenue / availableRoomCount) : 0
        return {
          date: format(day, 'M/d'),
          ADR: dayAdr,
          RevPAR: dayRevpar,
          점유율: availableRoomCount > 0 ? Math.round((occupied / availableRoomCount) * 100) : 0,
        }
      })
    } else if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const months = eachMonthOfInterval({ start, end: referenceDate })
      return months.map((month) => {
        const mStart = startOfMonth(month)
        const mEnd = endOfMonth(month)
        const daysInMonth = eachDayOfInterval({ start: mStart, end: mEnd })
        const monthStr = format(month, 'yyyy-MM')
        const monthStay = stayReservations.filter((r) => r.check_in_date.startsWith(monthStr))
        const monthRevenue = monthStay.reduce((sum, r) => sum + r.total_amount, 0)
        const monthNights = monthStay.reduce((sum, r) => sum + (r.nights ?? 0), 0)
        const monthAdr = monthNights > 0 ? Math.round(monthRevenue / monthNights) : 0
        const monthRevpar = availableRoomCount > 0
          ? Math.round(monthRevenue / (availableRoomCount * daysInMonth.length))
          : 0
        return {
          date: format(month, 'M월', { locale: ko }),
          ADR: monthAdr,
          RevPAR: monthRevpar,
          점유율: availableRoomCount > 0 && daysInMonth.length > 0
            ? Math.round((monthNights / (availableRoomCount * daysInMonth.length)) * 100)
            : 0,
        }
      })
    } else {
      const startYear = referenceDate.getFullYear() - 2
      const endYear = referenceDate.getFullYear()
      const years: number[] = []
      for (let y = startYear; y <= endYear; y++) years.push(y)
      return years.map((year) => {
        const yearStr = String(year)
        const yearStay = stayReservations.filter((r) => r.check_in_date.startsWith(yearStr))
        const yearRevenue = yearStay.reduce((sum, r) => sum + r.total_amount, 0)
        const yearNights = yearStay.reduce((sum, r) => sum + (r.nights ?? 0), 0)
        const yearAdr = yearNights > 0 ? Math.round(yearRevenue / yearNights) : 0
        const yearRevpar = availableRoomCount > 0 ? Math.round(yearRevenue / (availableRoomCount * 365)) : 0
        return {
          date: `${year}년`,
          ADR: yearAdr,
          RevPAR: yearRevpar,
          점유율: availableRoomCount > 0 ? Math.round((yearNights / (availableRoomCount * 365)) * 100) : 0,
        }
      })
    }
  }, [period, referenceDate, stayReservations, availableRoomCount])

  // ── 객실 타입별 실적 ──
  const roomTypeData = useMemo(() => {
    return roomTypes.map((rt) => {
      const typeRooms = availableRooms.filter((r) => r.room_type_id === rt.id)
      const typeRoomCount = typeRooms.length
      const typeReservations = stayReservations.filter((r) => r.room_type_id === rt.id)
      const typeRevenue = typeReservations.reduce((sum, r) => sum + r.total_amount, 0)
      const typeNights = typeReservations.reduce((sum, r) => sum + (r.nights ?? 0), 0)
      const typeOccupancy = typeRoomCount > 0 && periodDays > 0
        ? Math.round((typeNights / (typeRoomCount * periodDays)) * 1000) / 10
        : 0
      const typeAdr = typeNights > 0 ? Math.round(typeRevenue / typeNights) : 0
      const typeRevpar = typeRoomCount > 0 && periodDays > 0
        ? Math.round(typeRevenue / (typeRoomCount * periodDays))
        : 0
      return {
        id: rt.id,
        name: rt.name,
        color: rt.color,
        roomCount: typeRoomCount,
        nights: typeNights,
        occupancy: typeOccupancy,
        revenue: typeRevenue,
        adr: typeAdr,
        revpar: typeRevpar,
      }
    }).filter((d) => d.roomCount > 0)
  }, [roomTypes, availableRooms, stayReservations, periodDays])

  // 객실 타입별 매출 파이 데이터
  const roomTypePieData = roomTypeData.filter((d) => d.revenue > 0)

  // ── 결제 수단별 정산 ──
  const paymentSummary = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    reservations.forEach((r) => {
      const fields = (r.custom_fields ?? {}) as Record<string, unknown>
      const method = String(fields['field_payment_type'] ?? '기타')
      const existing = map.get(method) || { count: 0, amount: 0 }
      map.set(method, { count: existing.count + 1, amount: existing.amount + r.total_amount })
    })
    const totalAmount = reservations.reduce((sum, r) => sum + r.total_amount, 0)
    return Array.from(map.entries())
      .map(([method, data]) => ({
        method,
        count: data.count,
        amount: data.amount,
        percent: totalAmount > 0 ? Math.round((data.amount / totalAmount) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
  }, [reservations])

  const paymentTotal = paymentSummary.reduce((sum, p) => sum + p.amount, 0)
  const paymentCount = paymentSummary.reduce((sum, p) => sum + p.count, 0)

  return (
    <div className="space-y-6">
      {/* 핵심 KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">ADR (평균 객실 단가)</p>
            <p className="text-2xl font-bold text-blue-500">{adr.toLocaleString()}원</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">RevPAR</p>
            <p className="text-2xl font-bold text-emerald-500">{revpar.toLocaleString()}원</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">총 매출</p>
            <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}원</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">객실 점유율</p>
            <p className="text-2xl font-bold">{occupancyRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* ADR & RevPAR 추이 차트 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">ADR · RevPAR · 점유율 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {kpiTrendData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <ComposedChart data={kpiTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis yAxisId="left" fontSize={12}
                  tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(0)}만` : String(v)}
                />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} unit="%" fontSize={12} />
                <Tooltip formatter={(value, name) => {
                  const v = Number(value ?? 0)
                  if (name === '점유율') return [`${v}%`, name]
                  return [`${v.toLocaleString()}원`, name]
                }} />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="ADR" stroke="#3B82F6" strokeWidth={2} dot={false} />
                <Line yAxisId="left" type="monotone" dataKey="RevPAR" stroke="#10B981" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="점유율" stroke="#6B7280" strokeWidth={2} dot={false} strokeDasharray="5 5" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 하단 2열 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 객실 타입별 실적 테이블 */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="text-base">객실 타입별 실적</CardTitle>
          </CardHeader>
          <CardContent>
            {roomTypeData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">데이터가 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>객실타입</TableHead>
                    <TableHead className="text-right">총객실</TableHead>
                    <TableHead className="text-right">판매 객실일수</TableHead>
                    <TableHead className="text-right">점유율</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                    <TableHead className="text-right">ADR</TableHead>
                    <TableHead className="text-right">RevPAR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomTypeData.map((rt) => (
                    <TableRow key={rt.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rt.color }} />
                          <span className="font-medium">{rt.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{rt.roomCount}실</TableCell>
                      <TableCell className="text-right">{rt.nights}일</TableCell>
                      <TableCell className="text-right">{rt.occupancy}%</TableCell>
                      <TableCell className="text-right font-medium">{rt.revenue.toLocaleString()}원</TableCell>
                      <TableCell className="text-right">{rt.adr > 0 ? `${rt.adr.toLocaleString()}원` : '-'}</TableCell>
                      <TableCell className="text-right">{rt.revpar > 0 ? `${rt.revpar.toLocaleString()}원` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">합계</TableCell>
                    <TableCell className="text-right font-bold">{availableRoomCount}실</TableCell>
                    <TableCell className="text-right font-bold">{totalRoomNightsSold}일</TableCell>
                    <TableCell className="text-right font-bold">{occupancyRate}%</TableCell>
                    <TableCell className="text-right font-bold">{stayRevenue.toLocaleString()}원</TableCell>
                    <TableCell className="text-right font-bold">{adr > 0 ? `${adr.toLocaleString()}원` : '-'}</TableCell>
                    <TableCell className="text-right font-bold">{revpar > 0 ? `${revpar.toLocaleString()}원` : '-'}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 객실 타입별 매출 비중 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">객실 타입별 매출 비중</CardTitle>
          </CardHeader>
          <CardContent>
            {roomTypePieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={roomTypePieData}
                    cx="50%" cy="50%"
                    outerRadius={90}
                    dataKey="revenue"
                    nameKey="name"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {roomTypePieData.map((item, idx) => (
                      <Cell key={idx} fill={item.color || CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value ?? 0).toLocaleString()}원`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 결제 수단별 정산 테이블 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">결제 수단별 정산</CardTitle>
          </CardHeader>
          <CardContent>
            {paymentSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>결제수단</TableHead>
                    <TableHead className="text-right">건수</TableHead>
                    <TableHead className="text-right">금액</TableHead>
                    <TableHead className="text-right">비중</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentSummary.map((p) => (
                    <TableRow key={p.method}>
                      <TableCell className="font-medium">{p.method}</TableCell>
                      <TableCell className="text-right">{p.count}건</TableCell>
                      <TableCell className="text-right font-medium">{p.amount.toLocaleString()}원</TableCell>
                      <TableCell className="text-right">{p.percent}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">합계</TableCell>
                    <TableCell className="text-right font-bold">{paymentCount}건</TableCell>
                    <TableCell className="text-right font-bold">{paymentTotal.toLocaleString()}원</TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
