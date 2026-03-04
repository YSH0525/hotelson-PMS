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
import { REVENUE_CATEGORIES } from '@/lib/constants'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'

const PAYMENT_TYPES = [
  { value: '카드', label: '카드' },
  { value: '현금', label: '현금' },
  { value: '계좌이체', label: '계좌이체' },
  { value: '채널결제', label: '채널결제' },
] as const

const otherRevenueSchema = z.object({
  room_id: z.string().min(1, '객실을 선택하세요'),
  room_type_id: z.string().min(1),
  date: z.string().min(1, '날짜를 선택하세요'),
  revenue_category: z.string().min(1, '매출 카테고리를 선택하세요'),
  guest_name: z.string().min(1, '내역명을 입력하세요'),
  total_amount: z.number().min(0, '금액을 입력하세요'),
  payment_type: z.string().min(1, '결제구분을 선택하세요'),
  memo: z.string().optional(),
})

type FormData = z.infer<typeof otherRevenueSchema>

export function OtherRevenueDialog() {
  const { otherRevenueDialogOpen, editingReservationId, closeOtherRevenueDialog } = useUIStore()
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

  // 선택된 객실의 표시명
  const roomDisplayName = useMemo(() => {
    if (!selectedRoomId && !editingReservationId) return ''
    const roomId = isEditing ? existingReservation?.room_id : selectedRoomId
    if (!roomId) return ''
    const room = rooms.find((r) => r.id === roomId)
    if (!room) return ''
    const roomType = roomTypes.find((rt) => rt.id === room.room_type_id)
    return roomType ? `[${roomType.name}] ${room.room_number}호` : `${room.room_number}호`
  }, [selectedRoomId, editingReservationId, existingReservation, rooms, roomTypes, isEditing])

  // 날짜 표시
  const dateDisplay = useMemo(() => {
    const dateStr = isEditing ? existingReservation?.check_in_date : selectedDate
    if (!dateStr) return ''
    return format(new Date(dateStr), 'yyyy-MM-dd (EEE)', { locale: ko })
  }, [isEditing, existingReservation, selectedDate])

  const form = useForm<FormData>({
    resolver: zodResolver(otherRevenueSchema),
    defaultValues: {
      room_id: '',
      room_type_id: '',
      date: '',
      revenue_category: '',
      guest_name: '',
      total_amount: 0,
      payment_type: '',
      memo: '',
    },
  })

  // 다이얼로그 열릴 때 값 초기화
  useEffect(() => {
    if (!otherRevenueDialogOpen) return

    if (isEditing && existingReservation) {
      const customFields = (existingReservation.custom_fields as Record<string, unknown>) ?? {}
      form.reset({
        room_id: existingReservation.room_id,
        room_type_id: existingReservation.room_type_id,
        date: existingReservation.check_in_date,
        revenue_category: existingReservation.revenue_category ?? '',
        guest_name: existingReservation.guest_name,
        total_amount: existingReservation.total_amount,
        payment_type: String(customFields['field_payment_type'] ?? ''),
        memo: existingReservation.memo ?? '',
      })
    } else {
      const date = selectedDate ?? format(new Date(), 'yyyy-MM-dd')
      const roomTypeId = selectedRoomId ? getTypeIdForRoom(selectedRoomId) : ''

      form.reset({
        room_id: selectedRoomId ?? '',
        room_type_id: roomTypeId,
        date,
        revenue_category: '',
        guest_name: '',
        total_amount: 0,
        payment_type: '',
        memo: '',
      })
    }
  }, [otherRevenueDialogOpen, isEditing, existingReservation, selectedRoomId, selectedDate])

  const handleSubmit = form.handleSubmit(async (data) => {
    try {
      const payload = {
        entry_type: 'other_revenue' as const,
        room_id: data.room_id,
        room_type_id: data.room_type_id,
        check_in_date: data.date,
        check_out_date: data.date,
        guest_name: data.guest_name,
        total_amount: data.total_amount,
        revenue_category: data.revenue_category,
        status: 'confirmed' as const,
        memo: data.memo || null,
        custom_fields: {
          field_payment_type: data.payment_type,
        },
      }

      if (isEditing) {
        await updateReservation.mutateAsync({
          id: editingReservationId,
          ...payload,
        })
        toast.success('기타매출이 수정되었습니다.')
      } else {
        await createReservation.mutateAsync(payload)
        toast.success('기타매출이 등록되었습니다.')
      }
      handleClose()
    } catch {
      toast.error(isEditing ? '기타매출 수정에 실패했습니다.' : '기타매출 등록에 실패했습니다.')
    }
  })

  const handleDelete = async () => {
    if (!editingReservationId) return
    try {
      await deleteReservation.mutateAsync(editingReservationId)
      toast.success('기타매출이 삭제되었습니다.')
      setDeleteConfirm(false)
      handleClose()
    } catch {
      toast.error('기타매출 삭제에 실패했습니다.')
    }
  }

  const handleClose = () => {
    closeOtherRevenueDialog()
    setSelectedCell(null, null)
    form.reset()
  }

  return (
    <>
      <Dialog open={otherRevenueDialogOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEditing ? '기타매출 수정' : '기타매출 등록'}</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 객실 / 날짜 (읽기 전용) */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>객실</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center">
                  {roomDisplayName || '-'}
                </div>
              </div>
              <div className="space-y-2">
                <Label>날짜</Label>
                <div className="h-10 px-3 py-2 rounded-md border bg-muted text-sm flex items-center">
                  {dateDisplay || '-'}
                </div>
              </div>
            </div>

            {/* 매출 카테고리 */}
            <div className="space-y-2">
              <Label>매출 카테고리</Label>
              <Select
                value={form.watch('revenue_category')}
                onValueChange={(v) => form.setValue('revenue_category', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="카테고리 선택" />
                </SelectTrigger>
                <SelectContent>
                  {REVENUE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.formState.errors.revenue_category && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.revenue_category.message}
                </p>
              )}
            </div>

            {/* 내역명 */}
            <div className="space-y-2">
              <Label>내역명</Label>
              <Input placeholder="내역을 입력하세요" {...form.register('guest_name')} />
              {form.formState.errors.guest_name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.guest_name.message}
                </p>
              )}
            </div>

            {/* 금액 / 결제구분 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>금액 (원)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  {...form.register('total_amount', { valueAsNumber: true })}
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

            {/* 메모 */}
            <div className="space-y-2">
              <Label>메모</Label>
              <Textarea placeholder="메모를 입력하세요 (선택)" {...form.register('memo')} />
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
                {createReservation.isPending || updateReservation.isPending ? '저장 중...' : '저장'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="기타매출 삭제"
        description="이 기타매출 내역을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다."
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDelete}
        loading={deleteReservation.isPending}
      />
    </>
  )
}
