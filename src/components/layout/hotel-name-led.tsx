'use client'

import { useEffect, useState } from 'react'
import { useUIStore } from '@/stores/use-ui-store'
import type { LedStyle } from '@/stores/use-ui-store'

interface HotelNameLedProps {
  name: string
}

const STYLE_LABELS: Record<LedStyle, string> = {
  marquee: '전광판',
  neon: '네온',
  typewriter: '타이핑',
}

export function HotelNameLed({ name }: HotelNameLedProps) {
  const ledStyle = useUIStore((s) => s.ledStyle)
  const cycleLedStyle = useUIStore((s) => s.cycleLedStyle)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        cycleLedStyle()
      }}
      className="relative overflow-hidden rounded bg-gray-900 px-2 py-1 min-w-0 flex-1 cursor-pointer"
      title={`LED 스타일: ${STYLE_LABELS[ledStyle]} (클릭하여 변경)`}
    >
      {ledStyle === 'marquee' && <MarqueeStyle name={name} />}
      {ledStyle === 'neon' && <NeonStyle name={name} />}
      {ledStyle === 'typewriter' && <TypewriterStyle name={name} />}
    </button>
  )
}

function MarqueeStyle({ name }: { name: string }) {
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <span className="inline-block text-sm font-bold text-amber-400 animate-marquee-scroll">
        {name}
      </span>
    </div>
  )
}

function NeonStyle({ name }: { name: string }) {
  return (
    <div className="text-center">
      <span className="text-sm font-bold text-cyan-400 animate-neon-pulse">
        {name}
      </span>
    </div>
  )
}

function TypewriterStyle({ name }: { name: string }) {
  const [displayedLen, setDisplayedLen] = useState(0)

  useEffect(() => {
    setDisplayedLen(0)
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i > name.length) {
        clearInterval(interval)
        // 다 쓴 후 잠시 대기 후 다시 시작
        setTimeout(() => setDisplayedLen(0), 2000)
        return
      }
      setDisplayedLen(i)
    }, 150)
    return () => clearInterval(interval)
  }, [name])

  // 반복 트리거: displayedLen이 0으로 리셋되면 다시 타이핑 시작
  useEffect(() => {
    if (displayedLen === 0 && name.length > 0) {
      let i = 0
      const interval = setInterval(() => {
        i++
        if (i > name.length) {
          clearInterval(interval)
          setTimeout(() => setDisplayedLen(0), 2000)
          return
        }
        setDisplayedLen(i)
      }, 150)
      return () => clearInterval(interval)
    }
  }, [displayedLen, name])

  return (
    <div className="text-center whitespace-nowrap">
      <span
        className="text-sm font-bold text-amber-300"
        style={{ fontFamily: '"Courier New", monospace' }}
      >
        {name.slice(0, displayedLen)}
      </span>
      <span className="inline-block w-[2px] h-[14px] bg-amber-300 align-middle ml-[1px] animate-typewriter-cursor" />
    </div>
  )
}
