'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Room } from '@/types/database'

const roomSchema = z.object({
  room_number: z.string().min(1, '호실 번호를 입력하세요'),
  floor: z.number().min(1, '층수를 입력하세요'),
  status: z.enum(['available', 'maintenance', 'out_of_order']),
})

type RoomFormData = z.infer<typeof roomSchema>

interface RoomFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RoomFormData) => void
  defaultValues?: Partial<Room>
  loading?: boolean
}

export function RoomForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  loading,
}: RoomFormProps) {
  const form = useForm<RoomFormData>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      room_number: defaultValues?.room_number ?? '',
      floor: defaultValues?.floor ?? 1,
      status: defaultValues?.status ?? 'available',
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues?.id ? '호실 수정' : '호실 추가'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="room_number">호실 번호</Label>
            <Input
              id="room_number"
              placeholder="예: 101, 201, 301"
              {...form.register('room_number')}
            />
            {form.formState.errors.room_number && (
              <p className="text-sm text-destructive">{form.formState.errors.room_number.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="floor">층</Label>
            <Input
              id="floor"
              type="number"
              min={1}
              {...form.register('floor', { valueAsNumber: true })}
            />
          </div>

          <div className="space-y-2">
            <Label>상태</Label>
            <Select
              value={form.watch('status')}
              onValueChange={(v) => form.setValue('status', v as Room['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">사용가능</SelectItem>
                <SelectItem value="maintenance">정비중</SelectItem>
                <SelectItem value="out_of_order">사용불가</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '저장 중...' : '저장'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
