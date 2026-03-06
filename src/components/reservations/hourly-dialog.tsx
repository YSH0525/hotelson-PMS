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
import { useChannelOptions } from '@/hooks/use-channel-options'
import type { ReservationInsert } from '@/types/database'

import { PAYMENT_TYPES } from '@/lib/constants'

const hourlySchema = z.object({
  check_in_time: z.string(),
  check_out_time: z.string(),
  reservation_channel: z.string().optional(),
  guest_name: z.string().min(1, '이름을 입력하세요'),
  payment_type: z.string().min(1, '결제구분을 선택하세요'),
  total_amount: z.number().min(0, '금액을 입력하세요'),
  vehicle: z.string().optional(),
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
  const { options: channelOptions, getDefaultPaymentType } = useChannelOptions()

  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [manualRoomId, setManualRoomId] = useState<string | null>(null)

  const isEditing = !!editingReservationId

  // 실제 사용할 roomId (타임라인에서 선택 or 다이얼로그에서 직접 선택)
  const effectiveRoomId = isEditing
    ? existingReservation?.room_id ?? null
    : selectedRoomId ?? manualRoomId

  // 선택된 호실의 객실타입 ID
  const getTypeIdForRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    return room?.room_type_id ?? ''
  }

  // 선택된 객실 정보 (표시용)
  const selectedRoom = useMemo(() => {
    if (!effectiveRoomId) return null
    const room = rooms.find((r) => r.id === effectiveRoomId)
    if (!room) return null
    const roomType = roomTypes.find((rt) => rt.id === room.room_type_id)
    return { room, roomType }
  }, [effectiveRoomId, rooms, roomTypes])

  // 타임라인에서 호실이 이미 선택되어 있는지 여부
  const hasPreselectedRoom = !!(isEditing ? existingReservation?.room_id : selectedRoomId)

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
      reservation_channel: 'direct',
      guest_name: '',
      payment_type: '',
      total_amount: 0,
      vehicle: '',
      memo: '',
    },
  })

  // 다이얼로그 열릴 때 값 초기화
  useEffect(() => {
    if (!hourlyDialogOpen) {
      setManualRoomId(null)
      return
    }

    if (isEditing && existingReservation) {
      const customFields = (existingReservation.custom_fields as Record<string, unknown>) ?? {}
      form.reset({
        check_in_time: existingReservation.check_in_time ?? '10:00',
        check_out_time: existingReservation.check_out_time ?? '18:00',
        reservation_channel: (customFields.field_channel as string) ?? 'direct',
        guest_name: existingReservation.guest_name,
        payment_type: (customFields.field_payment_type as string) ?? '',
        total_amount: existingReservation.total_amount,
        vehicle: (customFields.field_vehicle as string) ?? '',
        memo: existingReservation.memo ?? '',
      })
    } else {
      form.reset({
        check_in_time: '10:00',
        check_out_time: '18:00',
        reservation_channel: 'direct',
        guest_name: '',
        payment_type: '',
        total_amount: 0,
        vehicle: '',
        memo: '',
      })
    }
  }, [hourlyDialogOpen, isEditing, existingReservation])

  // 예약채널 변경 시 기본 결제구분 자동 설정
  const watchChannel = form.watch('reservation_channel')
  useEffect(() => {
    if (!watchChannel) return
    const defaultPt = getDefaultPaymentType(watchChannel)
    if (defaultPt) {
      form.setValue('payment_type', defaultPt)
    }
  }, [watchChannel, getDefaultPaymentType])

  const handleSubmit = form.handleSubmit(async (data) => {
    const roomId = effectiveRoomId
    if (!roomId) {
      toast.error('객실이 선택되지 않았습니다.')
      return
    }

    const roomTypeId = getTypeIdForRoom(roomId)
    const date = displayDate

    try {
      const customFields = {
        field_channel: data.reservation_channel || 'direct',
        field_payment_type: data.payment_type,
        field_vehicle: data.vehicle || undefined,
      }

      if (isEditing) {
        await updateReservation.mutateAsync({
          id: editingReservationId,
          entry_type: 'hourly',
          room_id: roomId,
          room_type_id: roomTypeId,
          check_in_date: date,
          check_out_date: date,
          check_in_time: data.check_in_time || '10:00',
          check_out_time: data.check_out_time || '18:00',
          guest_name: data.guest_name,
          total_amount: data.total_amount,
          status: 'confirmed',
          custom_fields: customFields,
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
          check_in_time: data.check_in_time || '10:00',
          check_out_time: data.check_out_time || '18:00',
          guest_name: data.guest_name,
          total_amount: data.total_amount,
          status: 'confirmed',
          custom_fields: customFields,
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
                {hasPreselectedRoom ? (
                  <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 text-sm">
                    {selectedRoom
                      ? `[${selectedRoom.roomType?.name}] ${selectedRoom.room.room_number}호`
                      : '-'}
                  </div>
                ) : (
                  <Select value={manualRoomId ?? ''} onValueChange={setManualRoomId}>
                    <SelectTrigger>
                      <SelectValue placeholder="객실 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((rt) => {
                        const typeRooms = rooms.filter((r) => r.room_type_id === rt.id)
                        return typeRooms.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            [{rt.name}] {r.room_number}호
                          </SelectItem>
                        ))
                      })}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-2">
                <Label>이용일</Label>
                <div className="flex h-9 w-full items-center rounded-md border bg-muted px-3 text-sm">
                  {format(new Date(displayDate), 'yyyy-MM-dd (EEE)', { locale: ko })}
                </div>
              </div>
            </div>

            {/* 채널 / 이름 / 결제 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>채널</Label>
                <Select
                  value={form.watch('reservation_channel')}
                  onValueChange={(v) => form.setValue('reservation_channel', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="채널 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {channelOptions.map((ch) => (
                      <SelectItem key={ch.key} value={ch.key}>
                        {ch.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>이름</Label>
                <Input placeholder="홍길동" {...form.register('guest_name')} />
                {form.formState.errors.guest_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.guest_name.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>결제</Label>
                <Select
                  value={form.watch('payment_type')}
                  onValueChange={(v) => form.setValue('payment_type', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="결제구분" />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_TYPES.map((pt) => (
                      <SelectItem key={pt.value} value={pt.value}>
                        {pt.label}
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

            {/* 금액 / 차량 / 비고(이용시간) */}
            <div className="grid grid-cols-3 gap-4">
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
                <Label>차량</Label>
                <Input placeholder="차량번호" {...form.register('vehicle')} />
              </div>
              <div className="space-y-2">
                <Label>비고</Label>
                <Input placeholder="비고" {...form.register('memo')} />
              </div>
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
