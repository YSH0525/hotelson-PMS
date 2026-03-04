'use client'

import { create } from 'zustand'

// ── localStorage 키 ──

const STORAGE_KEY = 'inventory-panel-position'
const DAYS_KEY = 'inventory-panel-days'

function loadPosition() {
  if (typeof window === 'undefined') return { x: 20, y: 80 }
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as { x: number; y: number }
  } catch {}
  return { x: 20, y: 80 }
}

function loadDays(): number {
  if (typeof window === 'undefined') return 7
  try {
    const saved = localStorage.getItem(DAYS_KEY)
    if (saved) return Number(saved)
  } catch {}
  return 7
}

// ── 타입 ──

interface PanelState {
  isOpen: boolean
  position: { x: number; y: number }
  days: number
  toggle: () => void
  close: () => void
  setPosition: (pos: { x: number; y: number }) => void
  setDays: (days: number) => void
}

// ── 스토어 ──

export const usePanelStore = create<PanelState>((set) => ({
  isOpen: false,
  position: loadPosition(),
  days: loadDays(),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),
  close: () => set({ isOpen: false }),
  setPosition: (position) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position))
    set({ position })
  },
  setDays: (days) => {
    localStorage.setItem(DAYS_KEY, String(days))
    set({ days })
  },
}))
