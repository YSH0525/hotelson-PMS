'use client'

import { useMemo } from 'react'
import { useDefaultFormSchema } from './use-form-schemas'
import { CHANNELS } from '@/lib/channels'
import type { FormFieldDefinition } from '@/types/form-schema'

export interface ChannelOption {
  key: string
  label: string
  color: string
}

/**
 * DB 폼 스키마의 field_channel 옵션을 반환.
 * 폼 스키마가 없거나 로딩 중이면 하드코딩된 CHANNELS를 fallback으로 사용.
 */
export function useChannelOptions() {
  const { data: schema } = useDefaultFormSchema()

  const options = useMemo(() => {
    const fields = (schema?.fields ?? []) as unknown as FormFieldDefinition[]
    const channelField = fields.find((f) => f.id === 'field_channel')

    if (channelField?.options && channelField.options.length > 0) {
      return channelField.options
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((opt) => ({
          key: opt.value,
          label: opt.label,
          color: opt.color || '#6B7280',
        }))
    }

    // fallback: 하드코딩된 CHANNELS
    return Object.entries(CHANNELS).map(([key, ch]) => ({
      key,
      label: ch.label,
      color: ch.color,
    }))
  }, [schema])

  const getLabel = useMemo(() => {
    const map = new Map(options.map((o) => [o.key, o.label]))
    return (key: string | undefined | null): string => {
      if (!key) return options[0]?.label ?? '직접 예약'
      return map.get(key) ?? key
    }
  }, [options])

  const getColor = useMemo(() => {
    const map = new Map(options.map((o) => [o.key, o.color]))
    return (key: string): string => map.get(key) ?? '#6B7280'
  }, [options])

  return { options, getLabel, getColor }
}
