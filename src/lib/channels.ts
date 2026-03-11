// ── 채널 상수 및 유틸리티 ──

export const CHANNELS = {
  direct:      { label: '직접 예약',     color: '#3B82F6' },   // blue
  yanolja:     { label: '야놀자',        color: '#EF4444' },   // red
  yeogi:       { label: '여기어때',      color: '#F59E0B' },   // amber
  booking:     { label: 'Booking.com',  color: '#10B981' },   // emerald
  agoda:       { label: 'Agoda',        color: '#8B5CF6' },   // violet
  naver:       { label: '네이버',        color: '#06B6D4' },   // cyan
  expedia:     { label: 'Expedia',      color: '#FBBF24' },   // yellow
  trip:        { label: '트립닷컴',      color: '#2563EB' },   // blue-600
  hotelnow:    { label: '호텔나우',      color: '#F97316' },   // orange
  dailyhotel:  { label: '데일리호텔',    color: '#EC4899' },   // pink
  zzalstay:    { label: '꿀스테이',      color: '#A855F7' },   // purple
  hoteltime:   { label: '호텔타임',      color: '#14B8A6' },   // teal
} as const

// OTA 파트너 사이트 정보
export const OTA_PARTNER_SITES = {
  yanolja:     { name: '야놀자',       url: 'https://partner.yanolja.com',            reservationPath: '/reservation/search' },
  yeogi:       { name: '여기어때',     url: 'https://partner.goodchoice.kr',          reservationPath: '/reservation' },
  agoda:       { name: 'Agoda',       url: 'https://ycs.agoda.com',                  reservationPath: '/bookings' },
  naver:       { name: '네이버',       url: 'https://booking.naver.com/bizes',        reservationPath: '/bookings' },
  expedia:     { name: 'Expedia',     url: 'https://apps.expediapartnercentral.com', reservationPath: '/reservations' },
  trip:        { name: '트립닷컴',     url: 'https://partner.trip.com',               reservationPath: '/orders' },
  hotelnow:    { name: '호텔나우',     url: 'https://partner.hotelnow.co.kr',         reservationPath: '/reservation' },
  dailyhotel:  { name: '데일리호텔',   url: 'https://partner.dailyhotel.co.kr',       reservationPath: '/reservation' },
  zzalstay:    { name: '꿀스테이',     url: 'https://partner.zzalstay.com',           reservationPath: '/reservation' },
  hoteltime:   { name: '호텔타임',     url: 'https://partner.hoteltime.co.kr',        reservationPath: '/reservation' },
} as const

export type OtaKey = keyof typeof OTA_PARTNER_SITES

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
