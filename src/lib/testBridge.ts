import { useAssetStore } from '@/store/assetStore'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useToolStore } from '@/store/toolStore'

/**
 * E2E(Playwright)에서 편집 상태를 결정적으로 세팅하기 위한 브리지.
 *
 * 클립 배치는 dnd-kit 드래그로만 가능해서, 브라우저 자동화로 재현하면
 * 패널 크기·스크롤·zoom에 따라 쉽게 깨진다. 테스트 대상은 "드래그"가 아니라
 * "캔버스에 무엇이 어떻게 그려지는가"이므로, 세팅만 store로 건너뛰고
 * 검증은 실제 렌더 결과(canvas 픽셀)로 한다.
 *
 * 개발 빌드에서만 노출된다. 프로덕션 번들에는 아래 블록이 통째로 제거된다.
 */
export interface EditorTestBridge {
  timeline: typeof useTimelineStore
  assets: typeof useAssetStore
  tool: typeof useToolStore
  project: typeof useProjectStore
}

declare global {
  interface Window {
    __editorTest?: EditorTestBridge
  }
}

export function installTestBridge(): void {
  if (!import.meta.env.DEV) return
  if (typeof window === 'undefined') return

  window.__editorTest = {
    timeline: useTimelineStore,
    assets: useAssetStore,
    tool: useToolStore,
    project: useProjectStore,
  }
}
