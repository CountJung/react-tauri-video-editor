import { withHistory } from '@/lib/withHistory'
import { useAssetStore } from '@/store/assetStore'
import { useHistoryStore } from '@/store/historyStore'
import type { Clip, Track } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import AddIcon from '@mui/icons-material/Add'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import LockIcon from '@mui/icons-material/Lock'
import LockOpenIcon from '@mui/icons-material/LockOpen'
import RemoveIcon from '@mui/icons-material/Remove'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { useCallback, useMemo, useRef } from 'react'

// ── 상수 ─────────────────────────────────────────────────────────────────────
const LABEL_WIDTH = 224
const RULER_HEIGHT = 28
const TRACK_HEIGHT = 64
const ZOOM_FACTOR = 1.25

// ── 유틸리티 ─────────────────────────────────────────────────────────────────
function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

interface Tick {
  time: number
  x: number
  major: boolean
}

/** zoom에 따라 적응적 간격의 눈금자 틱 배열 생성 */
function computeTicks(totalSecs: number, zoom: number): Tick[] {
  let minorSec: number
  let majorSec: number
  if (zoom >= 200) {
    minorSec = 0.5
    majorSec = 5
  } else if (zoom >= 80) {
    minorSec = 1
    majorSec = 5
  } else if (zoom >= 30) {
    minorSec = 2
    majorSec = 10
  } else if (zoom >= 12) {
    minorSec = 5
    majorSec = 30
  } else {
    minorSec = 10
    majorSec = 60
  }
  const ticks: Tick[] = []
  let t = 0
  while (t <= totalSecs + minorSec) {
    ticks.push({ time: t, x: Math.round(t * zoom), major: t % majorSec === 0 })
    t = Math.round((t + minorSec) * 10000) / 10000
  }
  return ticks
}

// ── TrimHandle ────────────────────────────────────────────────────────────────
interface TrimHandleProps {
  side: 'start' | 'end'
  clip: Clip
  zoom: number
  disabled: boolean
}

function TrimHandle({ side, clip, zoom, disabled }: TrimHandleProps) {
  const trimClipStart = useTimelineStore((s) => s.trimClipStart)
  const trimClipEnd = useTimelineStore((s) => s.trimClipEnd)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return
      e.stopPropagation() // dnd-kit 드래그 방지
      e.preventDefault()

      const startX = e.clientX
      const startTrimStart = clip.trimStart
      const startTrimEnd = clip.trimEnd
      const label = side === 'start' ? '클립 앞부분 트림' : '클립 뒷부분 트림'

      // 트림 시작 전 스냅샷 저장
      useHistoryStore.getState().pushSnapshot(label)

      document.body.style.cursor = 'ew-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(ev: MouseEvent) {
        const delta = (ev.clientX - startX) / zoom
        if (side === 'start') {
          trimClipStart(clip.id, startTrimStart + delta)
        } else {
          trimClipEnd(clip.id, startTrimEnd + delta)
        }
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [clip, disabled, zoom, side, trimClipStart, trimClipEnd]
  )

  return (
    <Box
      onPointerDown={handlePointerDown}
      sx={{
        position: 'absolute',
        [side === 'start' ? 'left' : 'right']: 0,
        top: 0,
        bottom: 0,
        width: 8,
        cursor: disabled ? 'not-allowed' : 'ew-resize',
        bgcolor: 'rgba(255,255,255,0.12)',
        zIndex: 3,
        flexShrink: 0,
        '&:hover': { bgcolor: disabled ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.4)' },
      }}
    />
  )
}

// ── ClipItem (draggable) ──────────────────────────────────────────────────────
interface ClipItemProps {
  clip: Clip
  trackType: Track['type']
  zoom: number
  locked: boolean
}

