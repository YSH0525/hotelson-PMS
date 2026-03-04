// ── 채널 상수 및 유틸리티 ──

export const CHANNELS = {
  direct:  { label: '직접 예약', color: '#3B82F6' },   // blue
  yanolja: { label: '야놀자',    color: '#EF4444' },    // red
  yeogi:   { label: '여기어때',  color: '#F59E0B' },    // amber
  booking: { label: 'Booking.com', color: '#10B981' },  // emerald
  agoda:   { label: 'Agoda',    color: '#8B5CF6' },     // violet
  naver:   { label: '네이버',    color: '#06B6D4' },    // cyan
} as const

export type ChannelKey = keyof typeof CHANNELS

export const CHANNEL_KEYS = Object.keys(CHANNELS) as ChannelKey[]

/** value → 한글 라벨 변환 (없으면 원본 반환) */
export function getChannelLabel(raw: string | undefined | null): string {
  if (!raw) return CHANNELS.direct.label
  const key = raw as ChannelKey
  return CHANNELS[key]?.label ?? raw
}

/** value → 색상 변환 (없으면 회색 폴백) */
export function getChannelColor(raw: string): string {
  const key = raw as ChannelKey
  return CHANNELS[key]?.color ?? '#6B7280'
}

/** custom_fields에서 채널 키 추출 (레거시 데이터 호환) */
export function extractChannelKey(
  customFields: Record<string, unknown> | null | undefined,
): string {
  const fields = (customFields ?? {}) as Record<string, unknown>
  const raw = String(fields['field_channel'] ?? 'direct')
  // 레거시: 한글 라벨로 저장된 경우 → value로 변환
  if (raw === '직접' || raw === '직접 예약') return 'direct'
  if (raw === '야놀자') return 'yanolja'
  if (raw === '여기어때') return 'yeogi'
  if (raw === '네이버') return 'naver'
  return raw
}
