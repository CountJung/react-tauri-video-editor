import { STORAGE_KEYS } from '@/lib/storageKeys'
import { create } from 'zustand'

// ─────────────────────────────────────────────────────────────────────────────
// 데이터 모델
// ─────────────────────────────────────────────────────────────────────────────

export type AssetType = 'video' | 'audio' | 'image'

export interface Asset {
  id: string
  type: AssetType
  path: string
  name: string
  duration: number
  width?: number
  height?: number
  thumbnailPath?: string
}

// Canvas 출력 해상도 기준 (1920×1080)
export const CANVAS_WIDTH = 1920
export const CANVAS_HEIGHT = 1080

// ── 텍스트 오브젝트 속성 ──────────────────────────────────────────────────────
export interface TextProps {
  text: string
  fontFamily: string
  fontSize: number // px (canvas 좌표계 기준)
  color: string // CSS color string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  shadow?: { blur: number; color: string; offsetX: number; offsetY: number }
  outline?: { width: number; color: string }
}

// ── 도형 오브젝트 속성 ────────────────────────────────────────────────────────
export type ShapeType = 'rect' | 'circle' | 'arrow'

export interface ShapeProps {
  shapeType: ShapeType
  fill: string
  stroke: string
  strokeWidth: number
  dash?: number[]
  cornerRadius?: number // rect 전용
}

// ── 클립 타입 ────────────────────────────────────────────────────────────────
export type ClipType = 'media' | 'text' | 'shape'

export interface Clip {
  id: string
  assetId: string // text/shape clip은 '' (빈 문자열)
  start: number // 타임라인 배치 위치 (초)
  duration: number // 표시 길이 (초)
  trimStart: number // 원본 자르기 시작 (초)
  trimEnd: number // 원본 자르기 끝 (초)
  // Canvas 변환 속성
  clipType: ClipType
  x: number // Canvas 좌표 (px)
  y: number
  width: number // 표시 크기 (px)
  height: number
  rotation: number // 도(°)
  opacity: number // 0~1 (클립 개별 불투명도)
  // 타입별 확장 속성
  textProps?: TextProps
  shapeProps?: ShapeProps
}

// ── 트랙 타입 ────────────────────────────────────────────────────────────────
/** 트랙 타입:
 * - video:   주 비디오/이미지 편집 트랙
 * - audio:   오디오 트랙
 * - overlay: 이미지/비디오 오버레이 트랙
 * - text:    텍스트 오브젝트 트랙
 * - shape:   도형 오브젝트 트랙
 */
export type TrackType = 'video' | 'audio' | 'overlay' | 'text' | 'shape'

