import { STORAGE_KEYS } from '@/lib/storageKeys'
import { create } from 'zustand'

// ---- 데이터 모델 -------------------------------------------------------

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

export interface Clip {
  id: string
  assetId: string
  start: number // 타임라인 배치 위치 (초)
  duration: number // 표시 길이 (초)
  trimStart: number // 원본 자르기 시작 (초)
  trimEnd: number // 원본 자르기 끝 (초)
}

export interface Track {
  id: string
  type: 'video' | 'audio'
  clips: Clip[]
}

// ---- 유틸리티 ----------------------------------------------------------

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

// ---- 상태 & 액션 --------------------------------------------------------

interface TimelineState {
  tracks: Track[]
  currentTime: number
  duration: number
  zoom: number
  snapInterval: number
  isPlaying: boolean
}

interface TimelineActions {
  addTrack: (type: 'video' | 'audio') => void
  removeTrack: (trackId: string) => void
  addClip: (trackId: string, asset: Asset, startSec: number) => void
  moveClip: (clipId: string, newStart: number) => void
  trimClipStart: (clipId: string, newTrimStart: number) => void
  trimClipEnd: (clipId: string, newTrimEnd: number) => void
  removeClip: (clipId: string) => void
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
    { id: 'track-v1', type: 'video', clips: [] },
    { id: 'track-a1', type: 'audio', clips: [] },
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

  addTrack: (type) =>
    set((state) => ({
      tracks: [...state.tracks, { id: crypto.randomUUID(), type, clips: [] }],
    })),

  removeTrack: (trackId) =>
    set((state) => ({
      tracks: state.tracks.filter((t) => t.id !== trackId),
    })),

  addClip: (trackId, asset, startSec) =>
    set((state) => {
      const snap = snapToGrid(Math.max(0, startSec), state.snapInterval)
      const clip: Clip = {
        id: crypto.randomUUID(),
        assetId: asset.id,
        start: snap,
        duration: asset.duration || 5,
        trimStart: 0,
        trimEnd: asset.duration || 5,
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
      return { tracks: newTracks, duration: calcDuration(newTracks) }
    }),

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
