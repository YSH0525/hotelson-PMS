import type { OtaReservation, OtaScraper } from './types'

/**
 * 여기어때 파트너센터 스크래퍼
 * partner.goodchoice.kr/reservations/reservation-list
 *
 * 실제 테이블 컬럼 구조 (7 cells):
 * 예약 상태 | 통합예약번호 | 예약자 정보 | 상품명 | 숙박유형 | 입실 일시 | 퇴실 일시
 *
 * 금액은 페이지 상단 요약에서 추출 (총 판매 금액 / 총 입금 예정 금액)
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

          // Phase 1: 테이블 기반 파싱
          if (rows.length > 0) {
            const reservations = [];
            rows.forEach(row => {
              const cells = row.querySelectorAll('td');
              if (cells.length < 5) return;

              // 예약 상태 (cell 0)
              const statusText = cells[0].textContent.trim();
              // 통합예약번호 (cell 1)
              const reservationId = cells[1].textContent.trim().replace(/\\s+/g, '');
              // 예약자 정보 (cell 2) - "공성호0502-4025-5388" 형태
              const guestInfo = cells[2].textContent.trim();
              const nameMatch = guestInfo.match(/^([가-힣]{2,4})/);
              const phoneMatch = guestInfo.match(/(0\\d{2,3}-\\d{3,4}-\\d{4})/);
              // 상품명 (cell 3)
              const roomTypeName = cells[3].textContent.trim();
              // 숙박 유형 (cell 4) - "숙박(1박)" 형태
              const stayInfo = cells[4].textContent.trim();
              const stayMatch = stayInfo.match(/(숙박|대실)\\((\\d+)박?\\)/);

              // 입실 일시 (cell 5) - "입실 일시  2026.03.10 (화) 17:00" 형태
              let checkInDate = '${date}';
              let checkOutDate = '${date}';
              if (cells.length >= 6) {
                const ciMatch = cells[5].textContent.match(/(\\d{4}\\.\\d{2}\\.\\d{2})/);
                if (ciMatch) checkInDate = ciMatch[1].replace(/\\./g, '-');
              }
              // 퇴실 일시 (cell 6)
              if (cells.length >= 7) {
                const coMatch = cells[6].textContent.match(/(\\d{4}\\.\\d{2}\\.\\d{2})/);
                if (coMatch) checkOutDate = coMatch[1].replace(/\\./g, '-');
              }

              // 금액은 페이지 상단 요약에서 추출
              const pageText = document.body.innerText;
              const saleMatch = pageText.match(/총 판매 금액\\s*\\n?\\s*([\\d,]+)원/);
              const depositMatch = pageText.match(/총 입금 예정 금액\\s*\\n?\\s*([\\d,]+)원/);

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
                otaStatus: statusText,
                reservedAt: null,
                rawData: { guestInfo, stayInfo, roomTypeName }
              });
            });

            return JSON.stringify({ success: true, reservations });
          }

          // Phase 2: 텍스트 기반 fallback 파싱
          const allText = document.body.innerText;
          const idPattern = /(\\d{10,}YE\\d+)/g;
          const ids = allText.match(idPattern);
          if (!ids || ids.length === 0) {
            return JSON.stringify({ success: true, reservations: [] });
          }

          const reservations = [];
          for (const id of ids) {
            const idx = allText.indexOf(id);
            const block = allText.substring(idx, idx + 500);

            const namePhoneMatch = block.match(/\\n([가-힣]{2,4})(0\\d{2,3}-\\d{3,4}-\\d{4})/);
            const roomMatch = block.match(/(스탠다드|디럭스|슈페리어|프리미엄|패밀리|스위트|테라스)[^\\n]*/);
            const stayMatch = block.match(/(숙박|대실)\\((\\d+)박?\\)/);
            const checkInMatch = block.match(/입실 일시\\s+(\\d{4}\\.\\d{2}\\.\\d{2})/);
            const checkOutMatch = block.match(/퇴실 일시\\s+(\\d{4}\\.\\d{2}\\.\\d{2})/);
            const statusBefore = allText.substring(Math.max(0, idx - 30), idx);
            const statusMatch = statusBefore.match(/(이용완료|예약확정|예약대기|예약취소)/);

            reservations.push({
              otaReservationId: id,
              channel: 'yeogi',
              guestName: namePhoneMatch ? namePhoneMatch[1] : '게스트',
              guestPhone: namePhoneMatch ? namePhoneMatch[2] : null,
              checkInDate: checkInMatch ? checkInMatch[1].replace(/\\./g, '-') : '${date}',
              checkOutDate: checkOutMatch ? checkOutMatch[1].replace(/\\./g, '-') : '${date}',
              entryType: stayMatch && stayMatch[1] === '대실' ? 'hourly' : 'stay',
              nights: stayMatch ? parseInt(stayMatch[2]) || 1 : 1,
              roomTypeName: roomMatch ? roomMatch[0].trim() : '',
              otaRoomTypeId: null,
              amount: 0,
              depositAmount: 0,
              otaStatus: statusMatch ? statusMatch[1] : '알수없음',
              reservedAt: null,
              rawData: { block: block.substring(0, 300) }
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
