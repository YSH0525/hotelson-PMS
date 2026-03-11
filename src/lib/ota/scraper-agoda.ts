import type { OtaReservation, OtaScraper } from './types'

/**
 * Agoda YCS (Yield Connect System) 스크래퍼
 * ycs.agoda.com - Agoda 파트너 사이트
 *
 * 실제 DOM 구조: 카드 형태 텍스트 (테이블 아님)
 * 각 예약 블록:
 *   확정된 예약 / 취소된 예약
 *   게스트이름
 *   ID: 숫자
 *   YYYY년 M월 D일 - YYYY년 M월 D일 • N박
 *   객실타입명 (객실ID)
 *   성인 N명
 *   아고다에 요금 지불
 */
export const agodaScraper: OtaScraper = {
  channel: 'agoda',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          const allText = document.body.innerText;
          const reservations = [];

          // ID 패턴으로 예약 찾기
          const idPattern = /ID:\\s*(\\d{6,})/g;
          let match;
          while ((match = idPattern.exec(allText)) !== null) {
            const bookingId = match[1];
            const idx = match.index;

            // ID 앞의 텍스트에서 게스트 이름과 상태 추출
            const before = allText.substring(Math.max(0, idx - 300), idx);
            // ID 뒤의 텍스트에서 날짜, 객실 추출
            const after = allText.substring(idx, Math.min(allText.length, idx + 500));

            // 상태
            const statusParts = before.split(/(확정된 예약|취소된 예약|변경된 예약|Confirmed|Cancelled)/);
            let status = '확정된 예약';
            if (statusParts.length >= 2) {
              status = statusParts[statusParts.length - 1].trim() || statusParts[statusParts.length - 2].trim();
            }
            const statusMatch = before.match(/(확정된 예약|취소된 예약|변경된 예약|Confirmed|Cancelled)[^]*$/);
            if (statusMatch) status = statusMatch[1];

            // 게스트 이름: ID: 바로 앞 줄
            const beforeLines = before.split('\\n').map(l => l.trim()).filter(l => l.length > 0);
            let guestName = 'Guest';
            // 마지막 비어있지 않은 줄이 이름
            for (let i = beforeLines.length - 1; i >= 0; i--) {
              const line = beforeLines[i];
              if (line.match(/^[A-Za-z\\s]+$/) && line.length > 2 && line.length < 50) {
                guestName = line;
                break;
              }
              if (line.match(/^[가-힣]{2,4}$/)) {
                guestName = line;
                break;
              }
            }

            // 날짜: 한국어 형식 "2026년 3월 9일 - 2026년 3월 11일 • 2박"
            const dateMatch = after.match(/(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일\\s*-\\s*(\\d{4})년\\s*(\\d{1,2})월\\s*(\\d{1,2})일\\s*•\\s*(\\d+)박/);
            // 영문 형식 fallback "09 Mar 2026 - 11 Mar 2026"
            const dateMatchEn = !dateMatch ? after.match(/(\\d{2})\\s+(\\w{3})\\s+(\\d{4})\\s*-\\s*(\\d{2})\\s+(\\w{3})\\s+(\\d{4})/) : null;

            let checkInDate = '${date}', checkOutDate = '${date}', nights = 1;
            if (dateMatch) {
              checkInDate = dateMatch[1] + '-' + dateMatch[2].padStart(2, '0') + '-' + dateMatch[3].padStart(2, '0');
              checkOutDate = dateMatch[4] + '-' + dateMatch[5].padStart(2, '0') + '-' + dateMatch[6].padStart(2, '0');
              nights = parseInt(dateMatch[7]);
            }

            // 객실 타입: "객실명 (객실ID)"
            const roomMatch = after.match(/\\n([^\\n]+)\\s+\\((\\d{6,})\\)/);
            const roomTypeName = roomMatch ? roomMatch[1].trim() : '';
            const roomTypeId = roomMatch ? roomMatch[2] : null;

            // 성인 수
            const guestsMatch = after.match(/성인\\s*(\\d+)명|adult/i);

            reservations.push({
              otaReservationId: bookingId,
              channel: 'agoda',
              guestName,
              guestPhone: null,
              checkInDate,
              checkOutDate,
              entryType: 'stay',
              nights,
              roomTypeName,
              otaRoomTypeId: roomTypeId,
              amount: 0,
              depositAmount: 0,
              otaStatus: status,
              reservedAt: null,
              rawData: { guestCount: guestsMatch ? parseInt(guestsMatch[1]) : 1 }
            });
          }

          return JSON.stringify({ success: true, reservations });
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message, reservations: [] });
        }
      })()
    `
  },

  parseResult(rawData: unknown): OtaReservation[] {
    if (!rawData || typeof rawData !== 'object') return []
    const data = rawData as { success: boolean; reservations?: OtaReservation[] }
    if (!data.success || !data.reservations) return []
    return data.reservations
  },
}
