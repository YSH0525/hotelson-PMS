'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { CashLedger, CashLedgerInsert } from '@/types/database'

export function useCashLedger(date: string) {
  const supabase = createClient()

  return useQuery({
    queryKey: ['cashLedger', date],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_ledger')
        .select('*')
        .eq('entry_date', date)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data as CashLedger[]
    },
  })
}

export interface CashSummary {
  opening: number
  totalIncome: number
  totalExpense: number
  expectedCash: number
  closing: number | null
  difference: number | null
}

export function useCashSummary(entries: CashLedger[]): CashSummary {
  const opening = entries
    .filter((e) => e.entry_type === 'opening')
    .reduce((sum, e) => sum + e.amount, 0)

  const totalIncome = entries
    .filter((e) => e.entry_type === 'income')
    .reduce((sum, e) => sum + e.amount, 0)

  const totalExpense = entries
    .filter((e) => e.entry_type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0)

  const expectedCash = opening + totalIncome - totalExpense

  const closingEntries = entries.filter((e) => e.entry_type === 'closing')
  const closing = closingEntries.length > 0 ? closingEntries[0].amount : null

  const difference = closing !== null ? closing - expectedCash : null

  return { opening, totalIncome, totalExpense, expectedCash, closing, difference }
}

export function useCreateCashEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (entry: CashLedgerInsert) => {
      const { data, error } = await supabase
        .from('cash_ledger')
        .insert(entry)
        .select()
        .single()
      if (error) throw error
      return data as CashLedger
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] })
    },
  })
}

export function useUpdateCashEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, amount, memo }: { id: string; amount: number; memo?: string }) => {
      const { data, error } = await supabase
        .from('cash_ledger')
        .update({ amount, memo })
        .eq('id', id)
        .select()
        .single()
      if (error) throw error
      return data as CashLedger
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] })
    },
  })
}

export function useDeleteCashEntry() {
  const supabase = createClient()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('cash_ledger')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cashLedger'] })
    },
  })
}