function ClipItem({ clip, trackType, zoom, locked }: ClipItemProps) {
  const assetName = useAssetStore((s) => s.assets.find((a) => a.id === clip.assetId)?.name ?? '')
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: clip.id,
    data: { type: 'clip', clipId: clip.id, clipName: assetName, originalStart: clip.start },
    disabled: locked,
  })

  const bgColor =
    trackType === 'video' ? 'primary.dark' : trackType === 'overlay' ? '#6a1b9a' : 'success.dark'
  const borderColor =
    trackType === 'video' ? 'primary.main' : trackType === 'overlay' ? '#ab47bc' : 'success.main'

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        position: 'absolute',
        left: clip.start * zoom,
        width: Math.max(clip.duration * zoom, 4),
        top: 4,
        height: TRACK_HEIGHT - 8,
        bgcolor: bgColor,
        border: '1px solid',
        borderColor,
        borderRadius: 0.5,
        display: 'flex',
        alignItems: 'center',
        px: 0.75,
        overflow: 'hidden',
        cursor: locked ? 'not-allowed' : isDragging ? 'grabbing' : 'grab',
        opacity: locked ? 0.62 : isDragging ? 0.45 : 1,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        userSelect: 'none',
        zIndex: isDragging ? 10 : 1,
        '&:hover': { filter: 'brightness(1.2)' },
      }}
    >
      <TrimHandle side="start" clip={clip} zoom={zoom} disabled={locked} />
      <Typography
        variant="caption"
        noWrap
        sx={{ fontSize: 10, color: '#fff', pointerEvents: 'none', flex: 1, textAlign: 'center' }}
      >
        {assetName}
      </Typography>
      <TrimHandle side="end" clip={clip} zoom={zoom} disabled={locked} />
    </Box>
  )
}

function trackLabel(track: Track): string {
  if (track.type === 'video') return 'Video'
  if (track.type === 'overlay') return 'Overlay'
  if (track.type === 'text') return 'Text'
  if (track.type === 'shape') return 'Shape'
  return 'Audio'
}

function trackShortLabel(track: Track): string {
  if (track.type === 'video') return 'V'
  if (track.type === 'overlay') return 'OL'
  if (track.type === 'text') return 'T'
  if (track.type === 'shape') return 'S'
  return 'A'
}

function trackGroupLabel(track: Track): string {
  if (track.type === 'video' || track.type === 'overlay') return 'Media'
  if (track.type === 'text' || track.type === 'shape') return 'Graphic'
  return 'Audio'
}

function trackAccentColor(track: Track): string {
  if (track.type === 'video') return '#42a5f5'
  if (track.type === 'overlay') return '#ab47bc'
  if (track.type === 'text') return '#ffb74d'
  if (track.type === 'shape') return '#4db6ac'
  return '#66bb6a'
}

interface LayerCellProps {
  track: Track
  index: number
}

