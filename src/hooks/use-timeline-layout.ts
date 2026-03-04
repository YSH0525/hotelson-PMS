import { useMemo } from 'react'
import { format, subDays, isSameMonth } from 'date-fns'
import { getDaysInRange, isToday } from '@/lib/date-utils'
import { TIMELINE_CELL_WIDTH, TIMELINE_TODAY_CELL_WIDTH } from '@/lib/constants'

// ── 타입 정의 ──

export interface DayLayout {
  date: Date
  dateStr: string      // 'yyyy-MM-dd'
  index: number        // 필터링 후 인덱스
  xOffset: number      // 이 날짜 셀의 시작 x 좌표 (px)
  width: number        // 이 날짜 셀의 너비 (px)
  isToday: boolean
}

export interface TimelineLayout {
  days: DayLayout[]
  totalWidth: number
  dateToLayout: Map<string, DayLayout>

  /** 예약 바의 left/width 반환 (표시 범위 밖이면 null) */
  getBarPosition: (checkInDate: string, checkOutDate: string) => { left: number; width: number } | null

  /** 픽셀 x 좌표 → 해당 날짜 DayLayout 반환 */
  getDateAtX: (x: number) => DayLayout | null
}

// ── 메인 훅 ──

export function useTimelineLayout(
  startDate: Date,
  daysToShow: number,
  hidePastDays: boolean,
): TimelineLayout {
  return useMemo(() => {
    const allDays = getDaysInRange(startDate, daysToShow)
    const today = new Date()
    const yesterday = subDays(today, 1)
    const yesterdayStr = format(yesterday, 'yyyy-MM-dd')

    // 과거 날짜 필터링: 현재 월이고 hidePastDays=true이면 어제부터만 표시
    let filteredDays: Date[]
    if (hidePastDays && isSameMonth(startDate, today)) {
      filteredDays = allDays.filter((day) => {
        const dateStr = format(day, 'yyyy-MM-dd')
        return dateStr >= yesterdayStr
      })
    } else {
      filteredDays = allDays
    }

    // xOffset 누적 계산
    let cumulativeX = 0
    const days: DayLayout[] = filteredDays.map((date, index) => {
      const dateStr = format(date, 'yyyy-MM-dd')
      const isTodayDate = isToday(date)
      const width = isTodayDate ? TIMELINE_TODAY_CELL_WIDTH : TIMELINE_CELL_WIDTH
      const layout: DayLayout = {
        date,
        dateStr,
        index,
        xOffset: cumulativeX,
        width,
        isToday: isTodayDate,
      }
      cumulativeX += width
      return layout
    })

    const totalWidth = cumulativeX
    const dateToLayout = new Map(days.map((d) => [d.dateStr, d]))

    // 예약 바 위치 계산
    const getBarPosition = (checkInDate: string, checkOutDate: string): { left: number; width: number } | null => {
      if (days.length === 0) return null

      const firstDateStr = days[0].dateStr
      const lastLayout = days[days.length - 1]
      const endBound = lastLayout.xOffset + lastLayout.width

      // 완전히 범위 밖
      if (checkOutDate <= firstDateStr) return null
      if (checkInDate >= format(subDays(new Date(lastLayout.dateStr + 'T00:00:00'), -1), 'yyyy-MM-dd')) {
        // checkIn이 마지막 날 다음날 이후면 범위 밖
      }

      // 대실/기타매출: 같은 날 (check_in === check_out)
      if (checkInDate === checkOutDate) {
        const dayLayout = dateToLayout.get(checkInDate)
        if (!dayLayout) return null
        return {
          left: dayLayout.xOffset + 2,
          width: dayLayout.width - 4,
        }
      }

      // 숙박: 여러 날에 걸침
      // 시작 위치
      const startLayout = dateToLayout.get(checkInDate)
      const left = startLayout ? startLayout.xOffset + 2 : 2

      // 끝 위치: checkOutDate의 셀 시작점까지 (체크아웃일은 바에 포함되지 않음)
      const endLayout = dateToLayout.get(checkOutDate)
      let right: number
      if (endLayout) {
        right = endLayout.xOffset - 2
      } else {
        // checkOutDate가 표시 범위를 넘으면 끝까지
        if (checkOutDate > lastLayout.dateStr) {
          right = endBound - 2
        } else {
          // checkOutDate가 표시 범위 이전이면 표시하지 않음
          return null
        }
      }

      const width = right - left
      if (width <= 0) return null
      return { left, width }
    }

    // 픽셀 좌표 → 날짜 변환
    const getDateAtX = (x: number): DayLayout | null => {
      for (let i = days.length - 1; i >= 0; i--) {
        if (x >= days[i].xOffset) return days[i]
      }
      return days.length > 0 ? days[0] : null
    }

    return { days, totalWidth, dateToLayout, getBarPosition, getDateAtX }
  }, [startDate, daysToShow, hidePastDays])
}
