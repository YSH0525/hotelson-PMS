import type { OtaReservation, OtaScraper } from './types'

/**
 * Agoda YCS (Yield Connect System) 스크래퍼
 * ycs.agoda.com - Agoda 파트너 사이트
 *
 * Agoda YCS는 영문 기반 인터페이스이며, 예약 목록은 테이블 형태로 표시
 * Booking ID, Guest Name, Check-in, Check-out, Room Type, Status, Revenue 등
 */
export const agodaScraper: OtaScraper = {
  channel: 'agoda',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          // Agoda YCS 예약 목록 테이블 파싱
          const rows = document.querySelectorAll('table tbody tr, [class*="booking-row"], [class*="reservation-row"], [data-testid*="booking"]');
          if (rows.length === 0) {
            // 텍스트 기반 추출 시도
            const text = document.body.innerText;
            if (text.indexOf('Booking ID') === -1 && text.indexOf('booking') === -1) {
              return JSON.stringify({ success: true, reservations: [] });
            }
          }

          const reservations = [];
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowText = row.textContent.trim();

            // Booking ID 추출 (숫자 패턴)
            const bookingIdMatch = rowText.match(/(\\d{6,15})/);
            if (!bookingIdMatch) return;

            // 게스트 이름 (영문 또는 한글)
            const nameMatch = rowText.match(/([A-Z][a-z]+ [A-Z][a-z]+|[가-힣]{2,4})/);

            // 날짜 추출 (다양한 형식 지원)
            const datePattern = /(\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}|\\d{2} [A-Za-z]{3} \\d{4})/g;
            const dates = rowText.match(datePattern) || [];

            // 금액 추출
            const amountMatch = rowText.match(/(?:KRW|₩|\\\\)\\s*([\\d,]+)/);

            let checkIn = dates[0] || '${date}';
            let checkOut = dates[1] || '${date}';
            // 날짜 형식 정규화 (YYYY-MM-DD)
            if (checkIn.includes('/')) {
              const parts = checkIn.split('/');
              checkIn = parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
            }
            if (checkOut.includes('/')) {
              const parts = checkOut.split('/');
              checkOut = parts[2] + '-' + parts[0].padStart(2, '0') + '-' + parts[1].padStart(2, '0');
            }

            // 상태 추출
            const statusMatch = rowText.match(/(Confirmed|Cancelled|No-show|Checked.in|Checked.out|confirmed|cancelled)/i);

            reservations.push({
              otaReservationId: bookingIdMatch[1],
              channel: 'agoda',
              guestName: nameMatch ? nameMatch[1] : 'Guest',
              guestPhone: null,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              entryType: 'stay',
              nights: 1,
              roomTypeName: '',
              otaRoomTypeId: null,
              amount: amountMatch ? parseInt(amountMatch[1].replace(/,/g, '')) : 0,
              depositAmount: 0,
              otaStatus: statusMatch ? statusMatch[1] : 'Confirmed',
              reservedAt: null,
              rawData: { rowText: rowText.substring(0, 300) }
            });
          });

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
