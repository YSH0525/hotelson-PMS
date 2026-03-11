import type { OtaReservation, OtaScraper } from './types'

/**
 * 네이버 예약 파트너 스크래퍼
 * booking.naver.com/bizes - 네이버 예약 비즈니스 센터
 *
 * 네이버 예약은 한글 인터페이스, 예약 목록 테이블 제공
 * 예약번호, 예약자, 객실, 체크인/아웃, 결제금액, 상태 등
 */
export const naverScraper: OtaScraper = {
  channel: 'naver',

  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          // 네이버 예약 목록 테이블 파싱
          const rows = document.querySelectorAll('table tbody tr, [class*="booking"] tr, [class*="reservation"] tr, .list_item, li[class*="item"]');
          const reservations = [];

          // 텍스트 기반 파싱 (테이블이 없는 경우)
          if (rows.length === 0) {
            const text = document.body.innerText;
            // 예약번호 패턴으로 블록 분리
            const blocks = text.split(/(\\d{10,20})/);
            for (let i = 1; i < blocks.length; i += 2) {
              const id = blocks[i];
              const detail = blocks[i+1] || '';

              const nameMatch = detail.match(/([가-힣]{2,4})/);
              const phoneMatch = detail.match(/(0\\d{2,3}-\\d{3,4}-\\d{4})/);
              const dateMatch = detail.match(/(\\d{4}[.-]\\d{2}[.-]\\d{2})/g);
              const priceMatch = detail.match(/([\\d,]+)\\s*원/);

              if (dateMatch) {
                reservations.push({
                  otaReservationId: id,
                  channel: 'naver',
                  guestName: nameMatch ? nameMatch[1] : '게스트',
                  guestPhone: phoneMatch ? phoneMatch[1] : null,
                  checkInDate: dateMatch[0].replace(/\\./g, '-'),
                  checkOutDate: dateMatch[1] ? dateMatch[1].replace(/\\./g, '-') : dateMatch[0].replace(/\\./g, '-'),
                  entryType: 'stay',
                  nights: 1,
                  roomTypeName: '',
                  otaRoomTypeId: null,
                  amount: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
                  depositAmount: 0,
                  otaStatus: '예약확정',
                  reservedAt: null,
                  rawData: { detail: detail.substring(0, 300) }
                });
              }
            }
            return JSON.stringify({ success: true, reservations });
          }

          // 테이블 행 파싱
          rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            const rowText = row.textContent.trim();

            const idMatch = rowText.match(/(\\d{10,20})/);
            if (!idMatch) return;

            const nameMatch = rowText.match(/([가-힣]{2,4})/);
            const phoneMatch = rowText.match(/(0\\d{2,3}-\\d{3,4}-\\d{4})/);
            const dateMatch = rowText.match(/(\\d{4}[.-]\\d{2}[.-]\\d{2})/g);
            const priceMatch = rowText.match(/([\\d,]+)\\s*원/);
            const statusMatch = rowText.match(/(예약확정|예약취소|이용완료|노쇼|체크인|체크아웃)/);
            const stayMatch = rowText.match(/(숙박|대실)/);

            let checkIn = '${date}';
            let checkOut = '${date}';
            if (dateMatch && dateMatch.length >= 1) {
              checkIn = dateMatch[0].replace(/\\./g, '-');
              if (dateMatch.length >= 2) {
                checkOut = dateMatch[1].replace(/\\./g, '-');
              }
            }

            reservations.push({
              otaReservationId: idMatch[1],
              channel: 'naver',
              guestName: nameMatch ? nameMatch[1] : '게스트',
              guestPhone: phoneMatch ? phoneMatch[1] : null,
              checkInDate: checkIn,
              checkOutDate: checkOut,
              entryType: stayMatch && stayMatch[1] === '대실' ? 'hourly' : 'stay',
              nights: 1,
              roomTypeName: '',
              otaRoomTypeId: null,
              amount: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
              depositAmount: 0,
              otaStatus: statusMatch ? statusMatch[1] : '예약확정',
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
