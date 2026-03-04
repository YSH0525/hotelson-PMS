'use client'

import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { format, addDays } from 'date-fns'
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
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarDays, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/stores/use-ui-store'
import { useTimelineStore } from '@/stores/use-timeline-store'
import { useRoomTypes } from '@/hooks/use-room-types'
import { useRooms } from '@/hooks/use-rooms'
import { useReservation, useCreateReservation, useUpdateReservation, useDeleteReservation } from '@/hooks/use-reservations'
import { useDefaultFormSchema } from '@/hooks/use-form-schemas'
import { DynamicFieldRenderer } from '@/components/form-builder/dynamic-field-renderer'
import { RESERVATION_STATUS } from '@/lib/constants'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { FormFieldDefinition } from '@/types/form-schema'

const baseSchema = z.object({
  room_id: z.string().min(1, '객실을 선택하세요'),
  room_type_id: z.string().min(1),
  check_in_date: z.string().min(1, '체크인 날짜를 선택하세요'),
  check_out_date: z.string().min(1, '체크아웃 날짜를 선택하세요'),
  guest_name: z.string().min(1, '투숙객 이름을 입력하세요'),
  guest_phone: z.string().optional(),
  guest_email: z.string().optional(),
  status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show']),
  total_amount: z.number().min(0),
  memo: z.string().optional(),
  custom_fields: z.record(z.string(), z.any()).optional(),
})

type FormData = z.infer<typeof baseSchema>

