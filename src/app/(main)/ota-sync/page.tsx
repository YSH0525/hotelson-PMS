'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw, ExternalLink, Check, X, AlertCircle, Clock, Loader2, Plug, Copy, BookMarked } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { CHANNELS, OTA_PARTNER_SITES, type OtaKey } from '@/lib/channels'
import { OTA_SCRAPERS } from '@/lib/ota'
import { useOtaConnections, useUpsertOtaConnection, useUpdateOtaConnection } from '@/hooks/use-ota-connections'
import { useOtaSyncLogs, useCreateSyncLog } from '@/hooks/use-ota-sync'
import { createClient } from '@/lib/supabase/client'
import type { OtaConnection } from '@/types/database'

const OTA_KEYS = Object.keys(OTA_PARTNER_SITES) as OtaKey[]

function getStatusBadge(status: string) {
  switch (status) {
    case 'success':
      return <Badge variant="default" className="bg-green-500"><Check className="mr-1 h-3 w-3" />성공</Badge>
    case 'syncing':
      return <Badge variant="default" className="bg-blue-500"><Loader2 className="mr-1 h-3 w-3 animate-spin" />동기화중</Badge>
    case 'error':
      return <Badge variant="destructive"><X className="mr-1 h-3 w-3" />오류</Badge>
    default:
      return <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />대기</Badge>
  }
}

