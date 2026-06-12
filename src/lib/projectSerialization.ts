import { useAssetStore } from '@/store/assetStore'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'

/** 현재 앱 상태를 `.vedproj` JSON 문자열로 직렬화 */
export function buildProjectJson(): string {
  const meta = useProjectStore.getState().currentProject
  const tracks = useTimelineStore.getState().tracks
  const assets = useAssetStore.getState().assets
  return JSON.stringify({ meta, tracks, assets }, null, 2)
}
