import type { OtaReservation, OtaScraper } from './types'

/**
 * Expedia Partner Central 스크래퍼
 * apps.expediapartnercentral.com
 *
 * Expedia는 영문 인터페이스, 예약 목록 테이블/카드 형태
 * Confirmation #, Guest, Check-in, Check-out, Room, Status, Total 등
 */
export const expediaScraper: OtaScraper = {
  channel: 'expedia',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          const rows = document.querySelectorAll(
            'table tbody tr, [class*="reservation"] tr, [class*="booking-card"], [data-testid*="reservation"]'
          );
          const reservations = [];

          if (rows.length === 0) {
            // 텍스트 기반 추출
            const text = document.body.innerText;
            const blocks = text.split(/(\\d{10,20})/);
            for (let i = 1; i < blocks.length; i += 2) {
              const id = blocks[i];
              const detail = blocks[i+1] || '';
              const nameMatch = detail.match(/([A-Z][a-z]+ [A-Z][a-z]+|[가-힣]{2,4})/);
              const dateMatch = detail.match(/(\\d{4}-\\d{2}-\\d{2}|[A-Z][a-z]{2} \\d{1,2},? \\d{4})/g);
              const amountMatch = detail.match(/(?:KRW|\\$|₩)\\s*([\\d,.]+)/);

              if (dateMatch) {
                reservations.push({
                  otaReservationId: id,
                  channel: 'expedia',
                  guestName: nameMatch ? nameMatch[1] : 'Guest',
                  guestPhone: null,
                  checkInDate: dateMatch[0],
                  checkOutDate: dateMatch[1] || dateMatch[0],
                  entryType: 'stay',
                  nights: 1,
                  roomTypeName: '',
                  otaRoomTypeId: null,
                  amount: amountMatch ? parseInt(amountMatch[1].replace(/[,.]/g, '')) : 0,
                  depositAmount: 0,
                  otaStatus: 'Confirmed',
                  reservedAt: null,
                  rawData: { detail: detail.substring(0, 300) }
                });
              }
            }
            return JSON.stringify({ success: true, reservations });
          }

          rows.forEach(row => {
            const rowText = row.textContent.trim();
            const idMatch = rowText.match(/(\\d{10,20})/);
            if (!idMatch) return;

            const nameMatch = rowText.match(/([A-Z][a-z]+ [A-Z][a-z]+|[가-힣]{2,4})/);
            const dateMatch = rowText.match(/(\\d{4}-\\d{2}-\\d{2}|\\d{2}\\/\\d{2}\\/\\d{4}|[A-Z][a-z]{2} \\d{1,2},? \\d{4})/g);
            const amountMatch = rowText.match(/(?:KRW|\\$|₩)\\s*([\\d,.]+)/);
            const statusMatch = rowText.match(/(Confirmed|Cancelled|No.show|Checked.in|Booked)/i);

            let checkIn = '${date}', checkOut = '${date}';
            if (dateMatch && dateMatch.length >= 2) {
              checkIn = dateMatch[0]; checkOut = dateMatch[1];
            } else if (dateMatch && dateMatch.length === 1) {
              checkIn = dateMatch[0];
            }

            reservations.push({
              otaReservationId: idMatch[1],
              channel: 'expedia',
              guestName: nameMatch ? nameMatch[1] : 'Guest',
              guestPhone: null,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              entryType: 'stay',
              nights: 1,
              roomTypeName: '',
              otaRoomTypeId: null,
              amount: amountMatch ? parseInt(amountMatch[1].replace(/[,.]/g, '')) : 0,
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
