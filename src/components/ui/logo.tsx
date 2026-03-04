import { cn } from '@/lib/utils'

interface LogoProps {
  variant?: 'compact' | 'full'
  className?: string
}

export function Logo({ variant = 'compact', className }: LogoProps) {
  return (
    <svg
      viewBox={variant === 'full' ? '0 0 320 125' : '0 0 230 70'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn('w-auto', className)}
      aria-label="HotelsON PMS"
    >
      {/* ── 애니메이션 정의 ── */}
      <defs>
        <style>{`
          @keyframes glow-pulse {
            0%, 100% { opacity: 0.3; r: 22; }
            50% { opacity: 0.7; r: 26; }
          }
          @keyframes bulb-bright {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.85; }
          }
          @keyframes ray-twinkle-1 {
            0%, 100% { opacity: 1; stroke-width: 2.5; }
            50% { opacity: 0.4; stroke-width: 1.5; }
          }
          @keyframes ray-twinkle-2 {
            0%, 100% { opacity: 0.4; stroke-width: 1.5; }
            50% { opacity: 1; stroke-width: 2.5; }
          }
          .logo-glow { animation: glow-pulse 2.5s ease-in-out infinite; }
          .logo-bulb { animation: bulb-bright 2.5s ease-in-out infinite; }
          .logo-ray-a { animation: ray-twinkle-1 2s ease-in-out infinite; }
          .logo-ray-b { animation: ray-twinkle-2 2s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* ── 전구 소켓 (상단) ── */}
      <rect x="152" y="2" width="2" height="12" rx="1" fill="#666" />
      <path
        d="M146 14 h14 a2 2 0 0 1 2 2 v3 a2 2 0 0 1 -2 2 h-14 a2 2 0 0 1 -2 -2 v-3 a2 2 0 0 1 2 -2z"
        fill="#888"
      />

      {/* ── 전구 글로우 (반짝 애니메이션) ── */}
      <circle cx="153" cy="38" r="22" fill="#FEF3C7" className="logo-glow" />

      {/* ── 전구 본체 (노란 원) ── */}
      <circle cx="153" cy="38" r="16" fill="#F5A623" className="logo-bulb" />

      {/* ── 전구 안쪽 필라멘트 (O 형태) ── */}
      <circle cx="153" cy="38" r="8" stroke="#C47F17" strokeWidth="2.5" fill="none" />

      {/* ── 빛살 (교차 반짝) ── */}
      {/* 좌상 */}
      <line x1="134" y1="22" x2="130" y2="17" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-a" />
      {/* 좌 */}
      <line x1="132" y1="38" x2="126" y2="38" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-b" />
      {/* 좌하 */}
      <line x1="134" y1="54" x2="130" y2="59" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-a" />
      {/* 우상 */}
      <line x1="172" y1="22" x2="176" y2="17" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-b" />
      {/* 우 */}
      <line x1="174" y1="38" x2="180" y2="38" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-a" />
      {/* 우하 */}
      <line x1="172" y1="54" x2="176" y2="59" stroke="#F5A623" strokeWidth="2.5" strokeLinecap="round" className="logo-ray-b" />

      {/* ── "Hotels" 텍스트 ── */}
      <text
        x="118"
        y="52"
        textAnchor="end"
        className="fill-foreground"
        style={{ fontSize: '38px', fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}
      >
        Hotels
      </text>

      {/* ── "N" + compact일 때 "PMS" 텍스트 ── */}
      <text
        x="188"
        y="52"
        textAnchor="start"
        className="fill-foreground"
        style={{ fontSize: '38px', fontWeight: 800, fontFamily: 'system-ui, sans-serif' }}
      >
        N
      </text>

      {/* ── "for your PMS" 서브텍스트 (full 버전에서만) ── */}
      {variant === 'full' && (
        <>
          <text
            x="153"
            y="82"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '14px', fontWeight: 500, fontFamily: 'system-ui, sans-serif' }}
          >
            for your PMS
          </text>
          <text
            x="153"
            y="100"
            textAnchor="middle"
            className="fill-muted-foreground"
            style={{ fontSize: '11px', fontWeight: 400, fontFamily: 'system-ui, sans-serif', letterSpacing: '0.5px' }}
          >
            Professional operation &amp; OTA support
          </text>
        </>
      )}
    </svg>
  )
}