export function ReservationDialog() {
  const { reservationDialogOpen, editingReservationId, closeReservationDialog } = useUIStore()
  const { selectedRoomId, selectedDate, setSelectedCell } = useTimelineStore()
  const { data: roomTypes = [] } = useRoomTypes()
  const { data: rooms = [] } = useRooms()
  const { data: formSchema } = useDefaultFormSchema()
  const { data: existingReservation } = useReservation(editingReservationId)
  const createReservation = useCreateReservation()
  const updateReservation = useUpdateReservation()
  const deleteReservation = useDeleteReservation()

  const [deleteConfirm, setDeleteConfirm] = useState(false)

  const isEditing = !!editingReservationId
  const dynamicFields = useMemo(() => {
    if (!formSchema?.fields) return []
    return (formSchema.fields as unknown as FormFieldDefinition[]).sort(
      (a, b) => a.sortOrder - b.sortOrder
    )
  }, [formSchema])

  // 선택된 호실의 객실타입 ID
  const getTypeIdForRoom = (roomId: string) => {
    const room = rooms.find((r) => r.id === roomId)
    return room?.room_type_id ?? ''
  }

  const form = useForm<FormData>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      room_id: '',
      room_type_id: '',
      check_in_date: '',
      check_out_date: '',
      guest_name: '',
      guest_phone: '',
      guest_email: '',
      status: 'confirmed',
      total_amount: 0,
      memo: '',
      custom_fields: {},
    },
  })

  // 다이얼로그 열릴 때 값 초기화
  useEffect(() => {
    if (!reservationDialogOpen) return

    if (isEditing && existingReservation) {
      form.reset({
        room_id: existingReservation.room_id,
        room_type_id: existingReservation.room_type_id,
        check_in_date: existingReservation.check_in_date,
        check_out_date: existingReservation.check_out_date,
        guest_name: existingReservation.guest_name,
        guest_phone: existingReservation.guest_phone ?? '',
        guest_email: existingReservation.guest_email ?? '',
        status: existingReservation.status,
        total_amount: existingReservation.total_amount,
        memo: existingReservation.memo ?? '',
        custom_fields: (existingReservation.custom_fields as Record<string, unknown>) ?? {},
      })
    } else {
      // 신규 예약 - 셀에서 선택한 값으로 초기화
      const checkIn = selectedDate ?? format(new Date(), 'yyyy-MM-dd')
      const checkOut = format(addDays(new Date(checkIn), 1), 'yyyy-MM-dd')
      const roomTypeId = selectedRoomId ? getTypeIdForRoom(selectedRoomId) : ''
      const roomType = roomTypes.find((rt) => rt.id === roomTypeId)

      form.reset({
        room_id: selectedRoomId ?? '',
        room_type_id: roomTypeId,
        check_in_date: checkIn,
        check_out_date: checkOut,
        guest_name: '',
        guest_phone: '',
        guest_email: '',
        status: 'confirmed',
        total_amount: roomType?.default_price ?? 0,
        memo: '',
        custom_fields: {},
      })
    }
  }, [reservationDialogOpen, isEditing, existingReservation, selectedRoomId, selectedDate])

  const watchRoomId = form.watch('room_id')
  const watchCheckIn = form.watch('check_in_date')
  const watchCheckOut = form.watch('check_out_date')

  // 객실 변경 시 타입 자동 설정
  useEffect(() => {
    if (watchRoomId) {
      const typeId = getTypeIdForRoom(watchRoomId)
      form.setValue('room_type_id', typeId)
    }
  }, [watchRoomId])

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      if (isEditing) {
        await updateReservation.mutateAsync({
          id: editingReservationId,
          ...data,
        })
        toast.success('예약이 수정되었습니다.')
      } else {
        await createReservation.mutateAsync(data)
        toast.success('예약이 생성되었습니다.')
      }
      handleClose()
    } catch {
      toast.error(isEditing ? '예약 수정에 실패했습니다.' : '예약 생성에 실패했습니다.')
    }
  })

  const handleDelete = async () => {
    if (!editingReservationId) return
    try {
      await deleteReservation.mutateAsync(editingReservationId)
      toast.success('예약이 삭제되었습니다.')
      setDeleteConfirm(false)
      handleClose()
    } catch {
      toast.error('예약 삭제에 실패했습니다.')
    }
  }

  const handleClose = () => {
    closeReservationDialog()
    setSelectedCell(null, null)
    form.reset()
  }

  // 객실타입별 그룹핑
  const roomsByType = useMemo(() => {
    const map = new Map<string, typeof rooms>()
    roomTypes.forEach((rt) => {
      map.set(rt.id, rooms.filter((r) => r.room_type_id === rt.id))
    })
    return map
  }, [roomTypes, rooms])

  return (
    <>
      <Dialog open={reservationDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? '예약 수정' : '새 예약'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 객실 선택 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>객실</Label>
                <Select
                  value={watchRoomId}
                  onValueChange={(v) => form.setValue('room_id', v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="객실 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((rt) => {
                      const typeRooms = roomsByType.get(rt.id) || []
                      return typeRooms.map((room) => (
                        <SelectItem key={room.id} value={room.id}>
                          [{rt.name}] {room.room_number}호
                        </SelectItem>
                      ))
                    })}
                  </SelectContent>
                </Select>
                {form.formState.errors.room_id && (
                  <p className="text-sm text-destructive">{form.formState.errors.room_id.message}</p>
                )}
              </div>

              {/* 상태 */}
              <div className="space-y-2">
                <Label>상태</Label>
                <Select
                  value={form.watch('status')}
                  onValueChange={(v) => form.setValue('status', v as FormData['status'])}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RESERVATION_STATUS).map(([key, info]) => (
                      <SelectItem key={key} value={key}>
                        {info.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* 날짜 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>체크인</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !watchCheckIn && 'text-muted-foreground'
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {watchCheckIn
                        ? format(new Date(watchCheckIn), 'yyyy-MM-dd (EEE)', { locale: ko })
                        : '날짜 선택'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={watchCheckIn ? new Date(watchCheckIn) : undefined}
                      onSelect={(date) => {
                        if (date) {
                          form.setValue('check_in_date', format(date, 'yyyy-MM-dd'))
                          // 체크아웃이 체크인보다 이전이면 자동 조정
                          if (watchCheckOut && watchCheckOut <= format(date, 'yyyy-MM-dd')) {
                            form.setValue('check_out_date', format(addDays(date, 1), 'yyyy-MM-dd'))
                          }
                        }
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>체크아웃</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !watchCheckOut && 'text-muted-foreground'
                      )}
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {watchCheckOut
                        ? format(new Date(watchCheckOut), 'yyyy-MM-dd (EEE)', { locale: ko })
                        : '날짜 선택'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={watchCheckOut ? new Date(watchCheckOut) : undefined}
                      onSelect={(date) => {
                        if (date) form.setValue('check_out_date', format(date, 'yyyy-MM-dd'))
                      }}
                      disabled={(date) =>
                        watchCheckIn ? date <= new Date(watchCheckIn) : false
                      }
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* 투숙객 정보 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>투숙객명</Label>
                <Input placeholder="홍길동" {...form.register('guest_name')} />
                {form.formState.errors.guest_name && (
                  <p className="text-sm text-destructive">{form.formState.errors.guest_name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>연락처</Label>
                <Input placeholder="010-0000-0000" {...form.register('guest_phone')} />
              </div>
            </div>

            {/* 금액 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>총 금액 (원)</Label>
                <CurrencyInput
                  value={form.watch('total_amount') || 0}
                  onChange={(v) => form.setValue('total_amount', v)}
                />
              </div>
              <div className="space-y-2">
                <Label>이메일</Label>
                <Input placeholder="email@example.com" {...form.register('guest_email')} />
              </div>
            </div>

            {/* 동적 폼 필드 */}
            {dynamicFields.length > 0 && (
              <div className="border-t pt-4">
                <p className="text-sm font-medium mb-3 text-muted-foreground">추가 정보</p>
                <div className="grid grid-cols-2 gap-4">
                  {dynamicFields.map((field) => (
                    <div
                      key={field.id}
                      className={cn(
                        field.width === 'full' && 'col-span-2',
                        field.width === 'third' && 'col-span-1',
                      )}
                    >
                      <DynamicFieldRenderer
                        field={field}
                        value={form.watch(`custom_fields.${field.id}`)}
                        onChange={(val) => form.setValue(`custom_fields.${field.id}`, val)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

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
              <Button type="submit" disabled={createReservation.isPending || updateReservation.isPending}>
                {(createReservation.isPending || updateReservation.isPending) ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="예약 삭제"
        description="이 예약을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다."
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteReservation.isPending}
      />
    </>
  )
}
