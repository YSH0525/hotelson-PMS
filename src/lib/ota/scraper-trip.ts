import type { OtaReservation, OtaScraper } from './types'

/**
 * 트립닷컴 (Trip.com) 파트너 스크래퍼
 * partner.trip.com
 *
 * 트립닷컴은 중국계 OTA, 영문/한글 혼합 인터페이스
 * Order ID, Guest, Check-in/out, Room Type, Total Price, Status
 */
export const tripScraper: OtaScraper = {
  channel: 'trip',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          const rows = document.querySelectorAll(
            'table tbody tr, [class*="order"] tr, [class*="booking"] tr, .order-item, [class*="OrderItem"]'
          );
          const reservations = [];

          // 텍스트 기반 추출 (범용)
          const text = document.body.innerText;

          if (rows.length === 0) {
            // 주문번호 패턴으로 분리
            const blocks = text.split(/(\\d{10,20})/);
            for (let i = 1; i < blocks.length; i += 2) {
              const id = blocks[i];
              const detail = blocks[i+1] || '';

              const nameMatch = detail.match(/([A-Z][a-z]+ [A-Z][a-z]+|[가-힣]{2,4})/);
              const dateMatch = detail.match(/(\\d{4}[.-]\\d{2}[.-]\\d{2})/g);
              const priceMatch = detail.match(/(?:KRW|₩|\\\\)\\s*([\\d,]+)/);
              const statusMatch = detail.match(/(Confirmed|Cancelled|Completed|확정|취소|완료)/i);

              if (dateMatch && dateMatch.length >= 1) {
                reservations.push({
                  otaReservationId: id,
                  channel: 'trip',
                  guestName: nameMatch ? nameMatch[1] : 'Guest',
                  guestPhone: null,
                  checkInDate: dateMatch[0].replace(/\\./g, '-'),
                  checkOutDate: dateMatch[1] ? dateMatch[1].replace(/\\./g, '-') : dateMatch[0].replace(/\\./g, '-'),
                  entryType: 'stay',
                  nights: 1,
                  roomTypeName: '',
                  otaRoomTypeId: null,
                  amount: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
                  depositAmount: 0,
                  otaStatus: statusMatch ? statusMatch[1] : 'Confirmed',
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
            const dateMatch = rowText.match(/(\\d{4}[.-]\\d{2}[.-]\\d{2})/g);
            const priceMatch = rowText.match(/(?:KRW|₩|\\\\)\\s*([\\d,]+)/);
            const statusMatch = rowText.match(/(Confirmed|Cancelled|Completed|확정|취소|완료)/i);

            let checkIn = '${date}', checkOut = '${date}';
            if (dateMatch && dateMatch.length >= 2) {
              checkIn = dateMatch[0].replace(/\\./g, '-');
              checkOut = dateMatch[1].replace(/\\./g, '-');
            } else if (dateMatch) {
              checkIn = dateMatch[0].replace(/\\./g, '-');
            }

            reservations.push({
              otaReservationId: idMatch[1],
              channel: 'trip',
              guestName: nameMatch ? nameMatch[1] : 'Guest',
              guestPhone: null,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              entryType: 'stay',
              nights: 1,
              roomTypeName: '',
              otaRoomTypeId: null,
              amount: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
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
