'use client'

import { useState, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'

interface CurrencyInputProps {
  value: number
  onChange: (value: number) => void
  placeholder?: string
  id?: string
  className?: string
}

export function CurrencyInput({ value, onChange, placeholder = '0', id, className }: CurrencyInputProps) {
  const [display, setDisplay] = useState('')

  useEffect(() => {
    setDisplay(value ? value.toLocaleString() : '')
  }, [value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '')
    if (raw === '') {
      setDisplay('')
      onChange(0)
      return
    }
    const num = parseInt(raw, 10)
    setDisplay(num.toLocaleString())
    onChange(num)
  }, [onChange])

  return (
    <Input
      id={id}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  )
}
