'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { RefreshCw, Loader2, BookMarked, Copy, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { CHANNELS, OTA_PARTNER_SITES, type OtaKey } from '@/lib/channels'
import { OTA_SCRAPERS } from '@/lib/ota'
import { useOtaConnections } from '@/hooks/use-ota-connections'
import { useOtaImport } from '@/hooks/use-ota-import'

const OTA_KEYS = Object.keys(OTA_PARTNER_SITES) as OtaKey[]

/**
 * 타임라인 네비게이션에 표시되는 OTA 빠른 동기화 버튼.
 * 활성화된 OTA 채널을 드롭다운으로 보여주고,
 * 클릭 시 팝업을 열어 북마클릿 안내를 표시합니다.
 * postMessage로 받은 스크래핑 결과를 자동으로 예약에 저장합니다.
 */
export function TimelineOtaSync() {
  const { data: connections = [] } = useOtaConnections()
  const { importReservations } = useOtaImport()
  const [syncingChannel, setSyncingChannel] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogChannel, setDialogChannel] = useState<string | null>(null)

  const enabledConnections = connections.filter((c) => c.is_enabled)

  /** 북마클릿 URL 생성 */
  const generateBookmarkletUrl = useCallback((channel: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `javascript:void(document.head.appendChild(Object.assign(document.createElement('script'),{src:'${origin}/api/ota-script?channel=${channel}&origin=${encodeURIComponent(origin)}&t='+Date.now()})))`
  }, [])

  /** 스크래핑 스크립트 생성 (콘솔용 폴백) */
  const generateScrapeScript = useCallback((channel: string) => {
    const scraper = OTA_SCRAPERS[channel]
    if (!scraper) return ''
    const today = format(new Date(), 'yyyy-MM-dd')
    const innerScript = scraper.getScrapeScript(today)
    const origin = typeof window !== 'undefined' ? window.location.origin : '*'

    return `
(function() {
  var result = ${innerScript.trim()};
  var parsed = typeof result === 'string' ? JSON.parse(result) : result;

  if (parsed.success && parsed.reservations && parsed.reservations.length > 0) {
    if (window.opener) {
      window.opener.postMessage({
        type: 'OTA_SCRAPE_RESULT',
        channel: '${channel}',
        reservations: parsed.reservations
      }, '${origin}');
      alert('[HotelsON PMS] ' + parsed.reservations.length + '건의 예약을 PMS로 전송했습니다!');
    } else {
      var dataStr = JSON.stringify({ channel: '${channel}', reservations: parsed.reservations });
      navigator.clipboard.writeText(dataStr).then(function() {
        alert('[HotelsON PMS] ' + parsed.reservations.length + '건 복사됨. PMS에서 "클립보드에서 데이터 가져오기" 클릭하세요.');
      }).catch(function() {
        prompt('[HotelsON PMS] 데이터를 복사하세요:', dataStr);
      });
    }
  } else {
    alert('[HotelsON PMS] 예약 데이터를 찾을 수 없습니다.\\n' + (parsed.error || '예약 목록이 비어있습니다.'));
  }
})();`.trim()
  }, [])

  /** 동기화 실행 - 팝업 열기 + 안내 다이얼로그 */
  const handleSync = useCallback(async (channel: string) => {
    const site = OTA_PARTNER_SITES[channel as OtaKey]
    const scraper = OTA_SCRAPERS[channel]

    if (!site) {
      toast.error('지원되지 않는 OTA입니다')
      return
    }

    if (!scraper) {
      window.open(site.url + site.reservationPath, '_blank', 'width=1200,height=800')
      toast.info(`${CHANNELS[channel as keyof typeof CHANNELS]?.label} 파트너 사이트를 열었습니다.`)
      return
    }

    setSyncingChannel(channel)

    try {
      const popup = window.open(
        `${site.url}${site.reservationPath}`,
        `ota_sync_${channel}`,
        'width=1200,height=800,scrollbars=yes',
      )

      if (!popup) {
        toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.')
        setSyncingChannel(null)
        return
      }

      const script = generateScrapeScript(channel)
      await navigator.clipboard.writeText(script)

      setDialogChannel(channel)
      setDialogOpen(true)
      setSyncingChannel(null)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.error('클립보드 접근이 차단되었습니다.')
      } else {
        toast.error(`동기화 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      }
      setSyncingChannel(null)
    }
  }, [generateScrapeScript])

  /** 콘솔용 스크립트 복사 */
  const copyScriptToClipboard = useCallback(async (channel: string) => {
    const script = generateScrapeScript(channel)
    if (!script) return
    try {
      await navigator.clipboard.writeText(script)
      toast.success('스크래핑 스크립트가 복사되었습니다!')
    } catch {
      toast.error('클립보드 복사에 실패했습니다')
    }
  }, [generateScrapeScript])

  /** postMessage 리스너 - OTA 스크래핑 결과 수신 후 자동 저장 */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OTA_SCRAPE_RESULT') {
        const { channel, reservations } = event.data
        setDialogOpen(false)
        toast.info(
          `${CHANNELS[channel as keyof typeof CHANNELS]?.label ?? channel}에서 ${reservations?.length ?? 0}건의 예약을 수신했습니다. 타임라인에 반영 중...`,
        )
        importReservations(channel, reservations)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [importReservations])

  if (enabledConnections.length === 0) {
    return null
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            OTA 동기화
            <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
              {enabledConnections.length}
            </Badge>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-xs">활성 OTA 채널</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {enabledConnections.map((conn) => {
            const channelInfo = CHANNELS[conn.channel as keyof typeof CHANNELS]
            const hasScraper = !!OTA_SCRAPERS[conn.channel]
            const isSyncing = syncingChannel === conn.channel

            return (
              <DropdownMenuItem
                key={conn.channel}
                disabled={isSyncing}
                onClick={() => handleSync(conn.channel)}
                className="gap-2"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: channelInfo?.color ?? '#6B7280' }}
                />
                <span className="flex-1">{channelInfo?.label ?? conn.channel}</span>
                {isSyncing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : hasScraper ? (
                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <ExternalLink className="h-3 w-3 text-muted-foreground" />
                )}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* 동기화 안내 다이얼로그 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {dialogChannel && CHANNELS[dialogChannel as keyof typeof CHANNELS]?.label} 동기화
            </DialogTitle>
            <DialogDescription>
              파트너 사이트가 새 창으로 열렸습니다. 아래 북마클릿을 사용하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg text-center space-y-2">
              <p className="text-sm font-medium">
                아래 버튼을 <strong>북마크바에 드래그</strong>하세요 (최초 1회)
              </p>
              {dialogChannel && (
                <a
                  href={generateBookmarkletUrl(dialogChannel)}
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium text-sm shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing select-none"
                  draggable
                >
                  <BookMarked className="h-4 w-4" />
                  {CHANNELS[dialogChannel as keyof typeof CHANNELS]?.label ?? dialogChannel} 예약 가져오기
                </a>
              )}
            </div>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">1</Badge>
                <p className="text-sm">위의 파란 버튼을 <strong>북마크바로 드래그</strong>하세요.</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">2</Badge>
                <p className="text-sm">열린 파트너 사이트에서 <strong>예약 목록 페이지</strong>가 보이는지 확인하세요.</p>
              </div>
              <div className="flex items-start gap-3">
                <Badge variant="outline" className="mt-0.5 shrink-0">3</Badge>
                <p className="text-sm">북마크바에 추가된 <strong>북마크를 클릭</strong>하면 자동으로 예약을 가져옵니다.</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => dialogChannel && copyScriptToClipboard(dialogChannel)}
              >
                <Copy className="mr-1 h-4 w-4" />
                콘솔용 스크립트 복사
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setDialogOpen(false)}
              >
                완료
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
