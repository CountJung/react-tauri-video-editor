import { useEffect, useRef, useState } from 'react'

/**
 * localStorage에 상태를 저장하는 useState 변형.
 * 첫 렌더링 시 storage에서 값을 복원하고, 변경 시 자동 저장한다.
 */
export function useStickyState<T>(
  defaultValue: T,
  storageKey: string
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw !== null) return JSON.parse(raw) as T
    } catch {
      // storage 접근 불가 또는 파싱 오류 — 기본값 사용
    }
    return defaultValue
  })

  const isFirstRef = useRef(true)

  useEffect(() => {
    if (isFirstRef.current) {
      isFirstRef.current = false
      return
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // storage 접근 불가 — 무시
    }
  }, [state, storageKey])

  return [state, setState]
}