export default function OtaSyncPage() {
  const { data: connections = [], isLoading } = useOtaConnections()
  const { data: syncLogs = [] } = useOtaSyncLogs()
  const upsertConnection = useUpsertOtaConnection()
  const updateConnection = useUpdateOtaConnection()
  const [syncingChannel, setSyncingChannel] = useState<string | null>(null)
  const [syncDialogOpen, setSyncDialogOpen] = useState(false)
  const [syncDialogChannel, setSyncDialogChannel] = useState<string | null>(null)
  const [importedData, setImportedData] = useState<{ channel: string; reservations: unknown[] } | null>(null)
  const popupRef = useRef<Window | null>(null)

  // 연결 맵 생성 (channel → connection)
  const connectionMap = useMemo(() => {
    const map = new Map<string, OtaConnection>()
    connections.forEach((c) => map.set(c.channel, c))
    return map
  }, [connections])

  const createSyncLog = useCreateSyncLog()

  /** OTA 연결 토글 */
  const handleToggle = useCallback(async (channel: string, enabled: boolean) => {
    try {
      const existing = connectionMap.get(channel)
      const site = OTA_PARTNER_SITES[channel as OtaKey]

      if (existing) {
        await updateConnection.mutateAsync({ id: existing.id, is_enabled: enabled })
      } else {
        await upsertConnection.mutateAsync({
          channel,
          is_enabled: enabled,
          partner_url: site?.url ?? null,
        })
      }
      toast.success(`${CHANNELS[channel as keyof typeof CHANNELS]?.label ?? channel} ${enabled ? '활성화' : '비활성화'}`)
    } catch (error) {
      console.error('OTA 토글 에러:', error)
      toast.error(`OTA 연결 변경에 실패했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [connectionMap, updateConnection, upsertConnection])

  /**
   * 북마클릿 URL 생성
   * - OTA 사이트에서 북마크를 클릭하면 API에서 스크래핑 스크립트를 로드하고 실행
   */
  const generateBookmarkletUrl = useCallback((channel: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `javascript:void(document.head.appendChild(Object.assign(document.createElement('script'),{src:'${origin}/api/ota-script?channel=${channel}&origin=${encodeURIComponent(origin)}&t='+Date.now()})))`
  }, [])

  /**
   * 스크래핑 스크립트 생성 (콘솔용 - 폴백)
   */
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

  /** 스크래핑 스크립트를 클립보드에 복사 */
  const copyScriptToClipboard = useCallback(async (channel: string) => {
    const script = generateScrapeScript(channel)
    if (!script) return

    try {
      await navigator.clipboard.writeText(script)
      toast.success('스크래핑 스크립트가 복사되었습니다! 파트너 사이트 콘솔에 붙여넣기 하세요.')
    } catch {
      toast.error('클립보드 복사에 실패했습니다')
    }
  }, [generateScrapeScript])

  /** OTA 동기화 실행 - 팝업 + 스크립트 안내 */
  const handleSync = useCallback(async (channel: string) => {
    const site = OTA_PARTNER_SITES[channel as OtaKey]
    const scraper = OTA_SCRAPERS[channel]

    if (!site) {
      toast.error('지원되지 않는 OTA입니다')
      return
    }

    if (!scraper) {
      window.open(site.url + site.reservationPath, '_blank', 'width=1200,height=800')
      toast.info(`${CHANNELS[channel as keyof typeof CHANNELS]?.label} 파트너 사이트를 열었습니다. 스크래퍼는 준비 중입니다.`)
      return
    }

    setSyncingChannel(channel)
    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      // 1. 팝업으로 OTA 사이트 열기
      const popup = window.open(
        `${site.url}${site.reservationPath}`,
        `ota_sync_${channel}`,
        'width=1200,height=800,scrollbars=yes'
      )

      if (!popup) {
        toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.')
        setSyncingChannel(null)
        return
      }

      popupRef.current = popup

      // 2. 스크래핑 스크립트를 클립보드에 복사
      const script = generateScrapeScript(channel)
      await navigator.clipboard.writeText(script)

      // 3. 안내 다이얼로그 표시
      setSyncDialogChannel(channel)
      setSyncDialogOpen(true)
      setSyncingChannel(null)

    } catch (error) {
      console.error('동기화 에러:', error)
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast.error('클립보드 접근이 차단되었습니다. 브라우저 설정에서 클립보드를 허용해주세요.')
      } else {
        toast.error(`동기화 중 오류가 발생했습니다: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
      }
      setSyncingChannel(null)
    }
  }, [generateScrapeScript])

  /** 가져온 예약 데이터를 Supabase에 저장 (예약 생성 + 매핑 + 동기화 로그) */
  const saveImportedReservations = useCallback(async (channel: string, reservations: Record<string, unknown>[]) => {
    const conn = connectionMap.get(channel)
    if (!conn) return

    const supabase = createClient()

    try {
      // 1. room_types, rooms, 기존 OTA 매핑 조회
      const [{ data: roomTypes }, { data: rooms }, { data: existingMaps }] = await Promise.all([
        supabase.from('room_types').select('*').order('sort_order'),
        supabase.from('rooms').select('*'),
        supabase.from('ota_reservation_map').select('ota_reservation_id').eq('channel', channel),
      ])

      if (!roomTypes?.length || !rooms?.length) {
        throw new Error('객실 정보를 불러올 수 없습니다. 객실 관리에서 객실을 먼저 등록하세요.')
      }

      const existingOtaIds = new Set((existingMaps ?? []).map((m: { ota_reservation_id: string }) => m.ota_reservation_id))

      // 2. OTA 객실타입명 → PMS room_type 매핑 함수
      const matchRoomType = (otaRoomName: string) => {
        if (!otaRoomName) return roomTypes[0]
        // 정확한 포함 매치: "스탠다드 더블" → "스탠다드"
        const matched = roomTypes.find((rt: { name: string }) => otaRoomName.includes(rt.name))
        if (matched) return matched
        // 역방향: "비지니스" → "비지니스 더블"에 포함
        const reverseMatched = roomTypes.find((rt: { name: string }) => rt.name.includes(otaRoomName))
        if (reverseMatched) return reverseMatched
        // 매치 실패 시 첫번째 타입 (보통 스탠다드)
        return roomTypes[0]
      }

      // 3. 기간 내 기존 예약 조회 (방 충돌 체크용)
      const validRes = reservations.filter((r) => {
        const status = String((r as Record<string, unknown>).otaStatus ?? (r as Record<string, unknown>).status ?? '')
        return !status.includes('취소') && status.toLowerCase() !== 'cancelled'
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allCheckIns = validRes.map((r: any) => r.checkInDate || r.checkIn).filter(Boolean) as string[]
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allCheckOuts = validRes.map((r: any) => r.checkOutDate || r.checkOut).filter(Boolean) as string[]

      const minDate = allCheckIns.length ? allCheckIns.sort()[0] : format(new Date(), 'yyyy-MM-dd')
      const maxDate = allCheckOuts.length ? [...allCheckOuts].sort().reverse()[0] : format(new Date(), 'yyyy-MM-dd')

      const { data: existingReservations } = await supabase
        .from('reservations')
        .select('room_id, check_in_date, check_out_date')
        .lt('check_in_date', maxDate)
        .gt('check_out_date', minDate)
        .in('status', ['confirmed', 'checked_in'])

      // 점유된 방 체크 함수
      const occupiedList = [...(existingReservations ?? [])]
      const isRoomOccupied = (roomId: string, checkIn: string, checkOut: string) => {
        return occupiedList.some(
          (er) => er.room_id === roomId && er.check_in_date < checkOut && er.check_out_date > checkIn
        )
      }

      // 4. 예약 생성 루프
      let created = 0
      let skipped = 0
      const channelLabel = CHANNELS[channel as keyof typeof CHANNELS]?.label ?? channel

      for (const res of reservations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = res as any
        const otaId = String(r.otaReservationId || r.id || '')
        const otaStatus = String(r.otaStatus || r.status || '')

        // 취소된 예약 스킵
        if (otaStatus.includes('취소') || otaStatus.toLowerCase() === 'cancelled') {
          skipped++
          continue
        }

        // 이미 등록된 OTA 예약번호면 스킵
        if (existingOtaIds.has(otaId)) {
          skipped++
          continue
        }

        const checkIn = String(r.checkInDate || r.checkIn || '')
        const checkOut = String(r.checkOutDate || r.checkOut || '')
        if (!checkIn || !checkOut) {
          skipped++
          continue
        }

        const roomType = matchRoomType(String(r.roomTypeName || r.room || ''))

        // 같은 타입의 빈 방 찾기
        const typeRooms = rooms.filter((rm: { room_type_id: string }) => rm.room_type_id === roomType.id)
        let targetRoom = typeRooms.find((rm: { id: string }) => !isRoomOccupied(rm.id, checkIn, checkOut))

        // 같은 타입에 빈 방이 없으면, 아무 빈 방 찾기
        if (!targetRoom) {
          targetRoom = rooms.find((rm: { id: string }) => !isRoomOccupied(rm.id, checkIn, checkOut))
        }

        if (!targetRoom) {
          console.warn(`빈 방 없음: ${r.guestName || r.guest} (${checkIn}~${checkOut})`)
          skipped++
          continue
        }

        // reservations 테이블에 INSERT
        const { data: newReservation, error: insertError } = await supabase
          .from('reservations')
          .insert({
            room_id: targetRoom.id,
            room_type_id: roomType.id,
            check_in_date: checkIn,
            check_out_date: checkOut,
            guest_name: String(r.guestName || r.guest || 'OTA Guest'),
            guest_phone: r.guestPhone || null,
            status: 'confirmed' as const,
            entry_type: 'stay' as const,
            total_amount: Number(r.amount || 0),
            memo: `[${channelLabel}] 예약번호: ${otaId}`,
            custom_fields: {},
          })
          .select()
          .single()

        if (insertError) {
          console.error('예약 생성 실패:', insertError)
          skipped++
          continue
        }

        // ota_reservation_map에 매핑 기록
        await supabase.from('ota_reservation_map').upsert(
          {
            reservation_id: newReservation.id,
            channel,
            ota_reservation_id: otaId,
            ota_status: otaStatus,
            ota_amount: Number(r.amount || 0),
            ota_deposit_amount: Number(r.depositAmount || 0),
            raw_data: JSON.parse(JSON.stringify(r)),
          },
          { onConflict: 'channel,ota_reservation_id' }
        )

        // 점유 목록에 추가 (이후 반복에서 충돌 방지)
        occupiedList.push({ room_id: targetRoom.id, check_in_date: checkIn, check_out_date: checkOut })
        existingOtaIds.add(otaId)
        created++
      }

      // 5. 동기화 로그 저장
      await createSyncLog.mutateAsync({
        connection_id: conn.id,
        channel,
        sync_date: format(new Date(), 'yyyy-MM-dd'),
        status: 'success',
        reservations_found: reservations.length,
        reservations_created: created,
        reservations_skipped: skipped,
        raw_data: JSON.parse(JSON.stringify({ reservations })),
      })

      // 6. 연결 상태 업데이트
      await updateConnection.mutateAsync({
        id: conn.id,
        sync_status: 'success',
        last_sync_at: new Date().toISOString(),
        error_message: null,
      })

      toast.success(`${created}건 예약 생성 완료 (${skipped}건 스킵)`)
    } catch (error) {
      console.error('예약 저장 에러:', error)
      try {
        await updateConnection.mutateAsync({
          id: conn.id,
          sync_status: 'error',
          error_message: error instanceof Error ? error.message : '저장 실패',
        })
      } catch { /* ignore */ }
      toast.error(`예약 데이터 저장 중 오류: ${error instanceof Error ? error.message : '알 수 없는 오류'}`)
    }
  }, [connectionMap, createSyncLog, updateConnection])

  /** 클립보드에서 데이터 붙여넣기 (postMessage가 안 될 경우) */
  const handlePasteData = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText()
      const data = JSON.parse(text)

      if (data.channel && data.reservations) {
        setImportedData(data)
        toast.success(
          `${CHANNELS[data.channel as keyof typeof CHANNELS]?.label ?? data.channel}에서 ${data.reservations.length}건의 예약을 가져왔습니다`
        )
        // 가져온 데이터를 Supabase에 저장
        saveImportedReservations(data.channel, data.reservations)
      } else {
        toast.error('유효한 OTA 데이터가 아닙니다')
      }
    } catch (error) {
      if (error instanceof DOMException) {
        toast.error('클립보드 접근이 차단되었습니다. 브라우저 설정을 확인하세요.')
      } else {
        toast.error('클립보드에 유효한 데이터가 없습니다')
      }
    }
  }, [saveImportedReservations])

  /** postMessage 리스너 - 스크래핑 스크립트에서 데이터 수신 */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OTA_SCRAPE_RESULT') {
        const { channel, reservations } = event.data
        setSyncDialogOpen(false)
        setImportedData({ channel, reservations })
        toast.success(
          `${CHANNELS[channel as keyof typeof CHANNELS]?.label ?? channel}에서 ${reservations?.length ?? 0}건의 예약을 가져왔습니다!`
        )
        // 가져온 데이터를 Supabase에 저장
        saveImportedReservations(channel, reservations)
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [saveImportedReservations])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Header title="OTA 연동 관리" />

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>등록된 OTA</CardDescription>
            <CardTitle className="text-2xl">{OTA_KEYS.length}개</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>활성화된 OTA</CardDescription>
            <CardTitle className="text-2xl text-green-600">
              {connections.filter((c) => c.is_enabled).length}개
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>최근 동기화</CardDescription>
            <CardTitle className="text-2xl">
              {syncLogs.length > 0
                ? format(new Date(syncLogs[0].created_at), 'MM/dd HH:mm', { locale: ko })
                : '-'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 사용 안내 */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            OTA 연동 사용 방법
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p><strong>1단계:</strong> 각 OTA를 활성화하고 파트너 사이트에 미리 로그인해주세요.</p>
          <p><strong>2단계:</strong> &quot;동기화&quot; 버튼을 클릭하면 파트너 사이트가 새 창으로 열리고, <strong>북마클릿 링크</strong>가 표시됩니다.</p>
          <p><strong>3단계:</strong> 북마클릿 링크를 <strong>북마크바에 드래그</strong>하세요 (최초 1회).</p>
          <p><strong>4단계:</strong> 파트너 사이트의 예약 목록 페이지에서 <strong>북마크를 클릭</strong>하면 자동으로 예약을 가져옵니다.</p>
          <p className="text-xs mt-2 text-amber-600">* 각 OTA 파트너 사이트에 로그인 상태여야 합니다.</p>
        </CardContent>
      </Card>

      {/* 데이터 붙여넣기 (postMessage가 안 될 때 대안) */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handlePasteData}>
          <Copy className="mr-1 h-3 w-3" />
          클립보드에서 데이터 가져오기
        </Button>
        {importedData && (
          <Badge variant="default" className="bg-green-500 text-sm py-1">
            <Check className="mr-1 h-3 w-3" />
            {CHANNELS[importedData.channel as keyof typeof CHANNELS]?.label} - {importedData.reservations.length}건 가져옴
          </Badge>
        )}
      </div>

      {/* 동기화 안내 다이얼로그 */}
      <Dialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              {syncDialogChannel && CHANNELS[syncDialogChannel as keyof typeof CHANNELS]?.label} 동기화
            </DialogTitle>
            <DialogDescription>
              파트너 사이트가 새 창으로 열렸습니다. 아래 북마클릿을 사용하세요.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* 북마클릿 링크 */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 p-4 rounded-lg text-center space-y-2">
              <p className="text-sm font-medium">아래 버튼을 <strong>북마크바에 드래그</strong>하세요 (최초 1회)</p>
              {syncDialogChannel && (
                <a
                  href={generateBookmarkletUrl(syncDialogChannel)}
                  onClick={(e) => e.preventDefault()}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg font-medium text-sm shadow-md hover:shadow-lg cursor-grab active:cursor-grabbing select-none"
                  draggable
                >
                  <BookMarked className="h-4 w-4" />
                  {CHANNELS[syncDialogChannel as keyof typeof CHANNELS]?.label ?? syncDialogChannel} 예약 가져오기
                </a>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Ctrl+Shift+B 로 북마크바를 표시할 수 있습니다
              </p>
            </div>

            {/* 사용 방법 */}
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
                onClick={() => syncDialogChannel && copyScriptToClipboard(syncDialogChannel)}
              >
                <Copy className="mr-1 h-4 w-4" />
                콘솔용 스크립트 복사
              </Button>
              <Button
                variant="default"
                className="flex-1"
                onClick={() => setSyncDialogOpen(false)}
              >
                완료
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* OTA 채널 목록 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {OTA_KEYS.map((key) => {
          const channel = CHANNELS[key as keyof typeof CHANNELS]
          const site = OTA_PARTNER_SITES[key]
          const conn = connectionMap.get(key)
          const isEnabled = conn?.is_enabled ?? false
          const hasScraper = !!OTA_SCRAPERS[key]
          const isSyncing = syncingChannel === key

          return (
            <Card key={key} className={isEnabled ? 'border-green-200 dark:border-green-800' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: channel?.color ?? '#6B7280' }}
                    />
                    <div>
                      <CardTitle className="text-base">{channel?.label ?? key}</CardTitle>
                      <CardDescription className="text-xs">{site.url}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) => handleToggle(key, checked)}
                  />
                </div>
              </CardHeader>

              {isEnabled && (
                <CardContent className="pt-0 space-y-3">
                  <Separator />

                  {/* 상태 정보 */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">상태</span>
                    {getStatusBadge(conn?.sync_status ?? 'idle')}
                  </div>

                  {conn?.last_sync_at && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">마지막 동기화</span>
                      <span>{format(new Date(conn.last_sync_at), 'yyyy-MM-dd HH:mm', { locale: ko })}</span>
                    </div>
                  )}

                  {conn?.error_message && (
                    <div className="text-xs text-red-500 bg-red-50 dark:bg-red-950 p-2 rounded">
                      {conn.error_message}
                    </div>
                  )}

                  {/* 숙소 ID 입력 */}
                  <div className="space-y-1">
                    <Label className="text-xs">숙소 ID (선택)</Label>
                    <Input
                      placeholder="OTA측 숙소 ID"
                      defaultValue={conn?.property_id ?? ''}
                      className="h-8 text-sm"
                      onBlur={(e) => {
                        const val = e.target.value.trim()
                        if (conn && val !== (conn.property_id ?? '')) {
                          updateConnection.mutate({
                            id: conn.id,
                            property_id: val || null,
                          })
                        }
                      }}
                    />
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="default"
                      className="flex-1"
                      disabled={isSyncing}
                      onClick={() => handleSync(key)}
                    >
                      {isSyncing ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      {hasScraper ? '동기화' : '사이트 열기'}
                    </Button>
                    {hasScraper && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => copyScriptToClipboard(key)}
                        title="스크래핑 스크립트 복사"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(site.url, '_blank')}
                    >
                      <ExternalLink className="mr-1 h-3 w-3" />
                      파트너
                    </Button>
                  </div>

                  {!hasScraper && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <Plug className="h-3 w-3" />
                      스크래퍼 준비 중 - 현재는 수동 확인만 가능
                    </p>
                  )}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* 동기화 로그 */}
      {syncLogs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">최근 동기화 로그</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {syncLogs.slice(0, 10).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between text-sm py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor:
                          CHANNELS[log.channel as keyof typeof CHANNELS]?.color ?? '#6B7280',
                      }}
                    />
                    <span>{CHANNELS[log.channel as keyof typeof CHANNELS]?.label ?? log.channel}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(log.created_at), 'MM/dd HH:mm', { locale: ko })}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {log.status === 'success' && (
                      <span className="text-xs text-muted-foreground">
                        발견 {log.reservations_found} / 생성 {log.reservations_created} / 스킵{' '}
                        {log.reservations_skipped}
                      </span>
                    )}
                    {getStatusBadge(log.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
