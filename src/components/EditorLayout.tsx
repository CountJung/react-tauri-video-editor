import { STORAGE_KEYS } from '@/lib/storageKeys'
import { useStickyState } from '@/lib/useStickyState'
import { useAssetStore } from '@/store/assetStore'
import { useTimelineStore } from '@/store/timelineStore'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useState } from 'react'
import { AssetPanel } from './assets/AssetPanel'
import { LayoutResizer } from './common/LayoutResizer'
import { PreviewPlayer } from './preview/PreviewPlayer'
import { PropertiesPanel } from './properties/PropertiesPanel'
import { TimelinePanel } from './timeline/TimelinePanel'
import { ToolPanel } from './toolbar/ToolPanel'

interface OverlayInfo {
  label: string
  color: string
}

/**
 * 에디터 메인 레이아웃 — DndContext 포함
 *
 * +------------------+-----------------------------+
 * | AssetPanel (좌측) |   PreviewPlayer (우측상)    |
 * |                  +-----------------------------+
 * |                  |   TimelinePanel (우측하)    |
 * +------------------+-----------------------------+
 */
export function EditorLayout() {
  const assets = useAssetStore((s) => s.assets)
  const addClip = useTimelineStore((s) => s.addClip)
  const moveClip = useTimelineStore((s) => s.moveClip)
  const [overlayInfo, setOverlayInfo] = useState<OverlayInfo | null>(null)

  const [assetWidth, setAssetWidth] = useStickyState(240, STORAGE_KEYS.PANEL_ASSET_WIDTH)
  const [previewHeight, setPreviewHeight] = useStickyState(300, STORAGE_KEYS.PANEL_PREVIEW_HEIGHT)
  const [propsWidth, setPropsWidth] = useStickyState(240, STORAGE_KEYS.PANEL_PROPERTIES_WIDTH)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current
    if (data?.type === 'asset') {
      const asset = assets.find((a) => a.id === event.active.id)
      setOverlayInfo({ label: asset?.name ?? '에셋', color: '#1565c0' })
    } else if (data?.type === 'clip') {
      setOverlayInfo({ label: data.clipName ?? 'Clip', color: '#0d47a1' })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setOverlayInfo(null)
    const { active, over } = event
    if (!over) return

    const activeData = active.data.current
    const overData = over.data.current

    // 에셋 → 트랙 드롭
    if (activeData?.type === 'asset' && overData?.type === 'track') {
      const asset = assets.find((a) => a.id === active.id)
      if (!asset) return
      const { zoom } = useTimelineStore.getState()
      // getBoundingClientRect 기반이므로 scrollLeft는 별도 보정 불필요
      const translated = active.rect.current.translated
      const dropX = translated != null ? translated.left - over.rect.left : 0
      addClip(overData.trackId, asset, Math.max(0, dropX / zoom))
    }

    // 클립 이동 (delta.x / zoom = 이동한 초)
    if (activeData?.type === 'clip') {
      const { clipId, originalStart } = activeData
      const { zoom } = useTimelineStore.getState()
      moveClip(clipId, Math.max(0, originalStart + event.delta.x / zoom))
    }
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
        {/* 좌측: 에셋 패널 (너비 조절 가능) */}
        <Box
          sx={{
            width: assetWidth,
            minWidth: 160,
            maxWidth: 500,
            flexShrink: 0,
            borderRight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <AssetPanel />
        </Box>

        <LayoutResizer
          direction="vertical"
          onResize={(d) => setAssetWidth((w) => Math.max(160, Math.min(500, w + d)))}
        />

        {/* 중앙: 프리뷰 + 타임라인 */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box
            sx={{
              height: previewHeight,
              minHeight: 120,
              flexShrink: 0,
              borderBottom: 0,
              display: 'flex',
              overflow: 'hidden',
            }}
          >
            {/* 도구 패널 (선택/텍스트/도형/자르기/분할) */}
            <ToolPanel />
            {/* 프리뷰 플레이어 */}
            <Box sx={{ flex: 1, overflow: 'hidden' }}>
              <PreviewPlayer />
            </Box>
          </Box>
          <LayoutResizer
            direction="horizontal"
            onResize={(d) => setPreviewHeight((h) => Math.max(120, Math.min(600, h + d)))}
          />
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <TimelinePanel />
          </Box>
        </Box>

        <LayoutResizer
          direction="vertical"
          onResize={(d) => setPropsWidth((w) => Math.max(180, Math.min(480, w - d)))}
        />

        {/* 우측: 속성 패널 (도구별 옵션) */}
        <Box
          sx={{
            width: propsWidth,
            minWidth: 180,
            maxWidth: 480,
            flexShrink: 0,
            overflow: 'hidden',
          }}
        >
          <PropertiesPanel />
        </Box>
      </Box>

      {/* 드래그 중 표시되는 유령 요소 */}
      <DragOverlay dropAnimation={null}>
        {overlayInfo && (
          <Box
            sx={{
              px: 1.5,
              py: 0.5,
              bgcolor: overlayInfo.color,
              borderRadius: 1,
              opacity: 0.88,
              boxShadow: 4,
              maxWidth: 200,
            }}
          >
            <Typography variant="caption" noWrap sx={{ color: '#fff', fontWeight: 500 }}>
              {overlayInfo.label}
            </Typography>
          </Box>
        )}
      </DragOverlay>
    </DndContext>
  )
}
