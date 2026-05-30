import { useHistoryStore } from '@/store/historyStore'

/**
 * timelineStore 액션 실행 전 히스토리 스냅샷을 자동으로 저장하는 래퍼.
 *
 * @example
 * withHistory('클립 추가', () => addClip(trackId, asset, startSec))
 */
export function withHistory(label: string, action: () => void): void {
  useHistoryStore.getState().pushSnapshot(label)
  action()
}
