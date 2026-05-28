---
name: timeline-editor
description: Timeline/Track/Clip 구조 설계, Zustand 상태 관리, dnd-kit DnD 패턴, Clip Trim/이동/snap, React Flow 캔버스 연동. Keywords: timeline, track, clip, dnd-kit, zustand, useTimelineStore, snap, trim, move, addClip, ReactFlow
---
# Timeline Editor Skill

## 핵심 원칙

- **상태 중심**: 모든 편집 동작은 `useTimelineStore` (Zustand) 액션을 통해 처리.
- **UI는 조작만**: 컴포넌트는 상태를 읽고 액션을 호출. 직접 상태 변이 금지.
- **FFmpeg 분리**: 편집 중 FFmpeg 금지. Export 버튼 클릭 시에만 호출.

---

## 데이터 모델 (`src/store/timelineStore.ts`)

```ts
export type AssetType = 'video' | 'audio' | 'image'

export type Asset = {
  id: string
  type: AssetType
  path: string
  name: string
  duration: number      // 초 (이미지는 0)
  width?: number
  height?: number
  thumbnailPath?: string
}

export type Clip = {
  id: string
  assetId: string
  start: number         // 타임라인 배치 위치 (초)
  duration: number      // 표시 길이 (초)
  trimStart: number     // 원본 자르기 시작 (초)
  trimEnd: number       // 원본 자르기 끝 (초)
}

export type Track = {
  id: string
  type: 'video' | 'audio'
  clips: Clip[]
}

export type TimelineState = {
  tracks: Track[]
  currentTime: number   // 플레이헤드 위치 (초)
  duration: number      // 전체 타임라인 길이 (초)
  zoom: number          // px/초 비율 (기본: 50)
  snapInterval: number  // snap 간격 (초, 기본: 0.5)
  isPlaying: boolean
}
```

---

## Zustand Store 액션 패턴

```ts
// src/store/timelineStore.ts
import { create } from 'zustand'

interface TimelineActions {
  addClip: (trackId: string, assetId: string, startSec: number) => void
  moveClip: (clipId: string, newStart: number) => void
  trimClipStart: (clipId: string, newTrimStart: number) => void
  trimClipEnd: (clipId: string, newTrimEnd: number) => void
  removeClip: (clipId: string) => void
  splitClip: (clipId: string, atSec: number) => void
  setCurrentTime: (time: number) => void
  setZoom: (zoom: number) => void
  setPlaying: (playing: boolean) => void
}

export const useTimelineStore = create<TimelineState & TimelineActions>((set, get) => ({
  tracks: [],
  currentTime: 0,
  duration: 0,
  zoom: 50,
  snapInterval: 0.5,
  isPlaying: false,

  addClip: (trackId, assetId, startSec) => set(state => {
    const asset = get().assets.find(a => a.id === assetId)
    if (!asset) return state
    const clip: Clip = {
      id: crypto.randomUUID(),
      assetId,
      start: snapToGrid(startSec, state.snapInterval),
      duration: asset.duration,
      trimStart: 0,
      trimEnd: asset.duration,
    }
    return {
      tracks: state.tracks.map(t =>
        t.id === trackId ? { ...t, clips: resolveCollisions([...t.clips, clip]) } : t
      )
    }
  }),

  moveClip: (clipId, newStart) => set(state => ({
    tracks: state.tracks.map(t => ({
      ...t,
      clips: resolveCollisions(
        t.clips.map(c => c.id === clipId
          ? { ...c, start: snapToGrid(Math.max(0, newStart), state.snapInterval) }
          : c
        )
      )
    }))
  })),
}))
```

### 유틸리티 함수

```ts
// src/store/timelineUtils.ts

/** snap 그리드에 정렬 */
export function snapToGrid(time: number, interval: number): number {
  return Math.round(time / interval) * interval
}

/** 같은 트랙 내 클립 겹침 해소 (앞 클립 우선) */
export function resolveCollisions(clips: Clip[]): Clip[] {
  const sorted = [...clips].sort((a, b) => a.start - b.start)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const cur = sorted[i]
    const prevEnd = prev.start + prev.duration
    if (cur.start < prevEnd) {
      sorted[i] = { ...cur, start: prevEnd }
    }
  }
  return sorted
}
```

---

## Drag & Drop — dnd-kit 패턴

### 에셋 패널 → 타임라인 드롭

```tsx
// src/components/assets/AssetItem.tsx
import { useDraggable } from '@dnd-kit/core'

export function AssetItem({ asset }: { asset: Asset }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: asset.id,
    data: { type: 'asset', assetId: asset.id, duration: asset.duration },
  })

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
         style={{ opacity: isDragging ? 0.5 : 1 }}>
      {asset.name}
    </div>
  )
}
```

