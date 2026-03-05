'use client'

import { useUIStore } from '@/stores/use-ui-store'
import type { LedStyle } from '@/stores/use-ui-store'
import { cn } from '@/lib/utils'

interface HotelNameLedProps {
  name: string
}

const STYLE_LABELS: Record<LedStyle, string> = {
  marquee: '전광판',
  neon: '네온',
  'dot-matrix': '도트',
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
      {ledStyle === 'dot-matrix' && <DotMatrixStyle name={name} />}
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
      <span
        className={cn(
          'text-sm font-bold text-cyan-400 animate-neon-pulse',
        )}
      >
        {name}
      </span>
    </div>
  )
}

function DotMatrixStyle({ name }: { name: string }) {
  return (
    <div className="text-center">
      <span
        className="text-sm font-bold text-green-400"
        style={{
          fontFamily: '"Courier New", monospace',
          letterSpacing: '0.15em',
          textShadow: '0 0 6px #22c55e, 0 0 12px #22c55e40',
        }}
      >
        {name}
      </span>
    </div>
  )
}
