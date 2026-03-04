'use client'

import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Building2, Clock, Bell, Users, Save, Loader2, Pencil } from 'lucide-react'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/stores/use-auth-store'
import type { HotelSettings, Profile, Json } from '@/types/database'

// ── 시간 옵션 생성 (30분 단위) ──
const TIME_OPTIONS: string[] = []
for (let h = 0; h < 24; h++) {
  for (const m of ['00', '30']) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${m}`)
  }
}

// ── 알림 설정 키 & 라벨 ──
const NOTIFICATION_KEYS = [
  { key: 'reservation_new', label: '신규 예약 알림', desc: '새로운 예약이 등록되면 알림을 받습니다.' },
  { key: 'reservation_cancel', label: '예약 취소 알림', desc: '예약이 취소되면 알림을 받습니다.' },
  { key: 'check_in_reminder', label: '체크인 리마인더', desc: '체크인 예정 시간 전 알림을 받습니다.' },
  { key: 'check_out_reminder', label: '체크아웃 리마인더', desc: '체크아웃 예정 시간 전 알림을 받습니다.' },
  { key: 'no_show_alert', label: '노쇼 알림', desc: '체크인 미완료 시 알림을 받습니다.' },
] as const

// ── 역할 라벨 ──
const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  manager: '매니저',
  staff: '스태프',
}

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  staff: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

export default function SettingsPage() {
  const supabase = createClient()
  const queryClient = useQueryClient()
  const currentUser = useAuthStore((s) => s.profile)

  // ── 호텔 설정 로딩 ──
  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['hotelSettings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hotel_settings')
        .select('*')
        .single()
      if (error) throw error
      return data as HotelSettings
    },
  })

  // ── 사용자 목록 로딩 ──
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as Profile[]
    },
  })

  // ── 호텔 정보 폼 ──
  const [hotelName, setHotelName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // ── 운영 설정 폼 ──
  const [checkInTime, setCheckInTime] = useState('15:00')
  const [checkOutTime, setCheckOutTime] = useState('11:00')
  const [taxRate, setTaxRate] = useState('10')
  const [currency, setCurrency] = useState('KRW')
  const [timezone, setTimezone] = useState('Asia/Seoul')

  // ── 알림 설정 ──
  const [notifications, setNotifications] = useState<Record<string, boolean>>({
    reservation_new: true,
    reservation_cancel: true,
    check_in_reminder: true,
    check_out_reminder: true,
    no_show_alert: true,
  })

  // ── 사용자 관리 ──
  const [editingUser, setEditingUser] = useState<Profile | null>(null)
  const [editName, setEditName] = useState('')

  // ── settings 로드 시 폼에 반영 ──
  useEffect(() => {
    if (settings) {
      setHotelName(settings.hotel_name ?? '')
      setAddress(settings.address ?? '')
      setPhone(settings.phone ?? '')
      setEmail(settings.email ?? '')
      setCheckInTime(settings.check_in_time?.slice(0, 5) ?? '15:00')
      setCheckOutTime(settings.check_out_time?.slice(0, 5) ?? '11:00')
      setTaxRate(String(settings.tax_rate ?? 10))
      setCurrency(settings.currency ?? 'KRW')
      setTimezone(settings.timezone ?? 'Asia/Seoul')
      const ns = (settings.notification_settings ?? {}) as Record<string, boolean>
      setNotifications({
        reservation_new: ns.reservation_new ?? true,
        reservation_cancel: ns.reservation_cancel ?? true,
        check_in_reminder: ns.check_in_reminder ?? true,
        check_out_reminder: ns.check_out_reminder ?? true,
        no_show_alert: ns.no_show_alert ?? true,
      })
    }
  }, [settings])

  // ── 호텔 정보 저장 ──
  const saveHotelInfo = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error('설정을 불러오지 못했습니다.')
      if (!hotelName.trim()) throw new Error('호텔명은 필수입니다.')
      const { error } = await supabase
        .from('hotel_settings')
        .update({
          hotel_name: hotelName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
        })
        .eq('id', settings.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelSettings'] })
      toast.success('호텔 정보가 저장되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '저장에 실패했습니다.'),
  })

  // ── 운영 설정 저장 ──
  const saveOperations = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error('설정을 불러오지 못했습니다.')
      const { error } = await supabase
        .from('hotel_settings')
        .update({
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          tax_rate: parseFloat(taxRate) || 10,
          currency,
          timezone,
        })
        .eq('id', settings.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelSettings'] })
      toast.success('운영 설정이 저장되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '저장에 실패했습니다.'),
  })

  // ── 알림 설정 저장 ──
  const saveNotifications = useMutation({
    mutationFn: async () => {
      if (!settings) throw new Error('설정을 불러오지 못했습니다.')
      const { error } = await supabase
        .from('hotel_settings')
        .update({
          notification_settings: notifications as unknown as Json,
        })
        .eq('id', settings.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hotelSettings'] })
      toast.success('알림 설정이 저장되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '저장에 실패했습니다.'),
  })

  // ── 역할 변경 ──
  const changeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: role as Profile['role'] })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      toast.success('역할이 변경되었습니다.')
    },
    onError: (err: Error) => toast.error(err.message || '역할 변경에 실패했습니다.'),
  })

  // ── 이름 변경 ──
  const updateName = useMutation({
    mutationFn: async ({ userId, name }: { userId: string; name: string }) => {
      if (!name.trim()) throw new Error('이름을 입력해주세요.')
      const { error } = await supabase
        .from('profiles')
        .update({ name: name.trim() })
        .eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] })
      setEditingUser(null)
      toast.success('이름이 변경되었습니다.')
      // 내 프로필이면 auth store도 갱신
      if (editingUser?.id === currentUser?.id) {
        useAuthStore.getState().setProfile({
          ...currentUser!,
          name: editName.trim(),
        })
      }
    },
    onError: (err: Error) => toast.error(err.message || '이름 변경에 실패했습니다.'),
  })

  const isAdmin = currentUser?.role === 'admin'

  // ── 현재 사용자 이메일 ──
  const [currentEmail, setCurrentEmail] = useState('')
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user?.email ?? '')
    })
  }, [supabase])

  if (settingsLoading) {
    return (
      <>
        <Header title="일반 설정" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="일반 설정" />
      <div className="p-6">
        <Tabs defaultValue="hotel" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="hotel" className="gap-1.5">
              <Building2 className="h-4 w-4" />
              호텔 정보
            </TabsTrigger>
            <TabsTrigger value="operations" className="gap-1.5">
              <Clock className="h-4 w-4" />
              운영 설정
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5">
              <Bell className="h-4 w-4" />
              알림 설정
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5">
              <Users className="h-4 w-4" />
              사용자 관리
            </TabsTrigger>
          </TabsList>

          {/* ── 탭 1: 호텔 정보 ── */}
          <TabsContent value="hotel">
            <Card>
              <CardHeader>
                <CardTitle>호텔 기본 정보</CardTitle>
                <CardDescription>호텔의 기본 정보를 설정합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hotelName">호텔명 *</Label>
                    <Input
                      id="hotelName"
                      value={hotelName}
                      onChange={(e) => setHotelName(e.target.value)}
                      placeholder="호텔명을 입력하세요"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">이메일</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="hotel@example.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">전화번호</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="02-1234-5678"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">주소</Label>
                    <Input
                      id="address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="서울특별시 중구 ..."
                    />
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveHotelInfo.mutate()}
                    disabled={saveHotelInfo.isPending}
                  >
                    {saveHotelInfo.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 탭 2: 운영 설정 ── */}
          <TabsContent value="operations">
            <Card>
              <CardHeader>
                <CardTitle>운영 설정</CardTitle>
                <CardDescription>체크인/체크아웃 시간, 세금, 통화 등을 설정합니다.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>체크인 시간</Label>
                    <Select value={checkInTime} onValueChange={setCheckInTime}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`ci-${t}`} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>체크아웃 시간</Label>
                    <Select value={checkOutTime} onValueChange={setCheckOutTime}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={`co-${t}`} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taxRate">세금율 (%)</Label>
                    <Input
                      id="taxRate"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>통화</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="KRW">🇰🇷 KRW (원)</SelectItem>
                        <SelectItem value="USD">🇺🇸 USD (달러)</SelectItem>
                        <SelectItem value="JPY">🇯🇵 JPY (엔)</SelectItem>
                        <SelectItem value="CNY">🇨🇳 CNY (위안)</SelectItem>
                        <SelectItem value="EUR">🇪🇺 EUR (유로)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>시간대</Label>
                    <Select value={timezone} onValueChange={setTimezone}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Asia/Seoul">Asia/Seoul (KST, UTC+9)</SelectItem>
                        <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST, UTC+9)</SelectItem>
                        <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST, UTC+8)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST, UTC-5)</SelectItem>
                        <SelectItem value="Europe/London">Europe/London (GMT, UTC+0)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="flex justify-end">
                  <Button
                    onClick={() => saveOperations.mutate()}
                    disabled={saveOperations.isPending}
                  >
                    {saveOperations.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 탭 3: 알림 설정 ── */}
          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>알림 설정</CardTitle>
                <CardDescription>
                  각 상황에 대한 알림 수신 여부를 설정합니다.
                  <span className="block text-xs text-amber-600 mt-1">
                    * 실제 알림 발송 기능은 향후 업데이트 예정입니다. 현재는 설정 저장만 가능합니다.
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {NOTIFICATION_KEYS.map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <Switch
                      checked={notifications[key] ?? true}
                      onCheckedChange={(checked) =>
                        setNotifications((prev) => ({ ...prev, [key]: checked }))
                      }
                    />
                  </div>
                ))}

                <Separator />

                <div className="flex justify-end pt-3">
                  <Button
                    onClick={() => saveNotifications.mutate()}
                    disabled={saveNotifications.isPending}
                  >
                    {saveNotifications.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Save className="h-4 w-4 mr-2" />
                    )}
                    저장
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── 탭 4: 사용자 관리 ── */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>사용자 관리</CardTitle>
                <CardDescription>
                  등록된 사용자를 관리합니다.
                  {!isAdmin && (
                    <span className="block text-xs text-amber-600 mt-1">
                      * 역할 변경은 관리자만 가능합니다.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {usersLoading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    등록된 사용자가 없습니다.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>이메일</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>가입일</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const isMe = user.id === currentUser?.id
                        return (
                          <TableRow key={user.id}>
                            <TableCell className="font-medium">
                              {user.name}
                              {isMe && (
                                <Badge variant="outline" className="ml-2 text-xs">나</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {isMe ? currentEmail : '-'}
                            </TableCell>
                            <TableCell>
                              {isAdmin && !isMe ? (
                                <Select
                                  value={user.role}
                                  onValueChange={(role) =>
                                    changeRole.mutate({ userId: user.id, role })
                                  }
                                >
                                  <SelectTrigger className="w-[120px]" size="sm">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">관리자</SelectItem>
                                    <SelectItem value="manager">매니저</SelectItem>
                                    <SelectItem value="staff">스태프</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Badge
                                  variant="secondary"
                                  className={ROLE_COLORS[user.role] ?? ''}
                                >
                                  {ROLE_LABELS[user.role] ?? user.role}
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {format(new Date(user.created_at), 'yyyy.MM.dd')}
                            </TableCell>
                            <TableCell className="text-right">
                              {(isMe || isAdmin) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setEditingUser(user)
                                    setEditName(user.name)
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── 이름 변경 다이얼로그 ── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>이름 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="editName">이름</Label>
            <Input
              id="editName"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="이름을 입력하세요"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && editingUser) {
                  updateName.mutate({ userId: editingUser.id, name: editName })
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              취소
            </Button>
            <Button
              onClick={() => {
                if (editingUser) {
                  updateName.mutate({ userId: editingUser.id, name: editName })
                }
              }}
              disabled={updateName.isPending}
            >
              {updateName.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
