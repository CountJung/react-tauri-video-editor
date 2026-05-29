import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// 도구 타입
// ─────────────────────────────────────────────────────────────────────────────

/**
 * 도구 타입:
 * - select: 오브젝트 선택·이동·리사이즈·회전
 * - text:   Canvas 클릭 → TextClip 삽입
 * - rect:   드래그 → 사각형 ShapeClip 삽입
 * - circle: 드래그 → 원형 ShapeClip 삽입
 * - arrow:  드래그 → 화살표 ShapeClip 삽입
 * - crop:   클립의 표시 영역 자르기 (cropRect 편집)
 * - razor:  클릭 위치에서 클립 분할
 */
export type ToolType = 'select' | 'text' | 'rect' | 'circle' | 'arrow' | 'crop' | 'razor'

export interface ToolStoreState {
  activeTool: ToolType
  setActiveTool: (tool: ToolType) => void
}

export const useToolStore = create<ToolStoreState>((set) => ({
  activeTool: 'select',
  setActiveTool: (tool) => set({ activeTool: tool }),
}))
