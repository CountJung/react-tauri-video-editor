import { useHistoryStore } from '@/store/historyStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useToolStore } from '@/store/toolStore'
import type { ToolType } from '@/store/toolStore'
import { useCallback, useEffect } from 'react'
import { withHistory } from './withHistory'

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

export interface ShortcutHandlers {
  onSave?: () => void
  onSaveAs?: () => void
  onNewProject?: () => void
  onOpenProject?: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_KEY_MAP: Record<string, ToolType> = {
  v: 'select',
  t: 'text',
  r: 'rect',
  c: 'circle',
  a: 'arrow',
  x: 'crop',
  s: 'razor',
}

// ─────────────────────────────────────────────────────────────────────────────
// 훅
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 전역 키보드 단축키 훅. `__root.tsx`의 GlobalAppBar 컴포넌트에 마운트한다.
 *
 * | 단축키 | 동작 |
 * |---|---|
 * | Ctrl+Z | 실행 취소 |
 * | Ctrl+Y / Ctrl+Shift+Z | 다시 실행 |
 * | Ctrl+S | 저장 |
 * | Ctrl+Shift+S | 다른 이름으로 저장 |
 * | Ctrl+N | 새 프로젝트 |
 * | Ctrl+O | 열기 |
 * | Space | 재생/일시정지 토글 |
 * | Delete/Backspace | 선택된 클립 삭제 |
 * | V/T/R/C/A/X/S | 도구 선택 |
 */
export function useGlobalShortcuts(handlers: ShortcutHandlers) {
  const { onSave, onSaveAs, onNewProject, onOpenProject } = handlers

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      const target = e.target as HTMLElement

      // 텍스트 입력 필드에서는 단축키 비활성화
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Undo: Ctrl+Z
      if (ctrl && key === 'z' && !e.shiftKey) {
        e.preventDefault()
        useHistoryStore.getState().undo()
        return
      }

      // Redo: Ctrl+Y 또는 Ctrl+Shift+Z
      if (ctrl && (key === 'y' || (key === 'z' && e.shiftKey))) {
        e.preventDefault()
        useHistoryStore.getState().redo()
        return
      }

      // Save As: Ctrl+Shift+S (Ctrl+S 앞에 확인)
      if (ctrl && key === 's' && e.shiftKey) {
        e.preventDefault()
        onSaveAs?.()
        return
      }

      // Save: Ctrl+S
      if (ctrl && key === 's') {
        e.preventDefault()
        onSave?.()
        return
      }

      // New: Ctrl+N
      if (ctrl && key === 'n') {
        e.preventDefault()
        onNewProject?.()
        return
      }

      // Open: Ctrl+O
      if (ctrl && key === 'o') {
        e.preventDefault()
        onOpenProject?.()
        return
      }

      // Space — 재생/일시정지
      if (key === ' ') {
        e.preventDefault()
        const { isPlaying, setPlaying, duration } = useTimelineStore.getState()
        if (!isPlaying && duration <= 0) return
        setPlaying(!isPlaying)
        return
      }

      // Delete/Backspace — 선택된 클립 삭제
      if (key === 'delete' || key === 'backspace') {
        const { selectedClipId } = useTimelineStore.getState()
        if (selectedClipId) {
          e.preventDefault()
          withHistory('클립 삭제', () => useTimelineStore.getState().removeClip(selectedClipId))
        }
        return
      }

      // 도구 선택 단축키 (수정자 키 없음)
      if (!ctrl && !e.altKey && !e.shiftKey) {
        const tool = TOOL_KEY_MAP[key]
        if (tool) {
          useToolStore.getState().setActiveTool(tool)
        }
      }
    },
    [onSave, onSaveAs, onNewProject, onOpenProject]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
