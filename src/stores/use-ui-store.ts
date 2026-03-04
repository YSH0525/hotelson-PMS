import { create } from 'zustand'
import type { EntryType } from '@/lib/constants'

interface UIState {
  sidebarOpen: boolean
  reservationDialogOpen: boolean
  hourlyDialogOpen: boolean
  otherRevenueDialogOpen: boolean
  editingReservationId: string | null
  editingEntryType: EntryType | null
  setSidebarOpen: (open: boolean) => void
  openReservationDialog: (reservationId?: string) => void
  closeReservationDialog: () => void
  openHourlyDialog: (reservationId?: string) => void
  closeHourlyDialog: () => void
  openOtherRevenueDialog: (reservationId?: string) => void
  closeOtherRevenueDialog: () => void
  openEditDialog: (entryType: EntryType, reservationId: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  reservationDialogOpen: false,
  hourlyDialogOpen: false,
  otherRevenueDialogOpen: false,
  editingReservationId: null,
  editingEntryType: null,

  setSidebarOpen: (open) => set({ sidebarOpen: open }),

  openReservationDialog: (reservationId) =>
    set({
      reservationDialogOpen: true,
      editingReservationId: reservationId ?? null,
      editingEntryType: 'stay',
    }),

  closeReservationDialog: () =>
    set({
      reservationDialogOpen: false,
      editingReservationId: null,
      editingEntryType: null,
    }),

  openHourlyDialog: (reservationId) =>
    set({
      hourlyDialogOpen: true,
      editingReservationId: reservationId ?? null,
      editingEntryType: 'hourly',
    }),

  closeHourlyDialog: () =>
    set({
      hourlyDialogOpen: false,
      editingReservationId: null,
      editingEntryType: null,
    }),

  openOtherRevenueDialog: (reservationId) =>
    set({
      otherRevenueDialogOpen: true,
      editingReservationId: reservationId ?? null,
      editingEntryType: 'other_revenue',
    }),

  closeOtherRevenueDialog: () =>
    set({
      otherRevenueDialogOpen: false,
      editingReservationId: null,
      editingEntryType: null,
    }),

  openEditDialog: (entryType, reservationId) => {
    switch (entryType) {
      case 'stay':
        set({ reservationDialogOpen: true, editingReservationId: reservationId, editingEntryType: 'stay' })
        break
      case 'hourly':
        set({ hourlyDialogOpen: true, editingReservationId: reservationId, editingEntryType: 'hourly' })
        break
      case 'other_revenue':
        set({ otherRevenueDialogOpen: true, editingReservationId: reservationId, editingEntryType: 'other_revenue' })
        break
    }
  },
}))
