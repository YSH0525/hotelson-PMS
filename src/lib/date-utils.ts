import {
  format,
  addDays,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  differenceInDays,
  isToday,
  isSameMonth,
  isWeekend,
  parseISO,
} from 'date-fns'
import { ko } from 'date-fns/locale'

export function formatDate(date: Date | string, formatStr: string = 'yyyy-MM-dd') {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, formatStr, { locale: ko })
}

export function formatKoreanDate(date: Date | string) {
  return formatDate(date, 'yyyy년 M월 d일 (EEE)')
}

export function getMonthDays(year: number, month: number): Date[] {
  const start = startOfMonth(new Date(year, month - 1))
  const end = endOfMonth(start)
  return eachDayOfInterval({ start, end })
}

export function getDaysInRange(startDate: Date, days: number): Date[] {
  return Array.from({ length: days }, (_, i) => addDays(startDate, i))
}

export function getNights(checkIn: string, checkOut: string): number {
  return differenceInDays(parseISO(checkOut), parseISO(checkIn))
}

export function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd')
}

export { isToday, isSameMonth, isWeekend, parseISO, addDays, differenceInDays, format }