export interface Track {
  id: string
  type: TrackType
  clips: Clip[]
  // 레이어 속성
  visible: boolean // 가시성 토글 (눈 아이콘)
  locked: boolean // 편집 잠금
  opacity: number // 트랙 전체 불투명도 0~1
  zIndex: number // 렌더 순서 (낮을수록 아래 레이어)
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸리티
// ─────────────────────────────────────────────────────────────────────────────

function snapToGrid(time: number, interval: number): number {
  return Math.round(time / interval) * interval
}

function resolveCollisions(clips: Clip[]): Clip[] {
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

function calcDuration(tracks: Track[]): number {
  return tracks.reduce(
    (max, t) => t.clips.reduce((m, c) => Math.max(m, c.start + c.duration), max),
    0
  )
}

/** 미디어 클립의 기본 Canvas 크기: 에셋 해상도 → 캔버스 전체 채우기 */
function defaultClipSize(asset: Asset): { x: number; y: number; width: number; height: number } {
  if (asset.type === 'audio') return { x: 0, y: 0, width: 0, height: 0 }
  const w = asset.width || CANVAS_WIDTH
  const h = asset.height || CANVAS_HEIGHT
  // 캔버스에 맞게 letterbox fit
  const scale = Math.min(CANVAS_WIDTH / w, CANVAS_HEIGHT / h)
  const width = Math.round(w * scale)
  const height = Math.round(h * scale)
  const x = Math.round((CANVAS_WIDTH - width) / 2)
  const y = Math.round((CANVAS_HEIGHT - height) / 2)
  return { x, y, width, height }
}

function makeTrack(type: TrackType, zIndex: number): Track {
  return {
    id: crypto.randomUUID(),
    type,
    clips: [],
    visible: true,
    locked: false,
    opacity: 1,
    zIndex,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 상태 & 액션
// ─────────────────────────────────────────────────────────────────────────────

interface TimelineState {
  tracks: Track[]
  currentTime: number
  duration: number
  zoom: number
  snapInterval: number
  isPlaying: boolean
  selectedClipId: string | null
}

export type ClipCanvasUpdate = Partial<
  Pick<Clip, 'x' | 'y' | 'width' | 'height' | 'rotation' | 'opacity' | 'textProps' | 'shapeProps'>
>

interface TimelineActions {
  // 트랙 관리
  addTrack: (type: TrackType) => void
  removeTrack: (trackId: string) => void
  updateTrackLayer: (
    trackId: string,
    props: Partial<Pick<Track, 'visible' | 'locked' | 'opacity'>>
  ) => void
  reorderTracks: (fromIndex: number, toIndex: number) => void

  // 미디어 클립
  addClip: (trackId: string, asset: Asset, startSec: number) => void
  moveClip: (clipId: string, newStart: number) => void
  trimClipStart: (clipId: string, newTrimStart: number) => void
  trimClipEnd: (clipId: string, newTrimEnd: number) => void
  removeClip: (clipId: string) => void
  splitClip: (clipId: string, atTime: number) => void

  // 텍스트 & 도형 클립
  addTextClip: (
    trackId: string,
    startSec: number,
    duration: number,
    props?: Partial<TextProps>
  ) => void
  addShapeClip: (
    trackId: string,
    startSec: number,
    duration: number,
    shapeType: ShapeType,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void

  // Canvas 변환
  updateClipCanvas: (clipId: string, update: ClipCanvasUpdate) => void
  selectClip: (clipId: string | null) => void

  // 재생
  setCurrentTime: (time: number) => void
  setZoom: (zoom: number) => void
  setSnapInterval: (interval: number) => void
  setPlaying: (playing: boolean) => void
}

// .env 기본값 읽기: localStorage 저장값 → VITE_* 환경변수 → 하드코딩 기본값 순
function readStoredNumber(key: string, envVal: string | undefined, fallback: number): number {
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) return JSON.parse(raw) as number
  } catch {
    // ignore
  }
  const parsed = Number(envVal)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const useTimelineStore = create<TimelineState & TimelineActions>((set, get) => ({
  tracks: [
    {
      id: 'track-v1',
      type: 'video',
      clips: [],
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 0,
    },
    {
      id: 'track-ol1',
      type: 'overlay',
      clips: [],
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 1,
    },
    {
      id: 'track-t1',
      type: 'text',
      clips: [],
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 2,
    },
    {
      id: 'track-s1',
      type: 'shape',
      clips: [],
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: 3,
    },
    {
      id: 'track-a1',
      type: 'audio',
      clips: [],
      visible: true,
      locked: false,
      opacity: 1,
      zIndex: -1,
    },
  ],
  currentTime: 0,
  duration: 0,
  zoom: readStoredNumber(STORAGE_KEYS.SETTINGS_DEFAULT_ZOOM, import.meta.env.VITE_DEFAULT_ZOOM, 50),
  snapInterval: readStoredNumber(
    STORAGE_KEYS.SETTINGS_SNAP_INTERVAL,
    import.meta.env.VITE_SNAP_INTERVAL,
    0.5
  ),
  isPlaying: false,
  selectedClipId: null,

  // ── 트랙 관리 ────────────────────────────────────────────────────────────

  addTrack: (type) =>
    set((state) => {
      const maxZ = state.tracks.reduce((m, t) => Math.max(m, t.zIndex), -1)
      return { tracks: [...state.tracks, makeTrack(type, maxZ + 1)] }
    }),

  removeTrack: (trackId) =>
    set((state) => ({ tracks: state.tracks.filter((t) => t.id !== trackId) })),

  updateTrackLayer: (trackId, props) =>
    set((state) => ({
      tracks: state.tracks.map((t) => (t.id === trackId ? { ...t, ...props } : t)),
    })),

  reorderTracks: (fromIndex, toIndex) =>
    set((state) => {
      const arr = [...state.tracks]
      const [removed] = arr.splice(fromIndex, 1)
      arr.splice(toIndex, 0, removed)
      // zIndex 재할당
      const reindexed = arr.map((t, i) => ({ ...t, zIndex: t.type === 'audio' ? -1 : i }))
      return { tracks: reindexed }
    }),

  // ── 미디어 클립 ──────────────────────────────────────────────────────────

  addClip: (trackId, asset, startSec) =>
    set((state) => {
      const snap = snapToGrid(Math.max(0, startSec), state.snapInterval)
      const dur = asset.duration || 5
      const size = defaultClipSize(asset)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        start: snap,
        duration: dur,
        trimStart: 0,
        trimEnd: dur,
        clipType: 'media',
        ...size,
        rotation: 0,
        opacity: 1,
      }
      const newTracks = state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: resolveCollisions([...t.clips, clip]) } : t
      )
      return { tracks: newTracks, duration: calcDuration(newTracks) }
    }),

  moveClip: (clipId, newStart) =>
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: resolveCollisions(
          t.clips.map((c) =>
            c.id === clipId
              ? { ...c, start: snapToGrid(Math.max(0, newStart), state.snapInterval) }
              : c
          )
        ),
      }))
      return { tracks: newTracks, duration: calcDuration(newTracks) }
    }),

  trimClipStart: (clipId, newTrimStart) =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId) return c
          const trimStart = Math.max(0, Math.min(newTrimStart, c.trimEnd - 0.1))
          const duration = c.trimEnd - trimStart
          return { ...c, trimStart, start: c.start + (trimStart - c.trimStart), duration }
        }),
      })),
    })),

  trimClipEnd: (clipId, newTrimEnd) =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => {
          if (c.id !== clipId) return c
          const trimEnd = Math.max(c.trimStart + 0.1, newTrimEnd)
          return { ...c, trimEnd, duration: trimEnd - c.trimStart }
        }),
      })),
    })),

  removeClip: (clipId) =>
    set((state) => {
      const newTracks = state.tracks.map((t) => ({
        ...t,
        clips: t.clips.filter((c) => c.id !== clipId),
      }))
      return { tracks: newTracks, duration: calcDuration(newTracks), selectedClipId: null }
    }),

  splitClip: (clipId, atTime) =>
    set((state) => {
      const newTracks = state.tracks.map((t) => {
        const clip = t.clips.find((c) => c.id === clipId)
        if (!clip || atTime <= clip.start || atTime >= clip.start + clip.duration) return t

        const leftDur = atTime - clip.start
        const rightDur = clip.duration - leftDur
        const leftClip: Clip = { ...clip, duration: leftDur, trimEnd: clip.trimStart + leftDur }
        const rightClip: Clip = {
          ...clip,
          id: crypto.randomUUID(),
          start: atTime,
          duration: rightDur,
          trimStart: clip.trimStart + leftDur,
        }
        return {
          ...t,
          clips: t.clips.flatMap((c) => (c.id === clipId ? [leftClip, rightClip] : [c])),
        }
      })
      return { tracks: newTracks }
    }),

  // ── 텍스트 & 도형 클립 ───────────────────────────────────────────────────

  addTextClip: (trackId, startSec, duration, props) =>
    set((state) => {
      const snap = snapToGrid(Math.max(0, startSec), state.snapInterval)
      const defaultText: TextProps = {
        text: '텍스트를 입력하세요',
        fontFamily: 'sans-serif',
        fontSize: 72,
        color: '#ffffff',
        bold: false,
        italic: false,
        align: 'center',
        ...props,
      }
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: '',
        start: snap,
        duration,
        trimStart: 0,
        trimEnd: duration,
        clipType: 'text',
        x: CANVAS_WIDTH / 4,
        y: CANVAS_HEIGHT - 200,
        width: CANVAS_WIDTH / 2,
        height: 120,
        rotation: 0,
        opacity: 1,
        textProps: defaultText,
      }
      const newTracks = state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: resolveCollisions([...t.clips, clip]) } : t
      )
      return { tracks: newTracks, duration: calcDuration(newTracks) }
    }),

  addShapeClip: (trackId, startSec, duration, shapeType, x, y, w, h) =>
    set((state) => {
      const snap = snapToGrid(Math.max(0, startSec), state.snapInterval)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: '',
        start: snap,
        duration,
        trimStart: 0,
        trimEnd: duration,
        clipType: 'shape',
        x,
        y,
        width: w,
        height: h,
        rotation: 0,
        opacity: 1,
        shapeProps: { shapeType, fill: '#3a7bd5', stroke: 'transparent', strokeWidth: 0 },
      }
      const newTracks = state.tracks.map((t) =>
        t.id === trackId ? { ...t, clips: resolveCollisions([...t.clips, clip]) } : t
      )
      return { tracks: newTracks, duration: calcDuration(newTracks) }
    }),

  // ── Canvas 변환 ──────────────────────────────────────────────────────────

  updateClipCanvas: (clipId, update) =>
    set((state) => ({
      tracks: state.tracks.map((t) => ({
        ...t,
        clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...update } : c)),
      })),
    })),

  selectClip: (clipId) => set({ selectedClipId: clipId }),

  // ── 재생 ─────────────────────────────────────────────────────────────────

  setCurrentTime: (time) => set({ currentTime: Math.max(0, time) }),
  setZoom: (zoom) => set({ zoom: Math.max(10, Math.min(500, zoom)) }),
  setSnapInterval: (interval) => set({ snapInterval: Math.max(0.05, interval) }),
  setPlaying: (playing) => {
    if (playing) {
      const { currentTime, duration } = get()
      if (currentTime >= duration) set({ currentTime: 0 })
    }
    set({ isPlaying: playing })
  },
}))
