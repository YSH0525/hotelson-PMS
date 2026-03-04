'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Trash2 } from 'lucide-react'
import { useUIStore } from '@/stores/use-ui-store'
import { useTimelineStore } from '@/stores/use-timeline-store'
import { useRoomTypes } from '@/hooks/use-room-types'
import { useRooms } from '@/hooks/use-rooms'
import {
  useReservation,
  useCreateReservation,
  useUpdateReservation,
  useDeleteReservation,
} from '@/hooks/use-reservations'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { CHANNELS, CHANNEL_KEYS } from '@/lib/channels'
import type { ReservationInsert } from '@/types/database'

const PAYMENT_TYPES = ['카드', '현금', '계좌이체', '채널결제'] as const

const hourlySchema = z.object({
  check_in_time: z.string().min(1, '입실시간을 입력하세요'),
  check_out_time: z.string().min(1, '퇴실시간을 입력하세요'),
  guest_name: z.string().min(1, '이용자명을 입력하세요'),
  guest_phone: z.string().optional(),
  total_amount: z.number().min(0, '금액을 입력하세요'),
  payment_type: z.string().min(1, '결제구분을 선택하세요'),
  reservation_channel: z.string().optional(),
  memo: z.string().optional(),
})

type HourlyFormData = z.infer<typeof hourlySchema>

