'use client'

import { useForm } from 'react-hook-form'
import { z } from 'zod/v4'
import { zodResolver } from '@hookform/resolvers/zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { DEFAULT_COLORS } from '@/lib/constants'
import type { RoomType } from '@/types/database'

const roomTypeSchema = z.object({
  name: z.string().min(1, '객실타입명을 입력하세요'),
  color: z.string().min(1),
  default_price: z.number().min(0, '0 이상 입력하세요'),
})

type RoomTypeFormData = z.infer<typeof roomTypeSchema>

interface RoomTypeFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (data: RoomTypeFormData) => void
  defaultValues?: Partial<RoomType>
  loading?: boolean
}

export function RoomTypeForm({
  open,
  onOpenChange,
  onSubmit,
  defaultValues,
  loading,
}: RoomTypeFormProps) {
  const form = useForm<RoomTypeFormData>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: {
      name: defaultValues?.name ?? '',
      color: defaultValues?.color ?? DEFAULT_COLORS[0],
      default_price: defaultValues?.default_price ?? 0,
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    onSubmit(data)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues?.id ? '객실타입 수정' : '객실타입 추가'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">객실타입명</Label>
            <Input
              id="name"
              placeholder="예: 스탠다드, 디럭스, 스위트"
              {...form.register('name')}
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>색상</Label>
            <div className="flex gap-2 flex-wrap">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    form.watch('color') === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => form.setValue('color', color)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default_price">기본 요금 (원)</Label>
            <CurrencyInput
              id="default_price"
              value={form.watch('default_price') || 0}
              onChange={(v) => form.setValue('default_price', v)}
            />
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
