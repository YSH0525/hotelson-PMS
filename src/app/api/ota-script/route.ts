import { NextRequest, NextResponse } from 'next/server'
import { OTA_SCRAPERS } from '@/lib/ota'
import { format } from 'date-fns'

/**
 * OTA 스크래핑 스크립트를 JS 파일로 제공하는 API
 *
 * 사용법: 북마클릿에서 <script> 태그로 로드
 * GET /api/ota-script?channel=yanolja
 */
export async function GET(request: NextRequest) {
  const channel = request.nextUrl.searchParams.get('channel')
  const origin = request.nextUrl.searchParams.get('origin') || '*'

  if (!channel || !OTA_SCRAPERS[channel]) {
    return NextResponse.json(
      { error: '지원되지 않는 OTA 채널입니다' },
      { status: 400 }
    )
  }

  const scraper = OTA_SCRAPERS[channel]
  const today = format(new Date(), 'yyyy-MM-dd')
  const innerScript = scraper.getScrapeScript(today)

  // 스크래핑 실행 + 결과를 PMS로 전달하는 전체 스크립트
  const fullScript = `
(function() {
  try {
    var result = ${innerScript.trim()};
    var parsed = typeof result === 'string' ? JSON.parse(result) : result;

    if (parsed.success && parsed.reservations && parsed.reservations.length > 0) {
      // PMS 창으로 데이터 전송 시도
      if (window.opener) {
        window.opener.postMessage({
          type: 'OTA_SCRAPE_RESULT',
          channel: '${channel}',
          reservations: parsed.reservations
        }, '${origin}');
        alert('[HotelsON PMS] ' + parsed.reservations.length + '건의 예약을 PMS로 전송했습니다!\\nPMS 창을 확인하세요.');
      } else {
        // opener가 없으면 결과를 클립보드에 복사
        var dataStr = JSON.stringify({ channel: '${channel}', reservations: parsed.reservations });
        navigator.clipboard.writeText(dataStr).then(function() {
          alert('[HotelsON PMS] ' + parsed.reservations.length + '건의 예약 데이터가 클립보드에 복사되었습니다!\\nPMS OTA 연동 페이지에서 "클립보드에서 데이터 가져오기" 버튼을 사용하세요.');
        }).catch(function() {
          prompt('[HotelsON PMS] ' + parsed.reservations.length + '건 추출 완료. 아래 데이터를 복사하세요:', dataStr);
        });
      }
    } else {
      alert('[HotelsON PMS] 예약 데이터를 찾을 수 없습니다.\\n' + (parsed.error || '예약 목록이 비어있습니다.'));
    }
  } catch(e) {
    alert('[HotelsON PMS] 스크래핑 오류: ' + e.message);
  }
})();
`.trim()

  return new NextResponse(fullScript, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
