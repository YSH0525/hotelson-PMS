/** OTA에서 스크래핑한 예약 데이터의 표준 형식 */
export interface OtaReservation {
  /** OTA측 예약번호 */
  otaReservationId: string
  /** OTA 채널 키 */
  channel: string
  /** 게스트 이름 */
  guestName: string
  /** 게스트 전화번호 (안심번호 포함) */
  guestPhone: string | null
  /** 체크인 날짜 (YYYY-MM-DD) */
  checkInDate: string
  /** 체크아웃 날짜 (YYYY-MM-DD) */
  checkOutDate: string
  /** 숙박 유형: 'stay' | 'hourly' */
  entryType: 'stay' | 'hourly'
  /** 숙박일수 */
  nights: number
  /** 객실 타입명 (OTA 기준) */
  roomTypeName: string
  /** OTA측 객실 타입 ID */
  otaRoomTypeId: string | null
  /** OTA측 판매가 */
  amount: number
  /** OTA측 입금예정가 */
  depositAmount: number
  /** 예약 상태 (OTA 기준) */
  otaStatus: string
  /** 예약일시 */
  reservedAt: string | null
  /** OTA 원본 데이터 */
  rawData: Record<string, unknown>
}

/** OTA 스크래핑 결과 */
export interface OtaScrapeResult {
  success: boolean
  channel: string
  date: string
  reservations: OtaReservation[]
  error?: string
}

/** 동기화 결과 통계 */
export interface OtaSyncStats {
  found: number
  created: number
  updated: number
  skipped: number
}

/** OTA 스크래퍼 인터페이스 - 각 OTA별로 구현 */
export interface OtaScraper {
  /** 채널 키 */
  channel: string
  /** 스크래핑 실행 - 브라우저 팝업에서 DOM 파싱용 스크립트 반환 */
  getScrapeScript(date: string): string
  /** 스크래핑 결과 파싱 */
  parseResult(rawData: unknown): OtaReservation[]
}
