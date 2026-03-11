import type { OtaReservation, OtaScraper } from './types'

/**
 * 여기어때 파트너센터 스크래퍼
 * partner.goodchoice.kr/reservations/reservation-list
 *
 * 테이블 컬럼 구조:
 * 예약 상태 | 통합예약번호 | 예약자 정보 | 상품명 및 판매 유형 | 입실/퇴실 일시 | 금액 및 할인 정보
 *
 * API: /api/giant-reservation-api/reservations
 */
export const yeogiScraper: OtaScraper = {
  channel: 'yeogi',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          const rows = document.querySelectorAll('table tbody tr');
          if (rows.length === 0) {
            return JSON.stringify({ success: true, reservations: [] });
          }

          const reservations = [];
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 6) return;

            // 예약 상태
            const statusText = cells[0].textContent.trim();
            // 통합예약번호
            const reservationId = cells[1].textContent.trim().replace(/\\s+/g, '').replace('인쇄', '');
            // 예약자 정보
            const guestInfo = cells[2].textContent.trim();
            const nameMatch = guestInfo.match(/^([가-힣]+\\*?[가-힣]*|[A-Za-z\\s]+)/);
            const phoneMatch = guestInfo.match(/(0\\d{2,3}-\\d{3,4}-\\*{3,4}|0\\d{2,3}-\\d{3,4}-\\d{4})/);
            // 상품명 및 판매 유형
            const productInfo = cells[3].textContent.trim();
            const stayMatch = productInfo.match(/(숙박|대실)\\s*\\((\\d+)박?\\)/);
            // 입실/퇴실 일시
            const dateText = cells[4].textContent.trim();
            const dateMatches = dateText.match(/(\\d{4}\\.\\d{2}\\.\\d{2})\\s*\\([^)]+\\)\\s*(\\d{2}:\\d{2})/g);
            // 금액 및 할인 정보
            const priceText = cells[5].textContent.trim();
            const saleMatch = priceText.match(/판매\\s*금액\\s*([\\d,]+)원/);
            const depositMatch = priceText.match(/입금\\s*예정\\s*금액\\s*([\\d,]+)원/);

            let checkInDate = '${date}';
            let checkOutDate = '${date}';
            if (dateMatches && dateMatches.length >= 1) {
              const d1 = dateMatches[0].match(/(\\d{4}\\.\\d{2}\\.\\d{2})/);
              if (d1) checkInDate = d1[1].replace(/\\./g, '-');
              if (dateMatches.length >= 2) {
                const d2 = dateMatches[1].match(/(\\d{4}\\.\\d{2}\\.\\d{2})/);
                if (d2) checkOutDate = d2[1].replace(/\\./g, '-');
              }
            }

            // 상품명에서 객실 타입 추출
            const roomTypeName = productInfo.split('\\n')[0].trim();

            reservations.push({
              otaReservationId: reservationId,
              channel: 'yeogi',
              guestName: nameMatch ? nameMatch[1].trim() : '게스트',
              guestPhone: phoneMatch ? phoneMatch[1] : null,
              checkInDate,
              checkOutDate,
              entryType: stayMatch && stayMatch[1] === '대실' ? 'hourly' : 'stay',
              nights: stayMatch ? parseInt(stayMatch[2]) || 1 : 1,
              roomTypeName,
              otaRoomTypeId: null,
              amount: saleMatch ? parseInt(saleMatch[1].replace(/,/g, '')) : 0,
              depositAmount: depositMatch ? parseInt(depositMatch[1].replace(/,/g, '')) : 0,
              otaStatus: statusText.replace(/\\s+/g, ' ').trim(),
              reservedAt: null,
              rawData: { productInfo, priceText, dateText }
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