export function HourlyDialog() {
  const { hourlyDialogOpen, editingReservationId, closeHourlyDialog } = useUIStore()
  const { selectedRoomId, selectedDate, setSelectedCell } = useTimelineStore()
  const { data: roomTypes = [] } = useRoomTypes()
  const { data: rooms = [] } = useRooms()
  const { data: existingReservation } = useReservation(editingReservationId)
  const createReservation = useCreateReservation()
  const updateReservation = useUpdateReservation()
  const deleteReservation = useDeleteReservation()

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEditing = !!editingReservationId

  // 선택된 호실의 객실타입 ID
  const getTypeIdForRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    return room?.room_type_id ?? ''
  }

  // 선택된 객실 정보 (표시용)
  const selectedRoom = useMemo(() => {
    const roomId = isEditing ? existingReservation?.room_id : selectedRoomId
    if (!roomId) return null
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return null
    const roomType = roomTypes.find((rt) => rt.id === room.room_type_id)
    return { room, roomType }
  }, [isEditing, existingReservation, selectedRoomId, rooms, roomTypes])

  // 선택된 날짜 (표시용)
  const displayDate = useMemo(() => {
    if (isEditing && existingReservation) {
      return existingReservation.check_in_date
    }
    return selectedDate ?? format(new Date(), 'yyyy-MM-dd')
  }, [isEditing, existingReservation, selectedDate])

  const form = useForm<HourlyFormData>({
    resolver: zodResolver(hourlySchema),
    defaultValues: {
      check_in_time: '10:00',
      check_out_time: '18:00',
      guest_name: '',
      guest_phone: '',
      total_amount: 0,
      payment_type: '',
      reservation_channel: 'direct',
      memo: '',
    },
  })

  // 다이얼로그 열릴 때 값 초기화
  useEffect(() => {
    if (!hourlyDialogOpen) return

    if (isEditing && existingReservation) {
      const customFields = (existingReservation.custom_fields as Record<string, unknown>) ?? {}
      form.reset({
        check_in_time: existingReservation.check_in_time ?? '10:00',
        check_out_time: existingReservation.check_out_time ?? '18:00',
        guest_name: existingReservation.guest_name,
        guest_phone: existingReservation.guest_phone ?? '',
        total_amount: existingReservation.total_amount,
        payment_type: (customFields.field_payment_type as string) ?? '',
        reservation_channel: (customFields.field_channel as string) ?? 'direct',
        memo: existingReservation.memo ?? '',
      })
    } else {
      form.reset({
        check_in_time: '10:00',
        check_out_time: '18:00',
        guest_name: '',
        guest_phone: '',
        total_amount: 0,
        payment_type: '',
        reservation_channel: 'direct',
        memo: '',
      })
    }
  }, [hourlyDialogOpen, isEditing, existingReservation])

  const handleSubmit = form.handleSubmit(async (data) => {
    const roomId = isEditing ? existingReservation!.room_id : selectedRoomId
    if (!roomId) {
      toast.error('객실이 선택되지 않았습니다.')
      return
    }

    const roomTypeId = getTypeIdForRoom(roomId)
    const date = displayDate

    try {
      if (isEditing) {
        await updateReservation.mutateAsync({
          id: editingReservationId,
          entry_type: 'hourly',
          room_id: roomId,
          room_type_id: roomTypeId,
          check_in_date: date,
          check_out_date: date,
          check_in_time: data.check_in_time,
          check_out_time: data.check_out_time,
          guest_name: data.guest_name,
          guest_phone: data.guest_phone || null,
          total_amount: data.total_amount,
          status: 'confirmed',
          custom_fields: { field_payment_type: data.payment_type, field_channel: data.reservation_channel || 'direct' },
          memo: data.memo || null,
        })
        toast.success('대실이 수정되었습니다.')
      } else {
        const input: ReservationInsert = {
          entry_type: 'hourly',
          room_id: roomId,
          room_type_id: roomTypeId,
          check_in_date: date,
          check_out_date: date,
          check_in_time: data.check_in_time,
          check_out_time: data.check_out_time,
          guest_name: data.guest_name,
          guest_phone: data.guest_phone || null,
          total_amount: data.total_amount,
          status: 'confirmed',
          custom_fields: { field_payment_type: data.payment_type, field_channel: data.reservation_channel || 'direct' },
          memo: data.memo || null,
        }
        await createReservation.mutateAsync(input)
        toast.success('대실이 등록되었습니다.')
      }
      handleClose()
    } catch {
      toast.error(isEditing ? '대실 수정에 실패했습니다.' : '대실 등록에 실패했습니다.')
    }
  })

  const handleDelete = async () => {
    if (!editingReservationId) return
    try {
      await deleteReservation.mutateAsync(editingReservationId)
      toast.success('대실이 삭제되었습니다.')
      setDeleteConfirm(false)
      handleClose()
    } catch {
      toast.error('대실 삭제에 실패했습니다.')
    }
  }

  const handleClose = () => {
    closeHourlyDialog()
    setSelectedCell(null, null)
    form.reset()
  }

  return (
    <>
      <Dialog open={hourlyDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? '대실 수정' : '대실 등록'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 객실 / 이용일 (읽기 전용) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>객실</Label>
                <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 text-sm">
                  {selectedRoom
                    ? `[${selectedRoom.roomType?.name}] ${selectedRoom.room.room_number}호`
                    : '-'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>이용일</Label>
                <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 text-sm">
                  {format(new Date(displayDate), 'yyyy-MM-dd (EEE)', { locale: ko })}
                </div>
              </div>
            </div>

            {/* 입실시간 / 퇴실시간 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>입실시간</Label>
                <Input type="time" {...form.register('check_in_time')} />
                {form.formState.errors.check_in_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.check_in_time.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>퇴실시간</Label>
                <Input type="time" {...form.register('check_out_time')} />
                {form.formState.errors.check_out_time && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.check_out_time.message}
                  </p>
                )}
              </div>
            </div>

            {/* 이용자명 / 연락처 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>이용자명</Label>
                <Input placeholder="홍길동" {...form.register('guest_name')} />
                {form.formState.errors.guest_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.guest_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input placeholder="010-0000-0000" {...form.register('guest_phone')} />
              </div>
            </div>

            {/* 금액 / 결제구분 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>금액 (원)</Label>
                <CurrencyInput
                  value={form.watch('total_amount') || 0}
                  onChange={(v) => form.setValue('total_amount', v)}
                />
                {form.formState.errors.total_amount && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.total_amount.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>결제구분</Label>
                <Select
                  value={form.watch('payment_type')}
                  onValueChange={(v) => form.setValue('payment_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="결제구분 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.payment_type && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.payment_type.message}
                  </p>
                )}
              </div>
            </div>

            {/* 예약채널 */}
            <div className="space-y-2">
              <Label>예약채널</Label>
              <Select
                value={form.watch('reservation_channel')}
                onValueChange={(v) => form.setValue('reservation_channel', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="예약채널 선택" />
                </SelectTrigger>
                <SelectContent>
                  {CHANNEL_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {CHANNELS[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea placeholder="특이사항을 기록하세요" {...form.register('memo')} />
            </div>

            <DialogFooter className="gap-2">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setDeleteConfirm(true)}
                  className="mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  삭제
                </Button>
              )}
              <Button type="button" variant="outline" onClick={handleClose}>
                취소
              </Button>
              <Button
                type="submit"
                disabled={createReservation.isPending || updateReservation.isPending}
              >
                {createReservation.isPending || updateReservation.isPending
                  ? '저장 중...'
                  : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="대실 삭제"
        description="이 대실을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다."
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteReservation.isPending}
      />
    </>
  )
}
