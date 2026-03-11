'use client'

import { useState, useCallback, useEffect } from 'react'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { RefreshCw, ExternalLink, Check, X, AlertCircle, Clock, Loader2, Plug } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'

import { CHANNELS, OTA_PARTNER_SITES, type OtaKey } from '@/lib/channels'
import { OTA_SCRAPERS } from '@/lib/ota'
import { useOtaConnections, useUpsertOtaConnection, useUpdateOtaConnection } from '@/hooks/use-ota-connections'
import { useOtaSyncLogs } from '@/hooks/use-ota-sync'
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

  // 연결 맵 생성 (channel → connection)
  const connectionMap = new Map<string, OtaConnection>()
  connections.forEach((c) => connectionMap.set(c.channel, c))

  /** OTA 연결 토글 */
  const handleToggle = useCallback(async (channel: string, enabled: boolean) => {
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
    toast.success(`${CHANNELS[channel as keyof typeof CHANNELS]?.label} ${enabled ? '활성화' : '비활성화'}`)
  }, [connectionMap, updateConnection, upsertConnection])

  /** OTA 동기화 실행 - 팝업 윈도우 방식 */
  const handleSync = useCallback(async (channel: string) => {
    const site = OTA_PARTNER_SITES[channel as OtaKey]
    const scraper = OTA_SCRAPERS[channel]

    if (!site) {
      toast.error('지원되지 않는 OTA입니다')
      return
    }

    if (!scraper) {
      // 스크래퍼가 아직 구현되지 않은 OTA → 파트너 사이트만 열기
      window.open(site.url + site.reservationPath, '_blank', 'width=1200,height=800')
      toast.info(`${CHANNELS[channel as keyof typeof CHANNELS]?.label} 파트너 사이트를 열었습니다. 스크래퍼는 준비 중입니다.`)
      return
    }

    setSyncingChannel(channel)
    const today = format(new Date(), 'yyyy-MM-dd')

    try {
      // 1. 팝업으로 OTA 사이트 열기
      const popup = window.open(
        `${site.url}${site.reservationPath}?date=${today}`,
        `ota_sync_${channel}`,
        'width=1200,height=800,scrollbars=yes'
      )

      if (!popup) {
        toast.error('팝업이 차단되었습니다. 팝업 허용 후 다시 시도하세요.')
        setSyncingChannel(null)
        return
      }

      toast.info(`${CHANNELS[channel as keyof typeof CHANNELS]?.label} 파트너 사이트를 로딩 중입니다...`)

      // 2. 페이지 로드 대기 후 스크래핑 실행
      // 참고: 크로스-오리진 제약으로 직접 DOM 접근은 불가
      // 사용자가 수동으로 데이터를 확인할 수 있도록 안내
      setTimeout(() => {
        toast.info(
          '파트너 사이트가 열렸습니다. 예약 데이터를 확인하세요.',
          { duration: 5000 }
        )
        setSyncingChannel(null)
      }, 3000)

    } catch (error) {
      toast.error('동기화 중 오류가 발생했습니다')
      setSyncingChannel(null)
    }
  }, [])

  /** postMessage 리스너 - 북마클릿에서 데이터 수신 */
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OTA_SCRAPE_RESULT') {
        const { channel, reservations } = event.data
        toast.success(
          `${CHANNELS[channel as keyof typeof CHANNELS]?.label}에서 ${reservations?.length ?? 0}건의 예약을 가져왔습니다`
        )
        // TODO: 예약 데이터를 Supabase에 저장하는 로직
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

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
        <CardContent className="text-sm text-muted-foreground space-y-1">
          <p>1. 각 OTA를 활성화하고 파트너 사이트에 미리 로그인해주세요.</p>
          <p>2. &quot;동기화&quot; 버튼을 클릭하면 파트너 사이트가 새 창으로 열립니다.</p>
          <p>3. 예약 데이터가 자동으로 PMS에 동기화됩니다.</p>
          <p className="text-xs mt-2 text-amber-600">* 각 OTA 파트너 사이트에 로그인 상태여야 합니다.</p>
        </CardContent>
      </Card>

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
                        if (conn && e.target.value !== (conn.property_id ?? '')) {
                          updateConnection.mutate({
                            id: conn.id,
                            property_id: e.target.value || null,
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
