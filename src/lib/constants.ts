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
export const TIMELINE_CELL_HEIGHT = 48
export const TIMELINE_ROOM_LIST_WIDTH = 180
export const TIMELINE_HEADER_HEIGHT = 80

// Zone 기반 수직 레이아웃 (48px 셀 안에서 대실/숙박/기타매출 영역 분리)
export const TIMELINE_ZONES = {
  hourly:        { top: 2,  height: 12 },  // 대실: 상단 (2~14px)
  stay:          { top: 16, height: 18 },  // 숙박: 중앙 (16~34px)
  other_revenue: { top: 36, height: 10 },  // 기타매출: 하단 (36~46px)
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
