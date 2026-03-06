'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, subDays, endOfMonth, eachDayOfInterval, startOfYear, eachMonthOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarDays } from 'lucide-react'
import {
  ComposedChart, Line,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import { ENTRY_TYPE } from '@/lib/constants'
import { extractChannelKey } from '@/lib/channels'
import { useChannelOptions } from '@/hooks/use-channel-options'
import { ChannelAnalytics } from '@/components/reports/channel-analytics'
import { ReservationStatus } from '@/components/reports/reservation-status'
import { RevenueAnalysis } from '@/components/reports/revenue-analysis'
import type { Reservation, Room, RoomType } from '@/types/database'

const CHART_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

const ENTRY_TYPE_COLORS = {
  stay: '#3B82F6',
  hourly: '#F59E0B',
  other_revenue: '#10B981',
} as const

type ViewType = 'overview' | 'status' | 'revenue' | 'channel'

const VIEW_TABS: { key: ViewType; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'status', label: '예약 현황' },
  { key: 'revenue', label: '수익 분석' },
  { key: 'channel', label: '채널 분석' },
]

export default function ReportsPage() {
  const [view, setView] = useState<ViewType>('overview')
  const [period, setPeriod] = useState<'daily' | 'monthly' | 'yearly'>('daily')
  const [referenceDate, setReferenceDate] = useState(new Date())
  const supabase = createClient()
  const { getLabel: getChannelLabel } = useChannelOptions()

  // 기간에 따른 조회 범위
  const { startDate, endDate } = useMemo(() => {
    if (period === 'daily') {
      const start = subDays(referenceDate, 30)
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(referenceDate, 'yyyy-MM-dd') }
    } else if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const end = endOfMonth(referenceDate)
      return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') }
    } else {
      const start = `${referenceDate.getFullYear() - 2}-01-01`
      const end = `${referenceDate.getFullYear()}-12-31`
      return { startDate: start, endDate: end }
    }
  }, [period, referenceDate])

  // 전체 예약 (취소/노쇼 포함)
  const { data: allReservations = [] } = useQuery({
    queryKey: ['reportAllReservations', startDate, endDate],
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('*')
        .gte('check_in_date', startDate)
        .lte('check_in_date', endDate)
      return (data ?? []) as Reservation[]
    },
  })

  // 유효 예약 (취소/노쇼 제외)
  const reservations = useMemo(
    () => allReservations.filter((r) => r.status !== 'cancelled' && r.status !== 'no_show'),
    [allReservations],
  )

  // 취소/노쇼 예약
  const cancelledReservations = useMemo(
    () => allReservations.filter((r) => r.status === 'cancelled' || r.status === 'no_show'),
    [allReservations],
  )

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
      const { data } = await supabase.from('room_types').select('*').order('sort_order')
      return (data ?? []) as RoomType[]
    },
  })

  // 판매 가능 객실 수
  const availableRoomCount = useMemo(
    () => rooms.filter((r) => r.status === 'available').length,
    [rooms],
  )

  // entry_type별 분류
  const stayReservations = useMemo(
    () => reservations.filter((r) => !r.entry_type || r.entry_type === 'stay'),
    [reservations],
  )
  const hourlyReservations = useMemo(
    () => reservations.filter((r) => r.entry_type === 'hourly'),
    [reservations],
  )
  const otherRevenueReservations = useMemo(
    () => reservations.filter((r) => r.entry_type === 'other_revenue'),
    [reservations],
  )

  // 매출 계산
  const totalRevenue = reservations.reduce((sum, r) => sum + r.total_amount, 0)
  const stayRevenue = stayReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const hourlyRevenue = hourlyReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const otherRevenue = otherRevenueReservations.reduce((sum, r) => sum + r.total_amount, 0)
  const totalBookings = reservations.length
  const stayBookings = stayReservations.length

  // 기간 일수 계산 (RevPAR용)
  const periodDays = useMemo(() => {
    if (period === 'daily') return 31
    if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const end = endOfMonth(referenceDate)
      return eachDayOfInterval({ start, end }).length
    }
    return 365 * 3
  }, [period, referenceDate])

  // 판매 객실일수 (숙박 nights 합계)
  const totalRoomNightsSold = stayReservations.reduce((sum, r) => sum + (r.nights ?? 0), 0)

  // 핵심 KPI
  const adr = totalRoomNightsSold > 0 ? Math.round(stayRevenue / totalRoomNightsSold) : 0
  const revpar = availableRoomCount > 0 && periodDays > 0
    ? Math.round(stayRevenue / (availableRoomCount * periodDays))
    : 0

  // ── 개요 차트 데이터 ──

  const entryTypeData = useMemo(() => {
    return [
      { name: ENTRY_TYPE.stay.label, value: stayRevenue, color: ENTRY_TYPE_COLORS.stay },
      { name: ENTRY_TYPE.hourly.label, value: hourlyRevenue, color: ENTRY_TYPE_COLORS.hourly },
      { name: ENTRY_TYPE.other_revenue.label, value: otherRevenue, color: ENTRY_TYPE_COLORS.other_revenue },
    ].filter((d) => d.value > 0)
  }, [stayRevenue, hourlyRevenue, otherRevenue])

  const dailyOccupancyData = useMemo(() => {
    if (period !== 'daily' || rooms.length === 0) return []
    const start = subDays(referenceDate, 30)
    const days = eachDayOfInterval({ start, end: referenceDate })
    return days.map((day) => {
      const dateStr = format(day, 'yyyy-MM-dd')
      const stayOccupied = reservations.filter(
        (r) => (!r.entry_type || r.entry_type === 'stay') && r.check_in_date <= dateStr && r.check_out_date > dateStr,
      ).length
      const dayReservations = reservations.filter((r) => r.check_in_date === dateStr)
      const dayStay = dayReservations.filter((r) => !r.entry_type || r.entry_type === 'stay')
      const dayHourly = dayReservations.filter((r) => r.entry_type === 'hourly')
      const dayOther = dayReservations.filter((r) => r.entry_type === 'other_revenue')
      return {
        date: format(day, 'M/d'),
        점유율: Math.round((stayOccupied / rooms.length) * 100),
        숙박매출: dayStay.reduce((sum, r) => sum + r.total_amount, 0),
        대실매출: dayHourly.reduce((sum, r) => sum + r.total_amount, 0),
        기타매출: dayOther.reduce((sum, r) => sum + r.total_amount, 0),
      }
    })
  }, [period, referenceDate, reservations, rooms])

  const monthlyData = useMemo(() => {
    if (period !== 'monthly') return []
    const start = startOfYear(referenceDate)
    const months = eachMonthOfInterval({ start, end: referenceDate })
    return months.map((month) => {
      const monthStr = format(month, 'yyyy-MM')
      const monthRes = reservations.filter((r) => r.check_in_date.startsWith(monthStr))
      const monthStay = monthRes.filter((r) => !r.entry_type || r.entry_type === 'stay')
      const monthHourly = monthRes.filter((r) => r.entry_type === 'hourly')
      const monthOther = monthRes.filter((r) => r.entry_type === 'other_revenue')
      return {
        month: format(month, 'M월', { locale: ko }),
        예약수: monthRes.length,
        숙박매출: monthStay.reduce((sum, r) => sum + r.total_amount, 0),
        대실매출: monthHourly.reduce((sum, r) => sum + r.total_amount, 0),
        기타매출: monthOther.reduce((sum, r) => sum + r.total_amount, 0),
      }
    })
  }, [period, referenceDate, reservations])

  const channelData = useMemo(() => {
    const channelMap = new Map<string, { count: number; amount: number }>()
    reservations.forEach((r) => {
      const channelKey = extractChannelKey(r.custom_fields as Record<string, unknown>)
      const label = getChannelLabel(channelKey)
      const existing = channelMap.get(label) || { count: 0, amount: 0 }
      channelMap.set(label, { count: existing.count + 1, amount: existing.amount + r.total_amount })
    })
    return Array.from(channelMap.entries()).map(([name, data]) => ({
      name, value: data.count, amount: data.amount,
    }))
  }, [reservations])

  const paymentData = useMemo(() => {
    const map = new Map<string, { count: number; amount: number }>()
    reservations.forEach((r) => {
      const fields = (r.custom_fields ?? {}) as Record<string, unknown>
      const method = String(fields['field_payment_type'] ?? '기타')
      const existing = map.get(method) || { count: 0, amount: 0 }
      map.set(method, { count: existing.count + 1, amount: existing.amount + r.total_amount })
    })
    return Array.from(map.entries()).map(([name, data]) => ({
      name, value: data.count, amount: data.amount,
    }))
  }, [reservations])

  return (
    <>
      <Header title="보고서" />
      <div className="p-6 space-y-6">
        {/* 뷰 토글 + 기간 선택 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {VIEW_TABS.map((tab) => (
                <Button
                  key={tab.key}
                  variant={view === tab.key ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView(tab.key)}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as typeof period)}>
              <TabsList>
                <TabsTrigger value="daily">일별</TabsTrigger>
                <TabsTrigger value="monthly">월별</TabsTrigger>
                <TabsTrigger value="yearly">연간</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                <CalendarDays className="h-4 w-4 mr-1" />
                {format(referenceDate, 'yyyy-MM-dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={referenceDate}
                onSelect={(d) => d && setReferenceDate(d)}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* 예약 현황 뷰 */}
        {view === 'status' && (
          <ReservationStatus
            reservations={reservations}
            cancelledReservations={cancelledReservations}
            rooms={rooms}
            roomTypes={roomTypes}
            period={period}
            referenceDate={referenceDate}
          />
        )}

        {/* 수익 분석 뷰 */}
        {view === 'revenue' && (
          <RevenueAnalysis
            reservations={reservations}
            rooms={rooms}
            roomTypes={roomTypes}
            period={period}
            referenceDate={referenceDate}
          />
        )}

        {/* 채널 분석 뷰 */}
        {view === 'channel' && (
          <ChannelAnalytics
            reservations={reservations}
            cancelledReservations={cancelledReservations}
            rooms={rooms}
            period={period}
            referenceDate={referenceDate}
          />
        )}

        {/* 개요 뷰 */}
        {view === 'overview' && (<>
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">총 매출</p>
              <p className="text-2xl font-bold">{totalRevenue.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{ENTRY_TYPE.stay.icon} 숙박 매출</p>
              <p className="text-2xl font-bold text-blue-500">{stayRevenue.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{ENTRY_TYPE.hourly.icon} 대실 매출</p>
              <p className="text-2xl font-bold text-amber-500">{hourlyRevenue.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">{ENTRY_TYPE.other_revenue.icon} 기타매출</p>
              <p className="text-2xl font-bold text-emerald-500">{otherRevenue.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">예약 건수</p>
              <p className="text-2xl font-bold">{totalBookings}건</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">ADR (평균 객실 단가)</p>
              <p className="text-2xl font-bold">{adr.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">RevPAR</p>
              <p className="text-2xl font-bold">{revpar.toLocaleString()}원</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">취소/노쇼</p>
              <p className="text-2xl font-bold text-red-500">{cancelledReservations.length}건</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {period === 'daily' && (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="text-base">일별 점유율 및 매출 추이</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <ComposedChart data={dailyOccupancyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis yAxisId="left" domain={[0, 100]} unit="%" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip formatter={(value, name) => {
                      const v = Number(value ?? 0)
                      if (name === '점유율') return [`${v}%`, name]
                      return [`${v.toLocaleString()}원`, name]
                    }} />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="점유율" stroke="#6B7280" strokeWidth={2} dot={false} />
                    <Bar yAxisId="right" dataKey="숙박매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.stay} />
                    <Bar yAxisId="right" dataKey="대실매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.hourly} />
                    <Bar yAxisId="right" dataKey="기타매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.other_revenue} />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {period === 'monthly' && (
            <Card className="col-span-full">
              <CardHeader>
                <CardTitle className="text-base">월별 예약 및 매출</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis yAxisId="left" fontSize={12} />
                    <YAxis yAxisId="right" orientation="right" fontSize={12} />
                    <Tooltip formatter={(value, name) => {
                      const v = Number(value ?? 0)
                      if (name === '예약수') return [`${v}건`, name]
                      return [`${v.toLocaleString()}원`, name]
                    }} />
                    <Legend />
                    <Bar yAxisId="left" dataKey="예약수" fill="#6B7280" />
                    <Bar yAxisId="right" dataKey="숙박매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.stay} />
                    <Bar yAxisId="right" dataKey="대실매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.hourly} />
                    <Bar yAxisId="right" dataKey="기타매출" stackId="revenue" fill={ENTRY_TYPE_COLORS.other_revenue} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">매출 유형별 분포</CardTitle></CardHeader>
            <CardContent>
              {entryTypeData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={entryTypeData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, value }) => `${name}: ${value.toLocaleString()}원`}>
                      {entryTypeData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `${Number(value ?? 0).toLocaleString()}원`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">채널별 예약 분포</CardTitle></CardHeader>
            <CardContent>
              {channelData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={channelData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}건`}>
                      {channelData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">결제방식별 분포</CardTitle></CardHeader>
            <CardContent>
              {paymentData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
              ) : (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={paymentData} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, value }) => `${name}: ${value}건`}>
                      {paymentData.map((_, idx) => (
                        <Cell key={idx} fill={CHART_COLORS[(idx + 3) % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
        </>)}
      </div>
    </>
  )
}
