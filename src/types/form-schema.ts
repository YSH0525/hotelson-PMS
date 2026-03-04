export interface FormFieldOption {
  id: string
  label: string
  value: string
  color?: string
  sortOrder: number
}

export interface FormFieldDefinition {
  id: string
  label: string
  fieldType: 'text' | 'number' | 'select' | 'multi-select' | 'date' | 'textarea' | 'checkbox'
  required: boolean
  sortOrder: number
  options?: FormFieldOption[]
  defaultValue?: string | number | boolean
  placeholder?: string
  width: 'full' | 'half' | 'third'
}

export type { FormSchema } from './database'