```tsx
// src/components/timeline/TrackRow.tsx
import { useDroppable } from '@dnd-kit/core'

export function TrackRow({ track }: { track: Track }) {
  const { setNodeRef, isOver } = useDroppable({
    id: track.id,
    data: { type: 'track', trackId: track.id },
  })

  return (
    <div ref={setNodeRef} style={{ background: isOver ? '#e3f2fd' : undefined }}>
      {track.clips.map(clip => <ClipItem key={clip.id} clip={clip} />)}
    </div>
  )
}
```

```tsx
// src/components/timeline/TimelineCanvas.tsx
import { DndContext, DragEndEvent } from '@dnd-kit/core'
import { useTimelineStore } from '@/store/timelineStore'

export function TimelineCanvas() {
  const addClip = useTimelineStore(s => s.addClip)

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    if (active.data.current?.type === 'asset' && over.data.current?.type === 'track') {
      const dropX = event.delta.x  // px → 초 변환 필요
      const zoom = useTimelineStore.getState().zoom
      const startSec = dropX / zoom
      addClip(over.data.current.trackId, active.data.current.assetId, startSec)
    }
  }

  return (
    <DndContext onDragEnd={handleDragEnd}>
      {/* TrackRow들 */}
    </DndContext>
  )
}
```

### Clip 이동 (같은 트랙 내)

```tsx
// src/components/timeline/ClipItem.tsx
import { useDraggable } from '@dnd-kit/core'

export function ClipItem({ clip }: { clip: Clip }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: clip.id,
    data: { type: 'clip', clipId: clip.id, originalStart: clip.start },
  })

  const zoom = useTimelineStore(s => s.zoom)
  const width = clip.duration * zoom
  const left = clip.start * zoom
  const translateX = transform?.x ?? 0

  return (
    <div ref={setNodeRef} {...listeners} {...attributes}
         style={{
           position: 'absolute',
           left: left + translateX,
           width,
           cursor: 'grab',
         }}>
      {/* 클립 내용 */}
    </div>
  )
}
```

---

## Trim 인터랙션

Trim은 dnd-kit 대신 **pointerdown/pointermove/pointerup** 이벤트로 구현한다.  
(dnd-kit은 전체 요소 이동 위주이므로 좌우 핸들 Trim에 부적합)

```tsx
// src/components/timeline/TrimHandle.tsx
export function TrimHandle({ clipId, side }: { clipId: string; side: 'start' | 'end' }) {
  const trimClipStart = useTimelineStore(s => s.trimClipStart)
  const trimClipEnd   = useTimelineStore(s => s.trimClipEnd)
  const zoom          = useTimelineStore(s => s.zoom)

  function handlePointerDown(e: React.PointerEvent) {
    e.stopPropagation()
    const startX = e.clientX
    const clip   = useTimelineStore.getState().tracks
      .flatMap(t => t.clips).find(c => c.id === clipId)!

    function onMove(ev: PointerEvent) {
      const delta = (ev.clientX - startX) / zoom
      if (side === 'start') trimClipStart(clipId, clip.trimStart + delta)
      else                  trimClipEnd(clipId, clip.trimEnd + delta)
    }
    function onUp() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return <div style={{ width: 8, cursor: 'ew-resize' }} onPointerDown={handlePointerDown} />
}
```

---

## 줌 & 스크롤

```tsx
// Timeline 컨테이너에서 wheel 이벤트로 줌 조절
function onWheel(e: React.WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    setZoom(prev => Math.max(10, Math.min(200, prev - e.deltaY * 0.1)))
  }
}
```

- `zoom` = px/초. 기본값 50.
- 타임라인 총 너비 = `duration * zoom` (px).

---

## 플레이헤드 & 재생 동기화

```tsx
// src/components/preview/PreviewPlayer.tsx
const videoRef = useRef<HTMLVideoElement>(null)
const currentTime = useTimelineStore(s => s.currentTime)
const setCurrentTime = useTimelineStore(s => s.setCurrentTime)

// 플레이헤드 → 비디오 동기화
useEffect(() => {
  if (videoRef.current && Math.abs(videoRef.current.currentTime - currentTime) > 0.05) {
    videoRef.current.currentTime = currentTime
  }
}, [currentTime])

// 비디오 → 플레이헤드 동기화
function handleTimeUpdate() {
  if (videoRef.current) setCurrentTime(videoRef.current.currentTime)
}
```
