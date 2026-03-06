export const ENTRY_TYPE = {
  stay: { label: '숙박', icon: '🏨' },
  hourly: { label: '대실', icon: '⏰' },
  other_revenue: { label: '기타매출', icon: '💰' },
} as const

export type EntryType = keyof typeof ENTRY_TYPE

export const REVENUE_CATEGORIES = [
  { value: 'minibar', label: '미니바' },
  { value: 'laundry', label: '세탁' },
  { value: 'parking', label: '주차' },
  { value: 'room_service', label: '룸서비스' },
  { value: 'damage', label: '파손/변상' },
  { value: 'etc', label: '기타' },
] as const

export const RESERVATION_STATUS = {
  confirmed: { label: '예약확정', color: 'bg-blue-500' },
  checked_in: { label: '체크인', color: 'bg-green-500' },
  checked_out: { label: '체크아웃', color: 'bg-gray-400' },
  cancelled: { label: '취소', color: 'bg-red-500' },
  no_show: { label: '노쇼', color: 'bg-orange-500' },
} as const

export const PAYMENT_TYPES = [
  { value: '카드', label: '카드' },
  { value: '현금', label: '현금' },
  { value: '계좌이체', label: '계좌이체' },
  { value: '채널결제', label: '채널결제' },
] as const

export const ROOM_STATUS = {
  available: { label: '사용가능', color: 'bg-green-500' },
  maintenance: { label: '정비중', color: 'bg-yellow-500' },
  out_of_order: { label: '사용불가', color: 'bg-red-500' },
} as const

export const ROLES = {
  admin: '관리자',
  manager: '매니저',
  staff: '직원',
} as const

export const TIMELINE_CELL_WIDTH = 40
export const TIMELINE_TODAY_CELL_WIDTH = 80
export const TIMELINE_CELL_HEIGHT = 32
export const TIMELINE_ROOM_LIST_WIDTH = 180
export const TIMELINE_HEADER_HEIGHT = 80

// Zone 기반 수직 레이아웃 (32px 셀: 상단 숙박, 하단 대실+기타매출 좌우 분할)
export const TIMELINE_ZONES = {
  stay:          { top: 1,  height: 16 },  // 숙박: 상단 (1~17px, 전체 너비)
  hourly:        { top: 18, height: 12 },  // 대실: 하단 (18~30px, 셀 왼쪽 절반)
  other_revenue: { top: 18, height: 12 },  // 기타매출: 하단 (18~30px, 셀 오른쪽 절반)
} as const

export const DEFAULT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
] as const
