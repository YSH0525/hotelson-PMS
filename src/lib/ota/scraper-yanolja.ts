import type { OtaReservation, OtaScraper } from './types'

/**
 * 야놀자 파트너센터 스크래퍼
 * partner.yanolja.com 에서 예약 데이터를 추출
 *
 * 동작 방식:
 * 1. 사용자가 야놀자 파트너센터에 로그인된 상태에서
 * 2. PMS에서 "동기화" 버튼 클릭
 * 3. 팝업 윈도우로 야놀자 예약 페이지 오픈
 * 4. DOM에서 예약 데이터 추출
 * 5. PMS로 데이터 전송 후 예약 생성/업데이트
 */
export const yanoljaScraper: OtaScraper = {
  channel: 'yanolja',

  /**
   * 야놀자 예약 페이지에서 실행할 JavaScript 코드 생성
   * 이 스크립트는 팝업 윈도우 내에서 실행됨
   */
  getScrapeScript(date: string): string {
    return `
      (function() {
        try {
          // 팝업 닫기 (MUI Dialog)
          const dialog = document.querySelector('.MuiDialog-root');
          if (dialog) dialog.style.display = 'none';

          // 페이지 텍스트에서 예약 데이터 추출
          const allText = document.body.innerText;
          const section = allText.substring(allText.indexOf('예약번호'));

          if (!section || section.length < 10) {
            return JSON.stringify({ success: false, error: '예약 데이터를 찾을 수 없습니다', reservations: [] });
          }

          // 예약번호 패턴으로 분리 (13자리 이상 숫자)
          const blocks = section.split(/(\\d{13,})/);
          const reservations = [];

          for (let i = 1; i < blocks.length; i += 2) {
            const otaReservationId = blocks[i];
            const detail = blocks[i + 1] || '';

            // 체크인/체크아웃 날짜 추출
            const dateMatch = detail.match(
              /(\\d{4}\\.\\d{2}\\.\\d{2})\\([^)]+\\)\\s*(\\d{2}:\\d{2})\\s*\\n\\s*(\\d{4}\\.\\d{2}\\.\\d{2})\\([^)]+\\)\\s*(\\d{2}:\\d{2})/
            );

            // 금액 추출
            const priceMatch = detail.match(/판매가\\s*([\\d,]+)원/);
            const depositMatch = detail.match(/입금예정가\\s*([\\d,]+)원/);

            // 숙박 유형 추출
            const stayMatch = detail.match(/(숙박|대실)\\s*\\/\\s*(\\d+)/);

            // 객실 타입명 추출
            const roomMatch = detail.match(/(도보특가|테라스|디럭스|스탠다드|슈페리어|프리미엄|패밀리|스위트)[^\\n]*/);

            // 객실 타입 ID 추출
            const roomIdMatch = detail.match(/객실 타입 ID:\\s*(\\d+)/);

            // 예약 상태 추출
            const statusMatch = detail.match(/(예약완료|예약취소|입실완료|고객취소|노쇼)/);

            // 게스트 이름 추출 (예약번호 뒤의 첫 번째 줄)
            const lines = detail.split('\\n').map(l => l.trim()).filter(l => l.length > 0);

            // 채널 소스 (씨트립, 아고다 등은 야놀자 내 서브채널)
            const source = lines[0] || '';

            // 게스트명 & 전화번호
            let guestName = '';
            let guestPhone = null;
            for (const line of lines) {
              // 전화번호 패턴
              const phoneMatch = line.match(/0\\d{2,3}-\\d{3,4}-\\d{4}/);
              if (phoneMatch) {
                guestPhone = phoneMatch[0];
              }
              // 이름 패턴 (한글 2-4글자 또는 영문)
              if (!guestName && /^[가-힣]{2,4}$/.test(line)) {
                guestName = line;
              }
              if (!guestName && /^[A-Za-z\\s]+$/.test(line) && line.length > 1 && line.length < 30) {
                guestName = line;
              }
            }

            // 마스킹된 이름 처리 (C**********U 등)
            if (!guestName) {
              for (const line of lines) {
                if (/^[A-Za-z가-힣]\\*+[A-Za-z가-힣]$/.test(line)) {
                  guestName = line;
                  break;
                }
              }
            }

            if (!guestName) guestName = source || '게스트';

            const checkInRaw = dateMatch ? dateMatch[1] : '${date}';
            const checkOutRaw = dateMatch ? dateMatch[3] : '${date}';

            reservations.push({
              otaReservationId,
              channel: 'yanolja',
              guestName,
              guestPhone,
              checkInDate: checkInRaw.replace(/\\./g, '-'),
              checkOutDate: checkOutRaw.replace(/\\./g, '-'),
              entryType: stayMatch && stayMatch[1] === '대실' ? 'hourly' : 'stay',
              nights: stayMatch ? parseInt(stayMatch[2]) || 1 : 1,
              roomTypeName: roomMatch ? roomMatch[0].substring(0, 50) : '',
              otaRoomTypeId: roomIdMatch ? roomIdMatch[1] : null,
              amount: priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0,
              depositAmount: depositMatch ? parseInt(depositMatch[1].replace(/,/g, '')) : 0,
              otaStatus: statusMatch ? statusMatch[1] : '예약완료',
              reservedAt: null,
              rawData: { source, detail: detail.substring(0, 500) }
            });
          }

          return JSON.stringify({ success: true, reservations });
        } catch (e) {
          return JSON.stringify({ success: false, error: e.message, reservations: [] });
        }
      })()
    `
  },

  /** 스크래핑 결과를 OtaReservation 배열로 파싱 */
  parseResult(rawData: unknown): OtaReservation[] {
    if (!rawData || typeof rawData !== 'object') return []
    const data = rawData as { success: boolean; reservations?: OtaReservation[] }
    if (!data.success || !data.reservations) return []
    return data.reservations
  },
}
