'use client'

import { useMemo } from 'react'
import { format, subDays, eachDayOfInterval, startOfYear, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { extractChannelKey } from '@/lib/channels'
import { useChannelOptions } from '@/hooks/use-channel-options'
import type { Reservation, Room } from '@/types/database'

// ── 타입 ──

export type PeriodType = 'daily' | 'monthly' | 'yearly'

export interface ChannelAnalyticsProps {
  reservations: Reservation[]
  cancelledReservations: Reservation[]
  rooms: Room[]
  period: PeriodType
  referenceDate: Date
}

interface ChannelSummaryItem {
  channelKey: string
  label: string
  color: string
  count: number
  revenue: number
  revenuePercent: number
  roomNights: number
  adr: number
  cancelCount: number
  noshowCount: number
  cancelRate: number
}

// ── 컴포넌트 ──

export function ChannelAnalytics({ reservations, cancelledReservations, rooms, period, referenceDate }: ChannelAnalyticsProps) {
  const { options: channelOptionsList, getLabel: getChannelLabel, getColor: getChannelColor } = useChannelOptions()
  const channelKeys = useMemo(() => channelOptionsList.map((o) => o.key), [channelOptionsList])

  // ── 1. 채널별 집계 ──
  const channelSummary = useMemo<ChannelSummaryItem[]>(() => {
    const map = new Map<string, { count: number; revenue: number; roomNights: number; cancelCount: number; noshowCount: number }>()

    reservations.forEach((r) => {
      const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
      const existing = map.get(ch) || { count: 0, revenue: 0, roomNights: 0, cancelCount: 0, noshowCount: 0 }
      existing.count += 1
      existing.revenue += r.total_amount
      if (!r.entry_type || r.entry_type === 'stay') {
        existing.roomNights += (r.nights ?? 0)
      }
      map.set(ch, existing)
    })

    // 취소/노쇼 예약을 채널별로 집계
    cancelledReservations.forEach((r) => {
      const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
      const existing = map.get(ch) || { count: 0, revenue: 0, roomNights: 0, cancelCount: 0, noshowCount: 0 }
      if (r.status === 'cancelled') existing.cancelCount += 1
      if (r.status === 'no_show') existing.noshowCount += 1
      map.set(ch, existing)
    })

    const totalRevenue = reservations.reduce((sum, r) => sum + r.total_amount, 0)

    return Array.from(map.entries())
      .map(([channelKey, data]) => {
        const totalForChannel = data.count + data.cancelCount + data.noshowCount
        return {
          channelKey,
          label: getChannelLabel(channelKey),
          color: getChannelColor(channelKey),
          count: data.count,
          revenue: data.revenue,
          revenuePercent: totalRevenue > 0 ? Math.round((data.revenue / totalRevenue) * 1000) / 10 : 0,
          roomNights: data.roomNights,
          adr: data.roomNights > 0 ? Math.round(data.revenue / data.roomNights) : 0,
          cancelCount: data.cancelCount,
          noshowCount: data.noshowCount,
          cancelRate: totalForChannel > 0 ? Math.round(((data.cancelCount + data.noshowCount) / totalForChannel) * 1000) / 10 : 0,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
  }, [reservations, cancelledReservations, getChannelLabel, getChannelColor])

  // ── 2. 활성 채널 키 (데이터에 있는 것만 + 미등록 채널 포함) ──
  const activeChannelKeys = useMemo(() => {
    const keys = new Set<string>()
    reservations.forEach((r) => {
      keys.add(extractChannelKey(r.custom_fields as Record<string, unknown>))
    })
    // 등록 채널 먼저, 미등록 채널 후에
    const registered = channelKeys.filter((k) => keys.has(k))
    const unregistered = Array.from(keys).filter((k) => !channelKeys.includes(k))
    return [...registered, ...unregistered]
  }, [reservations, channelKeys])

  // ── 3. 채널별 매출 추이 ──
  const channelTrendData = useMemo(() => {
    if (period === 'daily') {
      const start = subDays(referenceDate, 30)
      const days = eachDayOfInterval({ start, end: referenceDate })
      return days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const dayRes = reservations.filter((r) => r.check_in_date === dateStr)
        const point: Record<string, number | string> = { date: format(day, 'M/d') }
        activeChannelKeys.forEach((ch) => { point[ch] = 0 })
        dayRes.forEach((r) => {
          const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
          point[ch] = ((point[ch] as number) || 0) + r.total_amount
        })
        return point
      })
    } else if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const months = eachMonthOfInterval({ start, end: referenceDate })
      return months.map((month) => {
        const monthStr = format(month, 'yyyy-MM')
        const monthRes = reservations.filter((r) => r.check_in_date.startsWith(monthStr))
        const point: Record<string, number | string> = { date: format(month, 'M월', { locale: ko }) }
        activeChannelKeys.forEach((ch) => { point[ch] = 0 })
        monthRes.forEach((r) => {
          const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
          point[ch] = ((point[ch] as number) || 0) + r.total_amount
        })
        return point
      })
    } else {
      // yearly
      const startYear = referenceDate.getFullYear() - 2
      const endYear = referenceDate.getFullYear()
      const years: number[] = []
      for (let y = startYear; y <= endYear; y++) years.push(y)
      return years.map((year) => {
        const yearStr = String(year)
        const yearRes = reservations.filter((r) => r.check_in_date.startsWith(yearStr))
        const point: Record<string, number | string> = { date: `${year}년` }
        activeChannelKeys.forEach((ch) => { point[ch] = 0 })
        yearRes.forEach((r) => {
          const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
          point[ch] = ((point[ch] as number) || 0) + r.total_amount
        })
        return point
      })
    }
  }, [period, referenceDate, reservations, activeChannelKeys])

  // ── 4. 채널별 객실 점유 현황 (일별/월별만) ──
  const channelOccupancyData = useMemo(() => {
    if (period === 'daily') {
      const start = subDays(referenceDate, 30)
      const days = eachDayOfInterval({ start, end: referenceDate })
      return days.map((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        const point: Record<string, number | string> = { date: format(day, 'M/d') }
        activeChannelKeys.forEach((ch) => { point[ch] = 0 })
        reservations
          .filter(
            (r) =>
              (!r.entry_type || r.entry_type === 'stay') &&
              r.check_in_date <= dateStr &&
              r.check_out_date > dateStr,
          )
          .forEach((r) => {
            const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
            point[ch] = ((point[ch] as number) || 0) + 1
          })
        return point
      })
    } else if (period === 'monthly') {
      const start = startOfYear(referenceDate)
      const months = eachMonthOfInterval({ start, end: referenceDate })
      return months.map((month) => {
        const mStart = startOfMonth(month)
        const mEnd = endOfMonth(month)
        const daysInMonth = eachDayOfInterval({ start: mStart, end: mEnd })
        const point: Record<string, number | string> = { date: format(month, 'M월', { locale: ko }) }
        const totals: Record<string, number> = {}
        activeChannelKeys.forEach((ch) => { totals[ch] = 0 })

        daysInMonth.forEach((day) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          reservations
            .filter(
              (r) =>
                (!r.entry_type || r.entry_type === 'stay') &&
                r.check_in_date <= dateStr &&
                r.check_out_date > dateStr,
            )
            .forEach((r) => {
              const ch = extractChannelKey(r.custom_fields as Record<string, unknown>)
              totals[ch] = (totals[ch] || 0) + 1
            })
        })

        activeChannelKeys.forEach((ch) => {
          point[ch] = Math.round(totals[ch] / daysInMonth.length)
        })
        return point
      })
    }
    return [] // yearly 생략
  }, [period, referenceDate, reservations, activeChannelKeys])

  // ── 합계 ──
  const totalCount = channelSummary.reduce((s, i) => s + i.count, 0)
  const totalRevenue = channelSummary.reduce((s, i) => s + i.revenue, 0)
  const totalRoomNights = channelSummary.reduce((s, i) => s + i.roomNights, 0)
  const overallAdr = totalRoomNights > 0 ? Math.round(totalRevenue / totalRoomNights) : 0
  const totalCancelCount = channelSummary.reduce((s, i) => s + i.cancelCount, 0)
  const totalNoshowCount = channelSummary.reduce((s, i) => s + i.noshowCount, 0)
  const totalAll = totalCount + totalCancelCount + totalNoshowCount
  const overallCancelRate = totalAll > 0 ? Math.round(((totalCancelCount + totalNoshowCount) / totalAll) * 1000) / 10 : 0

  // ── 상위 4개 채널 KPI 카드 ──
  const topChannels = channelSummary.slice(0, 4)

  return (
    <div className="space-y-6">
      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {topChannels.map((ch) => (
          <Card key={ch.channelKey}>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ch.color }} />
                <p className="text-sm font-medium text-muted-foreground">{ch.label}</p>
              </div>
              <p className="text-2xl font-bold">{ch.revenue.toLocaleString()}원</p>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span>{ch.count}건</span>
                <span>매출비중 {ch.revenuePercent}%</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 채널별 매출 추이 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">채널별 매출 추이</CardTitle>
        </CardHeader>
        <CardContent>
          {channelTrendData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={channelTrendData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis
                  fontSize={12}
                  tickFormatter={(v) => {
                    if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
                    return String(v)
                  }}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value ?? 0).toLocaleString()}원`,
                    getChannelLabel(String(name)),
                  ]}
                />
                <Legend formatter={(value) => getChannelLabel(value)} />
                {activeChannelKeys.map((ch) => (
                  <Bar
                    key={ch}
                    dataKey={ch}
                    stackId="channel"
                    fill={getChannelColor(ch)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* 채널별 객실 점유 현황 (일별/월별만) */}
      {channelOccupancyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              채널별 객실 점유 현황
              {period === 'monthly' && (
                <span className="text-xs font-normal text-muted-foreground ml-2">(일평균)</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={channelOccupancyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value ?? 0)}실`,
                    getChannelLabel(String(name)),
                  ]}
                />
                <Legend formatter={(value) => getChannelLabel(value)} />
                {activeChannelKeys.map((ch) => (
                  <Bar
                    key={ch}
                    dataKey={ch}
                    stackId="occupancy"
                    fill={getChannelColor(ch)}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* 하단: PieChart + 상세 테이블 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 채널별 매출 비중 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널별 매출 비중</CardTitle>
          </CardHeader>
          <CardContent>
            {channelSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={channelSummary}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="revenue"
                    nameKey="label"
                    label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(1)}%`}
                  >
                    {channelSummary.map((item, idx) => (
                      <Cell key={idx} fill={item.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${Number(value ?? 0).toLocaleString()}원`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* 채널별 상세 실적 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">채널별 상세 실적</CardTitle>
          </CardHeader>
          <CardContent>
            {channelSummary.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">데이터가 없습니다.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>채널</TableHead>
                    <TableHead className="text-right">예약 건수</TableHead>
                    <TableHead className="text-right">매출</TableHead>
                    <TableHead className="text-right">비중</TableHead>
                    <TableHead className="text-right">객실일수</TableHead>
                    <TableHead className="text-right">ADR</TableHead>
                    <TableHead className="text-right">취소/노쇼</TableHead>
                    <TableHead className="text-right">취소율</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {channelSummary.map((item) => (
                    <TableRow key={item.channelKey}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-medium">{item.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.count}건</TableCell>
                      <TableCell className="text-right font-medium">
                        {item.revenue.toLocaleString()}원
                      </TableCell>
                      <TableCell className="text-right">{item.revenuePercent}%</TableCell>
                      <TableCell className="text-right">{item.roomNights}일</TableCell>
                      <TableCell className="text-right">
                        {item.adr > 0 ? `${item.adr.toLocaleString()}원` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.cancelCount + item.noshowCount > 0 ? (
                          <span className="text-red-500">
                            {item.cancelCount + item.noshowCount}건
                            <span className="text-xs text-muted-foreground ml-1">
                              ({item.cancelCount}/{item.noshowCount})
                            </span>
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.cancelRate > 0 ? (
                          <span className={item.cancelRate >= 20 ? 'text-red-500 font-medium' : ''}>{item.cancelRate}%</span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">합계</TableCell>
                    <TableCell className="text-right font-bold">{totalCount}건</TableCell>
                    <TableCell className="text-right font-bold">
                      {totalRevenue.toLocaleString()}원
                    </TableCell>
                    <TableCell className="text-right font-bold">100%</TableCell>
                    <TableCell className="text-right font-bold">{totalRoomNights}일</TableCell>
                    <TableCell className="text-right font-bold">
                      {overallAdr > 0 ? `${overallAdr.toLocaleString()}원` : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {totalCancelCount + totalNoshowCount > 0 ? (
                        <span className="text-red-500">
                          {totalCancelCount + totalNoshowCount}건
                          <span className="text-xs text-muted-foreground ml-1">
                            ({totalCancelCount}/{totalNoshowCount})
                          </span>
                        </span>
                      ) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {overallCancelRate > 0 ? `${overallCancelRate}%` : '-'}
                    </TableCell>
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
