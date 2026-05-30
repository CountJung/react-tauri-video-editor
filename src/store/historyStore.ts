import { create } from 'zustand'
import { type Track, useTimelineStore } from './timelineStore'

// ─────────────────────────────────────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────────────────────────────────────

export interface TimelineSnapshot {
  /** 사람이 읽을 수 있는 작업 이름 (툴팁용) */
  label: string
  tracks: Track[]
  currentTime: number
  selectedClipId: string | null
}

const MAX_HISTORY = 50

interface HistoryState {
  undoStack: TimelineSnapshot[]
  redoStack: TimelineSnapshot[]
}

interface HistoryActions {
  /** 현재 timelineStore 상태를 스냅샷으로 저장. 액션 실행 전에 호출한다. */
  pushSnapshot: (label: string) => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
}

// ─────────────────────────────────────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────────────────────────────────────

function calcDuration(tracks: Track[]): number {
  return tracks.reduce(
    (max, t) => t.clips.reduce((m, c) => Math.max(m, c.start + c.duration), max),
    0
  )
}

function snapshotTimeline(label: string): TimelineSnapshot {
  const { tracks, currentTime, selectedClipId } = useTimelineStore.getState()
  return {
    label,
    tracks: JSON.parse(JSON.stringify(tracks)) as Track[],
    currentTime,
    selectedClipId,
  }
}

function restoreSnapshot(snapshot: TimelineSnapshot): void {
  useTimelineStore.setState({
    tracks: snapshot.tracks,
    currentTime: snapshot.currentTime,
    selectedClipId: snapshot.selectedClipId,
    duration: calcDuration(snapshot.tracks),
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 스토어
// ─────────────────────────────────────────────────────────────────────────────

export const useHistoryStore = create<HistoryState & HistoryActions>((set, get) => ({
  undoStack: [],
  redoStack: [],

  pushSnapshot: (label) => {
    const snapshot = snapshotTimeline(label)
    const undoStack = [snapshot, ...get().undoStack].slice(0, MAX_HISTORY)
    set({ undoStack, redoStack: [] })
  },

  undo: () => {
    const { undoStack, redoStack } = get()
    if (undoStack.length === 0) return

    const [snapshot, ...rest] = undoStack
    // 현재 상태를 redo 스택에 저장
    const current = snapshotTimeline(snapshot.label)
    set({
      undoStack: rest,
      redoStack: [current, ...redoStack].slice(0, MAX_HISTORY),
    })
    restoreSnapshot(snapshot)
  },

  redo: () => {
    const { undoStack, redoStack } = get()
    if (redoStack.length === 0) return

    const [snapshot, ...rest] = redoStack
    // 현재 상태를 undo 스택에 저장
    const current = snapshotTimeline(snapshot.label)
    set({
      undoStack: [current, ...undoStack].slice(0, MAX_HISTORY),
      redoStack: rest,
    })
    restoreSnapshot(snapshot)
  },

  clearHistory: () => set({ undoStack: [], redoStack: [] }),
}))
