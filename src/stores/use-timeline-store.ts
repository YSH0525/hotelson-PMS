import { create } from 'zustand'
import { startOfMonth, addMonths } from 'date-fns'

interface TimelineState {
  startDate: Date
  daysToShow: number
  selectedRoomId: string | null
  selectedDate: string | null
  hidePastDays: boolean
  searchQuery: string
  setStartDate: (date: Date) => void
  setDaysToShow: (days: number) => void
  goToMonth: (year: number, month: number) => void
  goToPrevMonth: () => void
  goToNextMonth: () => void
  goToToday: () => void
  setSelectedCell: (roomId: string | null, date: string | null) => void
  toggleHidePastDays: () => void
  setSearchQuery: (query: string) => void
}

export const useTimelineStore = create<TimelineState>((set, get) => ({
  startDate: startOfMonth(new Date()),
  daysToShow: 31,
  selectedRoomId: null,
  selectedDate: null,
  hidePastDays: true,
  searchQuery: '',

  setStartDate: (date) => set({ startDate: date }),
  setDaysToShow: (days) => set({ daysToShow: days }),

  goToMonth: (year, month) =>
    set({ startDate: new Date(year, month - 1, 1) }),

  goToPrevMonth: () =>
    set((state) => ({ startDate: addMonths(state.startDate, -1) })),

  goToNextMonth: () =>
    set((state) => ({ startDate: addMonths(state.startDate, 1) })),

  goToToday: () =>
    set({ startDate: startOfMonth(new Date()) }),

  setSelectedCell: (roomId, date) =>
    set({ selectedRoomId: roomId, selectedDate: date }),

  toggleHidePastDays: () =>
    set((state) => ({ hidePastDays: !state.hidePastDays })),

  setSearchQuery: (query) => set({ searchQuery: query }),
}))
