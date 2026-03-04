'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { format, addDays } from 'date-fns'
import { ko } from 'date-fns/locale'
import { X, ChevronLeft, ChevronRight, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useHotkey } from '@/hooks/use-hotkey'
import { useRoomInventory } from '@/hooks/use-room-inventory'
import { usePanelStore } from '@/stores/use-panel-store'

// ── 유틸 ──

const DAY_OPTIONS = [7, 14, 30] as const

function getCellColor(available: number, total: number) {
  if (total === 0) return 'text-zinc-400'
  if (available === 0) return 'text-red-600 font-bold'
  if (available <= 2) return 'text-amber-600 font-bold'
  return 'text-emerald-700 font-semibold'
}

// ── 메인 컴포넌트 ──

export function FloatingInventoryPanel() {
  const { isOpen, position, days, toggle, close, setPosition, setDays } = usePanelStore()
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [mounted, setMounted] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const { dateColumns, rows, totalsByDate, totalRooms } = useRoomInventory(startDate, days)

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])

  // SSR 안전
  useEffect(() => setMounted(true), [])

  // F2 토글
  useHotkey('F2', toggle)

  // ESC 닫기
  useHotkey('Escape', close, isOpen)

  // ── 드래그 핸들러 ──
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      isDragging.current = true
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }

      const onMouseMove = (ev: MouseEvent) => {
        if (!isDragging.current) return
        const newX = Math.max(0, Math.min(ev.clientX - dragOffset.current.x, window.innerWidth - 200))
        const newY = Math.max(0, Math.min(ev.clientY - dragOffset.current.y, window.innerHeight - 100))
        setPosition({ x: newX, y: newY })
      }

      const onMouseUp = () => {
        isDragging.current = false
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [position, setPosition],
  )

  // 날짜 이동
  const goRange = useCallback(
    (delta: number) => {
      const d = addDays(new Date(startDate + 'T00:00:00'), delta)
      setStartDate(format(d, 'yyyy-MM-dd'))
    },
    [startDate],
  )

  const goToday = useCallback(() => {
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
  }, [])

  if (!mounted || !isOpen) return null

  const endDateStr = dateColumns.length > 0 ? dateColumns[dateColumns.length - 1] : startDate

  return (
    <div
      ref={panelRef}
      className="fixed z-50 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-xl rounded-lg shadow-2xl ring-1 ring-black/5 dark:ring-white/10 border border-zinc-200/60 dark:border-zinc-700/60 select-none"
      style={{ left: position.x, top: position.y, maxWidth: '90vw' }}
    >
      {/* 타이틀바 — 드래그 영역 (인디고) */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-indigo-900 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-indigo-300" />
          <span className="text-sm font-semibold text-white">객실 재고</span>
          <span className="text-[10px] px-1.5 py-0 rounded bg-indigo-700 text-indigo-200 font-medium">F2</span>
        </div>
        <div className="flex items-center gap-1">
          {/* 일수 선택 */}
          {DAY_OPTIONS.map((d) => (
            <button
              key={d}
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                days === d
                  ? 'bg-white text-indigo-900 font-bold'
                  : 'text-indigo-300 hover:bg-indigo-800'
              }`}
              onClick={() => setDays(d)}
            >
              {d}일
            </button>
          ))}
          <Button variant="ghost" size="icon" className="h-6 w-6 ml-1 text-indigo-300 hover:text-white hover:bg-indigo-800" onClick={close}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 날짜 범위 네비게이션 */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-700">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => goRange(-days)}>
          <ChevronLeft className="w-3.5 h-3.5" />
        </Button>
        <button
          className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:text-blue-600 transition-colors"
          onClick={goToday}
          title="오늘로 이동"
        >
          {format(new Date(startDate + 'T00:00:00'), 'MM.dd', { locale: ko })}
          {' ~ '}
          {format(new Date(endDateStr + 'T00:00:00'), 'MM.dd', { locale: ko })}
        </button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => goRange(days)}>
          <ChevronRight className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 테이블 */}
      <div className="overflow-x-auto max-h-[60vh]">
        {rows.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-4 px-3">객실 데이터 없음</p>
        ) : (
          <table className="text-[11px] w-full border-collapse">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="sticky left-0 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-sm text-left px-2 py-1.5 text-zinc-800 dark:text-zinc-200 font-semibold whitespace-nowrap z-10">
                  타입
                </th>
                {dateColumns.map((d) => {
                  const date = new Date(d + 'T00:00:00')
                  const isToday = d === todayStr
                  const dayOfWeek = date.getDay()
                  const isSun = dayOfWeek === 0
                  const isSat = dayOfWeek === 6
                  return (
                    <th
                      key={d}
                      className={`text-center px-1.5 py-1.5 font-medium whitespace-nowrap ${
                        isToday
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700'
                          : isSun
                            ? 'text-red-500'
                            : isSat
                              ? 'text-blue-500'
                              : 'text-zinc-800 dark:text-zinc-200'
                      }`}
                    >
                      <div>{format(date, 'MM/dd')}</div>
                      <div className="text-[9px]">{format(date, 'EEE', { locale: ko })}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.roomType.id}
                  className="border-b border-zinc-50 dark:border-zinc-800"
                >
                  <td className="sticky left-0 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-sm px-2 py-1.5 whitespace-nowrap z-10">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: row.roomType.color }}
                      />
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {row.roomType.name}
                      </span>
                      <span className="text-zinc-500 dark:text-zinc-400 text-[10px]">/{row.total}</span>
                    </div>
                  </td>
                  {row.availableByDate.map((avail, i) => {
                    const isToday = dateColumns[i] === todayStr
                    return (
                      <td
                        key={dateColumns[i]}
                        className={`text-center px-1.5 py-1.5 ${
                          isToday ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                        } ${getCellColor(avail, row.total)}`}
                      >
                        {avail}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-zinc-300 dark:border-zinc-600">
                <td className="sticky left-0 bg-white/80 dark:bg-zinc-900/85 backdrop-blur-sm px-2 py-1.5 whitespace-nowrap z-10">
                  <span className="font-bold text-zinc-900 dark:text-zinc-100">합계</span>
                  <span className="text-zinc-500 dark:text-zinc-400 text-[10px] ml-1">/{totalRooms}</span>
                </td>
                {totalsByDate.map((total, i) => {
                  const isToday = dateColumns[i] === todayStr
                  return (
                    <td
                      key={dateColumns[i]}
                      className={`text-center px-1.5 py-1.5 font-bold ${
                        isToday ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      } ${getCellColor(total, totalRooms)}`}
                    >
                      {total}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </div>
  )
}
