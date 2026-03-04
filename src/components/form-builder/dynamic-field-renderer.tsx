'use client'

import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { FormFieldDefinition } from '@/types/form-schema'

interface DynamicFieldRendererProps {
  field: FormFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
}

export function DynamicFieldRenderer({ field, value, onChange }: DynamicFieldRendererProps) {
  const stringValue = value != null ? String(value) : ''

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.required && <span className="text-destructive ml-1">*</span>}
      </Label>

      {field.fieldType === 'text' && (
        <Input
          placeholder={field.placeholder}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.fieldType === 'number' && (
        <Input
          type="number"
          placeholder={field.placeholder}
          value={stringValue}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )}

      {field.fieldType === 'textarea' && (
        <Textarea
          placeholder={field.placeholder}
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.fieldType === 'select' && (
        <Select value={stringValue} onValueChange={(v) => onChange(v)}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder ?? '선택하세요'} />
          </SelectTrigger>
          <SelectContent>
            {field.options
              ?.sort((a, b) => a.sortOrder - b.sortOrder)
              .map((opt) => (
                <SelectItem key={opt.id} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      )}

      {field.fieldType === 'date' && (
        <Input
          type="date"
          value={stringValue}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {field.fieldType === 'checkbox' && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm">{field.placeholder}</span>
        </div>
      )}
    </div>
  )
}
