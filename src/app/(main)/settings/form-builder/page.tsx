'use client'

import { useState, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Pencil, Trash2, GripVertical, Settings2, Save } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { useDefaultFormSchema } from '@/hooks/use-form-schemas'
import { DynamicFieldRenderer } from '@/components/form-builder/dynamic-field-renderer'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import type { FormFieldDefinition, FormFieldOption } from '@/types/form-schema'

const FIELD_TYPES = [
  { value: 'text', label: '텍스트' },
  { value: 'number', label: '숫자' },
  { value: 'select', label: '선택 (드롭다운)' },
  { value: 'multi-select', label: '다중 선택' },
  { value: 'date', label: '날짜' },
  { value: 'textarea', label: '텍스트 영역' },
  { value: 'checkbox', label: '체크박스' },
] as const

function generateId() {
  return `field_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function generateOptId() {
  return `opt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

export default function FormBuilderPage() {
  const { data: schema, isLoading } = useDefaultFormSchema()
  const queryClient = useQueryClient()
  const supabase = createClient()

  const [fields, setFields] = useState<FormFieldDefinition[]>([])
  const [initialized, setInitialized] = useState(false)
  const [editingField, setEditingField] = useState<FormFieldDefinition | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null)

  // 스키마 로드 시 fields 초기화
  if (schema && !initialized) {
    setFields((schema.fields as unknown as FormFieldDefinition[]) || [])
    setInitialized(true)
  }

  const saveMutation = useMutation({
    mutationFn: async (updatedFields: FormFieldDefinition[]) => {
      if (!schema) return
      const { error } = await supabase
        .from('form_schemas')
        .update({ fields: JSON.parse(JSON.stringify(updatedFields)) })
        .eq('id', schema.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['formSchema'] })
      toast.success('폼 스키마가 저장되었습니다.')
    },
    onError: () => {
      toast.error('저장에 실패했습니다.')
    },
  })

  const handleSave = () => {
    saveMutation.mutate(fields)
  }

  const handleAddField = () => {
    const newField: FormFieldDefinition = {
      id: generateId(),
      label: '새 필드',
      fieldType: 'text',
      required: false,
      sortOrder: fields.length,
      width: 'half',
      placeholder: '',
    }
    setEditingField(newField)
    setEditDialogOpen(true)
  }

  const handleEditField = (field: FormFieldDefinition) => {
    setEditingField({ ...field, options: field.options ? [...field.options] : undefined })
    setEditDialogOpen(true)
  }

  const handleSaveField = (field: FormFieldDefinition) => {
    setFields((prev) => {
      const idx = prev.findIndex((f) => f.id === field.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = field
        return next
      }
      return [...prev, field]
    })
    setEditDialogOpen(false)
    setEditingField(null)
  }

  const handleDeleteField = () => {
    if (!deleteFieldId) return
    setFields((prev) => prev.filter((f) => f.id !== deleteFieldId))
    setDeleteFieldId(null)
  }

  const moveField = useCallback((index: number, direction: 'up' | 'down') => {
    setFields((prev) => {
      const next = [...prev]
      const swapIdx = direction === 'up' ? index - 1 : index + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[index], next[swapIdx]] = [next[swapIdx], next[index]]
      return next.map((f, i) => ({ ...f, sortOrder: i }))
    })
  }, [])

  return (
    <>
      <Header title="예약폼 빌더" />
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">예약 폼 필드 관리</h2>
            <p className="text-sm text-muted-foreground">
              예약 생성 시 입력할 추가 필드와 드롭다운 옵션을 설정합니다.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleAddField}>
              <Plus className="h-4 w-4 mr-1" />
              필드 추가
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" />
              {saveMutation.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 필드 목록 */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">필드 목록</h3>
            {isLoading ? (
              <p className="text-muted-foreground text-sm">로딩 중...</p>
            ) : fields.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center py-8">
                  <Settings2 className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">등록된 필드가 없습니다.</p>
                  <Button variant="outline" className="mt-3" onClick={handleAddField}>
                    <Plus className="h-4 w-4 mr-1" />
                    필드 추가
                  </Button>
                </CardContent>
              </Card>
            ) : (
              fields
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="flex items-center gap-3 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === 0}
                          onClick={() => moveField(index, 'up')}
                        >
                          ▲
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5"
                          disabled={index === fields.length - 1}
                          onClick={() => moveField(index, 'down')}
                        >
                          ▼
                        </Button>
                      </div>
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{field.label}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            {FIELD_TYPES.find((t) => t.value === field.fieldType)?.label}
                          </Badge>
                          {field.required && (
                            <Badge variant="outline" className="text-[10px] text-destructive">필수</Badge>
                          )}
                        </div>
                        {field.options && field.options.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            옵션: {field.options.map((o) => o.label).join(', ')}
                          </p>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => handleEditField(field)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteFieldId(field.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </CardContent>
                  </Card>
                ))
            )}
          </div>

          {/* 미리보기 */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm text-muted-foreground">미리보기</h3>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">예약 추가 정보</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {fields.length === 0 ? (
                  <p className="text-sm text-muted-foreground">필드를 추가하면 여기에 미리보기가 표시됩니다.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {fields
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((field) => (
                        <div
                          key={field.id}
                          className={
                            field.width === 'full' ? 'col-span-2' :
                            field.width === 'third' ? 'col-span-1' :
                            'col-span-1'
                          }
                        >
                          <DynamicFieldRenderer
                            field={field}
                            value={field.defaultValue ?? ''}
                            onChange={() => {}}
                          />
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* 필드 편집 다이얼로그 */}
      <FieldEditDialog
        open={editDialogOpen}
        onOpenChange={(open) => {
          setEditDialogOpen(open)
          if (!open) setEditingField(null)
        }}
        field={editingField}
        onSave={handleSaveField}
      />

      {/* 필드 삭제 확인 */}
      <ConfirmDialog
        open={!!deleteFieldId}
        onOpenChange={(open) => !open && setDeleteFieldId(null)}
        title="필드 삭제"
        description="이 필드를 삭제하시겠습니까?"
        confirmLabel="삭제"
        variant="destructive"
        onConfirm={handleDeleteField}
      />
    </>
  )
}

// ======== 필드 편집 다이얼로그 ========
function FieldEditDialog({
  open,
  onOpenChange,
  field,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  field: FormFieldDefinition | null
  onSave: (field: FormFieldDefinition) => void
}) {
  const [localField, setLocalField] = useState<FormFieldDefinition | null>(null)

  // field가 변경되면 로컬 상태 업데이트
  if (field && (!localField || localField.id !== field.id)) {
    setLocalField({ ...field })
  }

  if (!localField) return null

  const isSelectType = localField.fieldType === 'select' || localField.fieldType === 'multi-select'

  const handleAddOption = () => {
    const options = localField.options || []
    setLocalField({
      ...localField,
      options: [
        ...options,
        {
          id: generateOptId(),
          label: '',
          value: '',
          sortOrder: options.length,
        },
      ],
    })
  }

  // 한글 라벨 → 영문 slug 자동 생성
  const toSlug = (label: string): string => {
    // 영문/숫자만 추출
    const ascii = label.replace(/[^a-zA-Z0-9\s]/g, '').trim().toLowerCase().replace(/\s+/g, '_')
    return ascii || ''
  }

  const handleUpdateOption = (idx: number, updates: Partial<FormFieldOption>) => {
    const options = [...(localField.options || [])]
    const current = options[idx]

    // label 변경 시 value가 비어있거나 이전 자동생성 값이면 자동 갱신
    if (updates.label !== undefined) {
      const prevAutoValue = toSlug(current.label)
      const isAutoGenerated = !current.value || current.value === prevAutoValue
      if (isAutoGenerated) {
        const newSlug = toSlug(updates.label)
        updates.value = newSlug || `option_${idx + 1}`
      }
    }

    options[idx] = { ...current, ...updates }
    setLocalField({ ...localField, options })
  }

  const handleRemoveOption = (idx: number) => {
    const options = (localField.options || []).filter((_, i) => i !== idx)
    setLocalField({ ...localField, options })
  }

  const handleSave = () => {
    // value 자동 생성: label을 기반으로 (최종 안전장치)
    if (isSelectType && localField.options) {
      localField.options = localField.options.map((opt, idx) => ({
        ...opt,
        value: opt.value || toSlug(opt.label) || `option_${idx + 1}`,
      }))
    }
    onSave(localField)
    setLocalField(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setLocalField(null) }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>필드 편집</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>필드명</Label>
              <Input
                value={localField.label}
                onChange={(e) => setLocalField({ ...localField, label: e.target.value })}
                placeholder="예: 예약 채널"
              />
            </div>
            <div className="space-y-2">
              <Label>필드 타입</Label>
              <Select
                value={localField.fieldType}
                onValueChange={(v) =>
                  setLocalField({
                    ...localField,
                    fieldType: v as FormFieldDefinition['fieldType'],
                    options: v === 'select' || v === 'multi-select' ? localField.options || [] : undefined,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>너비</Label>
              <Select
                value={localField.width}
                onValueChange={(v) => setLocalField({ ...localField, width: v as FormFieldDefinition['width'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="half">1/2</SelectItem>
                  <SelectItem value="full">전체</SelectItem>
                  <SelectItem value="third">1/3</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>필수 여부</Label>
              <Select
                value={localField.required ? 'true' : 'false'}
                onValueChange={(v) => setLocalField({ ...localField, required: v === 'true' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">선택</SelectItem>
                  <SelectItem value="true">필수</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>플레이스홀더</Label>
            <Input
              value={localField.placeholder || ''}
              onChange={(e) => setLocalField({ ...localField, placeholder: e.target.value })}
              placeholder="입력 힌트 텍스트"
            />
          </div>

          {/* 옵션 관리 (select 타입) */}
          {isSelectType && (
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">옵션 (드롭다운 항목)</Label>
                <Button variant="outline" size="sm" onClick={handleAddOption}>
                  <Plus className="h-3 w-3 mr-1" />
                  옵션 추가
                </Button>
              </div>
              {(localField.options || []).map((opt, idx) => (
                <div key={opt.id} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{idx + 1}</span>
                  <Input
                    value={opt.label}
                    onChange={(e) => handleUpdateOption(idx, { label: e.target.value })}
                    placeholder="표시명 (예: 야놀자)"
                    className="flex-1"
                  />
                  <Input
                    value={opt.value}
                    onChange={(e) => handleUpdateOption(idx, { value: e.target.value })}
                    placeholder="값 (자동생성)"
                    className="w-32"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => handleRemoveOption(idx)}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
              {(localField.options || []).length === 0 && (
                <p className="text-xs text-muted-foreground">옵션을 추가해주세요.</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setLocalField(null) }}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