function LayerCell({ track, index }: LayerCellProps) {
  const tracks = useTimelineStore((s) => s.tracks)
  const updateTrackLayer = useTimelineStore((s) => s.updateTrackLayer)
  const opacityHistoryPushedRef = useRef(false)
  const {
    attributes,
    listeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: `layer-${track.id}`,
    data: {
      type: 'track-layer',
      trackId: track.id,
      index,
      label: trackLabel(track),
    },
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `layer-drop-${track.id}`,
    data: { type: 'track-layer', trackId: track.id, index },
  })

  const setRefs = useCallback(
    (node: HTMLDivElement | null) => {
      setDragRef(node)
      setDropRef(node)
    },
    [setDragRef, setDropRef]
  )

  const groupLabel = trackGroupLabel(track)
  const groupTracks = tracks.filter((candidate) => trackGroupLabel(candidate) === groupLabel)
  const groupVisible = groupTracks.some((candidate) => candidate.visible)
  const groupLocked = groupTracks.every((candidate) => candidate.locked)

  const toggleVisible = (event: React.MouseEvent) => {
    event.stopPropagation()
    withHistory('트랙 가시성 변경', () => updateTrackLayer(track.id, { visible: !track.visible }))
  }

  const toggleLocked = (event: React.MouseEvent) => {
    event.stopPropagation()
    withHistory('트랙 잠금 변경', () => updateTrackLayer(track.id, { locked: !track.locked }))
  }

  const toggleGroupVisible = (event: React.MouseEvent) => {
    event.stopPropagation()
    withHistory('트랙 그룹 가시성 변경', () => {
      for (const groupTrack of groupTracks) {
        updateTrackLayer(groupTrack.id, { visible: !groupVisible })
      }
    })
  }

  const toggleGroupLocked = (event: React.MouseEvent) => {
    event.stopPropagation()
    withHistory('트랙 그룹 잠금 변경', () => {
      for (const groupTrack of groupTracks) {
        updateTrackLayer(groupTrack.id, { locked: !groupLocked })
      }
    })
  }

  const updateOpacity = (_: Event, value: number | number[]) => {
    if (!opacityHistoryPushedRef.current) {
      withHistory('트랙 불투명도 변경', () => undefined)
      opacityHistoryPushedRef.current = true
    }
    const opacity = (Array.isArray(value) ? value[0] : value) / 100
    updateTrackLayer(track.id, { opacity })
  }

  const commitOpacity = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const opacity = (Array.isArray(value) ? value[0] : value) / 100
    updateTrackLayer(track.id, { opacity })
    opacityHistoryPushedRef.current = false
  }

  return (
    <Box
      ref={setRefs}
      sx={{
        width: LABEL_WIDTH,
        height: TRACK_HEIGHT,
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: '24px minmax(0, 1fr) 96px',
        gridTemplateRows: '28px 24px',
        alignItems: 'center',
        columnGap: 0.5,
        px: 0.5,
        bgcolor: isOver ? 'action.hover' : 'background.paper',
        borderRight: '1px solid',
        borderColor: 'divider',
        position: 'sticky',
        left: 0,
        zIndex: 2,
        opacity: isDragging ? 0.55 : 1,
        boxShadow: isOver ? 'inset 3px 0 0 rgba(144,202,249,0.9)' : 'none',
      }}
    >
      <Box
        component="span"
        {...attributes}
        {...listeners}
        sx={{
          gridRow: '1 / span 2',
          display: 'grid',
          placeItems: 'center',
          color: 'text.disabled',
          cursor: isDragging ? 'grabbing' : 'grab',
          touchAction: 'none',
        }}
      >
        <DragIndicatorIcon sx={{ fontSize: 16 }} />
      </Box>

      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            bgcolor: trackAccentColor(track),
            flexShrink: 0,
          }}
        />
        <Typography
          variant="caption"
          noWrap
          sx={{ fontSize: 11, fontWeight: 700, color: trackAccentColor(track) }}
        >
          {trackShortLabel(track)} · {trackLabel(track)}
        </Typography>
        <Typography
          variant="caption"
          noWrap
          sx={{ ml: 'auto', fontSize: 9, color: 'text.disabled' }}
        >
          {groupLabel}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.25 }}>
        <Tooltip title={track.visible ? '트랙 숨기기' : '트랙 보이기'}>
          <IconButton size="small" onClick={toggleVisible} sx={{ width: 22, height: 22 }}>
            {track.visible ? (
              <VisibilityIcon sx={{ fontSize: 14 }} />
            ) : (
              <VisibilityOffIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={track.locked ? '트랙 잠금 해제' : '트랙 잠금'}>
          <IconButton size="small" onClick={toggleLocked} sx={{ width: 22, height: 22 }}>
            {track.locked ? (
              <LockIcon sx={{ fontSize: 14 }} />
            ) : (
              <LockOpenIcon sx={{ fontSize: 14 }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={groupVisible ? `${groupLabel} 그룹 숨기기` : `${groupLabel} 그룹 보이기`}>
          <IconButton size="small" onClick={toggleGroupVisible} sx={{ width: 22, height: 22 }}>
            {groupVisible ? (
              <VisibilityIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            ) : (
              <VisibilityOffIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            )}
          </IconButton>
        </Tooltip>
        <Tooltip title={groupLocked ? `${groupLabel} 그룹 잠금 해제` : `${groupLabel} 그룹 잠금`}>
          <IconButton size="small" onClick={toggleGroupLocked} sx={{ width: 22, height: 22 }}>
            {groupLocked ? (
              <LockIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            ) : (
              <LockOpenIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Box sx={{ gridColumn: '2 / span 2', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Slider
          size="small"
          min={0}
          max={100}
          value={Math.round(track.opacity * 100)}
          onChange={updateOpacity}
          onChangeCommitted={commitOpacity}
          sx={{
            flex: 1,
            py: 0,
            '& .MuiSlider-thumb': { width: 10, height: 10 },
            '& .MuiSlider-rail, & .MuiSlider-track': { height: 2 },
          }}
        />
        <Typography
          variant="caption"
          sx={{ width: 30, textAlign: 'right', fontSize: 10, color: 'text.secondary' }}
        >
          {Math.round(track.opacity * 100)}%
        </Typography>
      </Box>
    </Box>
  )
}

// ── TrackRow (droppable) ──────────────────────────────────────────────────────
interface TrackRowProps {
  track: Track
  index: number
  zoom: number
  contentWidth: number
}

function TrackRow({ track, index, zoom, contentWidth }: TrackRowProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: track.id,
    data: { type: 'track', trackId: track.id },
    disabled: track.locked,
  })

  const bgColor =
    track.type === 'video'
      ? 'rgba(33,150,243,0.04)'
      : track.type === 'overlay'
        ? 'rgba(156,39,176,0.06)'
        : 'rgba(76,175,80,0.04)'
  return (
    <Box
      sx={{
        height: TRACK_HEIGHT,
        display: 'flex',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      <LayerCell track={track} index={index} />

      {/* 드롭 가능한 클립 영역 */}
      <Box
        ref={setNodeRef}
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: contentWidth,
          bgcolor: isOver && !track.locked ? 'action.hover' : bgColor,
          transition: 'background-color 0.1s',
          opacity: track.locked ? 0.72 : 1,
        }}
      >
        {track.clips.map((clip) => (
          <ClipItem
            key={clip.id}
            clip={clip}
            trackType={track.type}
            zoom={zoom}
            locked={track.locked}
          />
        ))}
      </Box>
    </Box>
  )
}

// ── TimelinePanel ─────────────────────────────────────────────────────────────
/** 타임라인 패널 — 눈금자·트랙·클립 편집 영역 (Phase 2) */
export function TimelinePanel() {
  const tracks = useTimelineStore((s) => s.tracks)
  const zoom = useTimelineStore((s) => s.zoom)
  const duration = useTimelineStore((s) => s.duration)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const snapInterval = useTimelineStore((s) => s.snapInterval)
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime)
  const setZoom = useTimelineStore((s) => s.setZoom)

  const scrollRef = useRef<HTMLDivElement>(null)

  // 최소 60초 확보, 여유 10초 추가
  const totalSecs = Math.max(duration, 60) + 10
  const contentWidth = Math.max(Math.round(totalSecs * zoom), 800)

  const ticks = useMemo(() => computeTicks(totalSecs, zoom), [totalSecs, zoom])

  // Ctrl+Wheel → 줌, 일반 wheel → 기본 스크롤
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR
        setZoom(useTimelineStore.getState().zoom * factor)
      }
    },
    [setZoom]
  )

  // 눈금자 클릭 → 현재 시간 이동 (snap 적용)
  // getBoundingClientRect()가 스크롤 오프셋을 이미 반영하므로 별도 보정 불필요
  const handleRulerClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const { left } = e.currentTarget.getBoundingClientRect()
      const rawSec = (e.clientX - left) / zoom
      const snapped = Math.round(rawSec / snapInterval) * snapInterval
      setCurrentTime(Math.max(0, snapped))
    },
    [zoom, snapInterval, setCurrentTime]
  )

  const handleZoomIn = useCallback(
    () => setZoom(useTimelineStore.getState().zoom * ZOOM_FACTOR),
    [setZoom]
  )
  const handleZoomOut = useCallback(
    () => setZoom(useTimelineStore.getState().zoom / ZOOM_FACTOR),
    [setZoom]
  )

  // 플레이헤드 X: 전체 콘텐츠 기준 (LABEL_WIDTH 포함)
  const playheadX = LABEL_WIDTH + currentTime * zoom

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* ── 툴바 ── */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          gap: 0.5,
          flexShrink: 0,
          borderBottom: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mr: 0.5 }}>
          TIMELINE
        </Typography>
        <Tooltip title="축소 (Ctrl+스크롤 다운)">
          <span>
            <IconButton size="small" onClick={handleZoomOut}>
              <RemoveIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Typography
          variant="caption"
          sx={{ color: 'text.secondary', minWidth: 54, textAlign: 'center' }}
        >
          {zoom.toFixed(0)} px/s
        </Typography>
        <Tooltip title="확대 (Ctrl+스크롤 업)">
          <span>
            <IconButton size="small" onClick={handleZoomIn}>
              <AddIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
        <Typography variant="caption" sx={{ color: 'text.secondary', ml: 'auto' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Typography>
      </Box>

      {/* ── 스크롤 영역 ── */}
      <Box
        ref={scrollRef}
        onWheel={handleWheel}
        sx={{ flex: 1, overflow: 'auto', position: 'relative' }}
      >
        {/* 전체 콘텐츠 컨테이너 (수평 확장) */}
        <Box sx={{ position: 'relative', minWidth: LABEL_WIDTH + contentWidth }}>
          {/* ── 눈금자 행 (sticky top) ── */}
          <Box
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 3,
              display: 'flex',
              height: RULER_HEIGHT,
            }}
          >
            {/* 좌상단 코너 (sticky top + sticky left 겸용) */}
            <Box
              sx={{
                width: LABEL_WIDTH,
                flexShrink: 0,
                bgcolor: 'background.paper',
                borderRight: '1px solid',
                borderBottom: '1px solid',
                borderColor: 'divider',
                position: 'sticky',
                left: 0,
                zIndex: 4,
              }}
            />
            {/* 눈금자 콘텐츠 (클릭 → seek) */}
            <Box
              onClick={handleRulerClick}
              sx={{
                flex: 1,
                minWidth: contentWidth,
                position: 'relative',
                bgcolor: 'background.paper',
                borderBottom: '1px solid',
                borderColor: 'divider',
                cursor: 'pointer',
                overflow: 'hidden',
              }}
            >
              {/* 틱 마크 */}
              {ticks.map((tick) => (
                <Box
                  key={tick.time}
                  sx={{ position: 'absolute', left: tick.x, bottom: 0, pointerEvents: 'none' }}
                >
                  <Box
                    sx={{
                      width: 1,
                      height: tick.major ? 14 : 6,
                      bgcolor: tick.major ? 'text.secondary' : 'divider',
                    }}
                  />
                  {tick.major && (
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        bottom: 16,
                        left: 3,
                        fontSize: 9,
                        color: 'text.disabled',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        userSelect: 'none',
                      }}
                    >
                      {formatTime(tick.time)}
                    </Typography>
                  )}
                </Box>
              ))}
              {/* 눈금자 플레이헤드 */}
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: currentTime * zoom,
                  width: 2,
                  height: '100%',
                  bgcolor: 'error.main',
                  pointerEvents: 'none',
                  zIndex: 1,
                }}
              />
            </Box>
          </Box>

          {/* ── 트랙 영역 ── */}
          <Box sx={{ position: 'relative' }}>
            {/* 세로 플레이헤드 라인 (모든 트랙에 걸침) */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: playheadX,
                width: 2,
                height: tracks.length * TRACK_HEIGHT,
                bgcolor: 'error.main',
                pointerEvents: 'none',
                zIndex: 2,
                opacity: 0.75,
              }}
            />
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                zoom={zoom}
                contentWidth={contentWidth}
              />
            ))}
          </Box>
        </Box>
      </Box>
    </Box>
  )
}
