'use client'

import { useEffect } from 'react'

/**
 * 범용 핫키 훅
 * @param key - KeyboardEvent.key 값 (예: 'F2', 'Escape')
 * @param handler - 키가 눌렸을 때 호출할 핸들러
 * @param enabled - 핫키 활성화 여부 (기본 true)
 */
export function useHotkey(key: string, handler: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const onKeyDown = (e: KeyboardEvent) => {
      // input, textarea, select 등 포커스 중일 때는 무시
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return
      }

      if (e.key === key) {
        e.preventDefault()
        handler()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [key, handler, enabled])
}
