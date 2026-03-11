import type { OtaReservation, OtaScraper } from './types'

/**
 * 한국 로컬 OTA 범용 스크래퍼 팩토리
 *
 * 호텔나우, 데일리호텔, 꿀스테이, 호텔타임 등
 * 한국 OTA 파트너 사이트들은 대부분 비슷한 테이블 구조를 사용:
 * - 예약번호, 예약자명, 연락처, 객실명, 체크인/아웃, 금액, 상태
 *
 * 이 팩토리 함수로 각 OTA별 스크래퍼를 생성
 */
function createKoreanOtaScraper(channel: string): OtaScraper {
  return {
    channel,

    getScrapeScript(date: string): string {
      return `
        (function() {
          try {
            const reservations = [];

            // 1단계: 테이블 기반 추출 시도
            const rows = document.querySelectorAll(
              'table tbody tr, [class*="reservation"] tr, [class*="booking"] tr, ' +
              '[class*="order"] tr, .list-item, [class*="ListItem"], [class*="item-row"]'
            );

            if (rows.length > 0) {
              rows.forEach(row => {
                const cells = row.querySelectorAll('td');
                const rowText = row.textContent.trim();

                // 예약번호 추출 (최소 8자리 숫자 또는 영숫자 조합)
                const idMatch = rowText.match(/([A-Z0-9]{8,20}|\\d{8,20})/);
                if (!idMatch) return;

                // 게스트 정보
                const nameMatch = rowText.match(/([가-힣]{2,4})/);
                const phoneMatch = rowText.match(/(0\\d{2,3}[.-]\\d{3,4}[.-]\\d{4}|0\\d{2,3}[.-]\\d{3,4}[.-]\\*+)/);

                // 날짜 추출
                const dateMatches = rowText.match(/(\\d{4}[.\\/-]\\d{2}[.\\/-]\\d{2})/g);

                // 금액 추출
                const amounts = rowText.match(/([\\d,]+)\\s*원/g) || [];
                const saleAmount = amounts[0] ? parseInt(amounts[0].replace(/[^\\d]/g, '')) : 0;
                const depositAmount = amounts[1] ? parseInt(amounts[1].replace(/[^\\d]/g, '')) : 0;

                // 예약 상태
                const statusMatch = rowText.match(/(예약확정|예약완료|예약취소|이용완료|노쇼|체크인|입실완료|결제완료|대기)/);

                // 숙박/대실
                const stayMatch = rowText.match(/(숙박|대실)\\s*(?:\\(?(\\d+)박?\\)?)?/);

                // 객실 타입
                const roomLines = rowText.split('\\n').filter(l => l.trim().length > 2);

                let checkIn = '${date}', checkOut = '${date}';
                if (dateMatches && dateMatches.length >= 2) {
                  checkIn = dateMatches[0].replace(/[.\\/]/g, '-');
                  checkOut = dateMatches[1].replace(/[.\\/]/g, '-');
                } else if (dateMatches && dateMatches.length === 1) {
                  checkIn = dateMatches[0].replace(/[.\\/]/g, '-');
                }

                reservations.push({
                  otaReservationId: idMatch[1],
                  channel: '${channel}',
                  guestName: nameMatch ? nameMatch[1] : '게스트',
                  guestPhone: phoneMatch ? phoneMatch[1] : null,
                  checkInDate: checkIn,
                  checkOutDate: checkOut,
                  entryType: stayMatch && stayMatch[1] === '대실' ? 'hourly' : 'stay',
                  nights: stayMatch && stayMatch[2] ? parseInt(stayMatch[2]) : 1,
                  roomTypeName: '',
                  otaRoomTypeId: null,
                  amount: saleAmount,
                  depositAmount: depositAmount,
                  otaStatus: statusMatch ? statusMatch[1] : '예약확정',
                  reservedAt: null,
                  rawData: { rowText: rowText.substring(0, 400) }
                });
              });

              return JSON.stringify({ success: true, reservations });
            }

            // 2단계: 텍스트 기반 추출 (테이블이 없는 경우)
            const text = document.body.innerText;
            const blocks = text.split(/(\\d{8,20})/);

            for (let i = 1; i < blocks.length; i += 2) {
              const id = blocks[i];
              const detail = blocks[i+1] || '';

              // 날짜가 포함된 블록만 예약으로 인식
              const dateMatches = detail.match(/(\\d{4}[.\\/-]\\d{2}[.\\/-]\\d{2})/g);
              if (!dateMatches || dateMatches.length === 0) continue;

              const nameMatch = detail.match(/([가-힣]{2,4})/);
              const phoneMatch = detail.match(/(0\\d{2,3}[.-]\\d{3,4}[.-]\\d{4})/);
              const amounts = detail.match(/([\\d,]+)\\s*원/g) || [];
              const statusMatch = detail.match(/(예약확정|예약완료|예약취소|이용완료|노쇼|결제완료)/);

              reservations.push({
                otaReservationId: id,
                channel: '${channel}',
                guestName: nameMatch ? nameMatch[1] : '게스트',
                guestPhone: phoneMatch ? phoneMatch[1] : null,
                checkInDate: dateMatches[0].replace(/[.\\/]/g, '-'),
                checkOutDate: dateMatches[1] ? dateMatches[1].replace(/[.\\/]/g, '-') : dateMatches[0].replace(/[.\\/]/g, '-'),
                entryType: 'stay',
                nights: 1,
                roomTypeName: '',
                otaRoomTypeId: null,
                amount: amounts[0] ? parseInt(amounts[0].replace(/[^\\d]/g, '')) : 0,
                depositAmount: amounts[1] ? parseInt(amounts[1].replace(/[^\\d]/g, '')) : 0,
                otaStatus: statusMatch ? statusMatch[1] : '예약확정',
                reservedAt: null,
                rawData: { detail: detail.substring(0, 400) }
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
}

// 각 한국 로컬 OTA별 스크래퍼 인스턴스
export const hotelnowScraper = createKoreanOtaScraper('hotelnow')
export const dailyhotelScraper = createKoreanOtaScraper('dailyhotel')
export const zzalstayScraper = createKoreanOtaScraper('zzalstay')
export const hoteltimeScraper = createKoreanOtaScraper('hoteltime')
