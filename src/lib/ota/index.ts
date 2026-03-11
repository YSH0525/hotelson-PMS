export { yanoljaScraper } from './scraper-yanolja'
export { yeogiScraper } from './scraper-yeogi'
export { agodaScraper } from './scraper-agoda'
export { naverScraper } from './scraper-naver'
export { expediaScraper } from './scraper-expedia'
export { tripScraper } from './scraper-trip'
export { hotelnowScraper, dailyhotelScraper, zzalstayScraper, hoteltimeScraper } from './scraper-korean-ota'
export type { OtaReservation, OtaScrapeResult, OtaSyncStats, OtaScraper } from './types'

import { yanoljaScraper } from './scraper-yanolja'
import { yeogiScraper } from './scraper-yeogi'
import { agodaScraper } from './scraper-agoda'
import { naverScraper } from './scraper-naver'
import { expediaScraper } from './scraper-expedia'
import { tripScraper } from './scraper-trip'
import { hotelnowScraper, dailyhotelScraper, zzalstayScraper, hoteltimeScraper } from './scraper-korean-ota'
import type { OtaScraper } from './types'

/**
 * OTA 스크래퍼 레지스트리 - 10개 OTA 지원
 *
 * 각 스크래퍼는 OtaScraper 인터페이스를 구현:
 * - getScrapeScript(date): 브라우저에서 실행할 JS 코드 반환
 * - parseResult(rawData): 스크래핑 결과를 OtaReservation[] 로 파싱
 *
 * 새로운 OTA 추가 시:
 * 1. src/lib/ota/scraper-{채널명}.ts 파일 생성
 * 2. OtaScraper 인터페이스 구현
 * 3. 여기 레지스트리에 등록
 * 4. src/lib/channels.ts 의 OTA_PARTNER_SITES에 URL 추가
 */
export const OTA_SCRAPERS: Record<string, OtaScraper> = {
  yanolja: yanoljaScraper,       // 야놀자  - partner.yanolja.com
  yeogi: yeogiScraper,           // 여기어때 - partner.goodchoice.kr
  agoda: agodaScraper,           // 아고다  - ycs.agoda.com
  naver: naverScraper,           // 네이버  - booking.naver.com
  expedia: expediaScraper,       // 익스피디아 - apps.expediapartnercentral.com
  trip: tripScraper,             // 트립닷컴 - partner.trip.com
  hotelnow: hotelnowScraper,     // 호텔나우 - partner.hotelnow.co.kr
  dailyhotel: dailyhotelScraper, // 데일리호텔 - partner.dailyhotel.co.kr
  zzalstay: zzalstayScraper,     // 꿀스테이 - partner.zzalstay.com
  hoteltime: hoteltimeScraper,   // 호텔타임 - partner.hoteltime.co.kr
}

/**
 * 팝업 윈도우를 통한 OTA 스크래핑 흐름:
 *
 * 1. PMS에서 "동기화" 버튼 클릭
 * 2. window.open()으로 OTA 파트너 사이트의 예약 페이지 열기
 * 3. 사용자가 이미 로그인된 상태이므로 예약 데이터가 로드됨
 * 4. postMessage로 스크래핑 스크립트 실행 결과를 PMS로 전달
 * 5. PMS에서 결과를 받아 Supabase에 예약 생성/업데이트
 *
 * 보안 참고:
 * - 로그인 정보를 저장하지 않음 (브라우저 세션 활용)
 * - 스크래핑은 사용자 브라우저에서만 실행
 * - OTA 서버에 추가 부하를 주지 않음 (이미 로드된 페이지 읽기)
 *
 * 스크래퍼 테스트 방법:
 * 1. 브라우저에서 OTA 파트너 사이트 접속 후 로그인
 * 2. 예약 목록 페이지로 이동
 * 3. 개발자 도구 콘솔에서 getScrapeScript() 반환값 실행
 * 4. 결과 JSON 확인
 */
