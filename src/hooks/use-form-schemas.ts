'use client'

import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { FormSchema } from '@/types/database'

export function useDefaultFormSchema() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['formSchema', 'default'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_schemas')
        .select('*')
        .eq('is_default', true)
        .single()
      if (error) throw error
      return data as FormSchema
    },
  })
}

export function useFormSchemas() {
  const supabase = createClient()

  return useQuery({
    queryKey: ['formSchemas'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('form_schemas')
        .select('*')
        .order('created_at')
      if (error) throw error
      return data as FormSchema[]
    },
  })
}
