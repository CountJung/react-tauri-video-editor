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
  playbackRate: number  // 미디어 재생 속도 (0.25x~4x)
  fadeInDuration: number
  fadeOutDuration: number
  keyframes: Array<{
    time: number        // 클립 시작 기준 초
    x: number
    y: number
    width: number
    height: number
    opacity: number
  }>
}

export type Track = {
  id: string
  type: 'video' | 'audio' | 'overlay' | 'text' | 'shape'
  clips: Clip[]
  visible: boolean
  locked: boolean
  opacity: number
  zIndex: number
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

### Canvas 배치 규칙

- 미디어 클립을 처음 추가할 때 `x=0`, `y=0`, `width=canvasWidth`, `height=canvasHeight`로 캔버스 전체를 차지하게 한다.
- `video` 트랙의 미디어 클립은 베이스 영상으로 취급한다. 프로젝트 로드, 캔버스 크기 변경, 레거시 상태 보정 시 `x=0`, `y=0`, `width=canvasWidth`, `height=canvasHeight`로 강제 복구한다.
- 원본 비디오/이미지의 비율 맞춤은 `Clip.fitMode`가 담당한다. 기본값 `fit`은 클립 사각형 내부에 전체 소스를 보이게 letterbox/pillarbox로 그린다.
- `Clip.playbackRate`는 프리뷰 원본 시간 매핑과 timeline 표시 duration 계산에 함께 반영한다. 레거시 프로젝트 로드 시 기본값은 `1`로 보정한다.
- `Clip.fadeInDuration` / `fadeOutDuration`은 Canvas 합성 시 clip opacity에 곱해 프리뷰에 반영한다. 레거시 프로젝트 로드 시 기본값은 `0`으로 보정한다.
- `Clip.keyframes`는 클립 시작 기준 `time`에 위치, 크기, 불투명도를 저장한다. Canvas preview는 현재 타임라인 시간에 맞춰 선형 보간된 clip 사본을 렌더링한다.
- 프리뷰의 fit/fill 계산은 `ffprobe`/임포트 단계에서 얻은 에셋 `width`/`height`를 우선 사용하고, 없을 때만 브라우저 미디어 엘리먼트의 `videoWidth`/`naturalWidth`를 fallback으로 사용한다.
- 현재 검증용 동작에서는 비디오 미디어 레이어를 `0,0,canvasWidth,canvasHeight`에 직접 그려 `fitMode`를 우회하고 전체 프레임을 항상 보이게 한다.
- 이 검증용 동작이 활성화된 동안 우측 PropertiesPanel의 미디어 맞춤 모드는 비활성화한다.
- Crop 도구의 cropRect 수치 제어와 캔버스 crop 드래그는 `자르기 편집 시작` 버튼을 누른 동안에만 활성화한다.
- 원본 소스와 클립 사각형의 비율이 같으면 `fit`, `fill`, `stretch`가 육안상 동일하게 보일 수 있다. 이 경우 UI에서 소스/클립 비율이 같다는 안내를 표시해 동작하지 않는 것처럼 보이지 않게 한다.
- 초기 배치 단계에서 소스 해상도 비율로 클립 사각형 자체를 줄이지 않는다. 그렇게 하면 `fitMode`가 중복 적용되어 프리뷰에서 영상 일부만 보이거나 속성 패널 좌표가 예상과 달라질 수 있다.
- 사용자가 캔버스 출력 크기를 변경하면 full-canvas 미디어 클립은 새 캔버스 크기로 함께 보정한다.
- 프리뷰 표시 배율(`preview:canvas:zoom`)은 편집기에서 보이는 크기만 바꾸며, `canvasWidth`/`canvasHeight` 출력 해상도와 섞지 않는다.
- 프리뷰 표시 배율은 뷰포트보다 커져서 캔버스 일부만 스크롤로 보이는 상태를 만들지 않는다. `100%` 같은 고정 배율도 화면 공간이 부족하면 전체 캔버스가 보이는 크기로 자동 제한한다.
- 기존 프로젝트나 HMR 상태에서 full-canvas 미디어 클립의 `x`/`y`가 음수로 남을 수 있으므로, 로드·캔버스 크기 변경·수동 "캔버스 전체에 맞춤" 동작에서 `x=0`, `y=0`으로 복구한다.

### Canvas 비디오 재생 동기화 규칙

- 재생 중 `HTMLVideoElement.currentTime`을 매 프레임 강제로 갱신하지 않는다. 매 프레임 seek하면 디코더가 계속 seek 상태가 되어 타임라인만 움직이고 영상 프레임이 실시간으로 표시되지 않을 수 있다.
- 정지/스크럽 중에는 타임라인 위치에 맞게 즉시 seek한다.
- 재생 중에는 클립이 바뀌거나 드리프트가 충분히 커진 경우에만 seek로 보정한다.
- Canvas는 `requestAnimationFrame`에서 현재 video frame을 계속 `drawImage()`로 그리되, 시간 진행은 별도 타임라인 tick이 담당한다.

### Layer Panel 규칙

- 타임라인 왼쪽 레이블 영역은 레이어 패널로 동작한다.
- 트랙 가시성, 잠금, 불투명도, 순서 변경은 `useTimelineStore.updateTrackLayer`와 `reorderTracks` 액션을 통해 처리한다.
- 잠긴 트랙은 에셋 드롭, 클립 이동, 트림을 허용하지 않는다.
- 레이어 순서 변경은 dnd-kit 드래그 데이터 `track-layer`를 사용하고 히스토리에 기록한다.
- 트랙 그룹은 `Media`, `Graphic`, `Audio` 계열로 묶고, 그룹 가시성/잠금 토글도 히스토리에 기록한다.

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
  deleteGap: (clipId: string) => void
  splitClip: (clipId: string, atSec: number) => void
  ripplePushClips: (trackId: string, fromTime: number, delta: number) => void
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

- Trim, Canvas transform drag, Track opacity slider처럼 드래그 중 여러 번 상태가 바뀌는 편집은 시작 시점에 `withHistory(label, () => undefined)`로 변경 전 스냅샷과 dirty 상태를 먼저 기록한 뒤, move 이벤트에서 `useTimelineStore` 액션을 반복 호출한다.
- PropertiesPanel의 클립 위치/크기/회전/불투명도/fitMode 입력은 직접 `updateClipCanvas`를 호출하지 말고 `withHistory()` 또는 같은 정책의 helper를 통해 기록한다.
- Undo/redo/history jump는 `src/lib/historyActions.ts`의 `undoWithDirty`, `redoWithDirty`, `jumpToUndoIndexWithDirty`를 통해 호출한다. 스냅샷 복원에 성공한 경우에만 `projectStore.isDirty`를 켠다.
- 프로젝트 저장은 dirty만 해제하고 history stack은 유지한다. 저장 직후 undo/redo를 실행하면 다시 저장 필요 상태가 된다.

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
