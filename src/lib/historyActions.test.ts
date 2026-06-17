import { useHistoryStore } from '@/store/historyStore'
import type { ProjectMeta } from '@/store/projectStore'
import { useProjectStore } from '@/store/projectStore'
import type { Clip, Track } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import { beforeEach, describe, expect, it } from 'vitest'
import { jumpToUndoIndexWithDirty, redoWithDirty, undoWithDirty } from './historyActions'

const projectMeta: ProjectMeta = {
  id: 'history-test',
  name: 'History Test',
  filePath: null,
  canvasWidth: 1920,
  canvasHeight: 1080,
  fps: 30,
  preset: '1080p_16:9',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    assetId: 'asset-1',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 5,
    clipType: 'media',
    x: 0,
    y: 0,
    width: 1920,
    height: 1080,
    rotation: 0,
    opacity: 1,
    playbackRate: 1,
    fadeInDuration: 0,
    fadeOutDuration: 0,
    keyframes: [],
    fitMode: 'fit',
    ...overrides,
  }
}

function track(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-v1',
    type: 'video',
    clips: [clip()],
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
    ...overrides,
  }
}

function selectedClipX(): number {
  return useTimelineStore.getState().tracks[0]?.clips[0]?.x ?? -1
}

describe('history dirty actions', () => {
  beforeEach(() => {
    useTimelineStore.getState().resetTimeline(1920, 1080)
    useTimelineStore.getState().loadTracks([track()])
    useHistoryStore.getState().clearHistory()
    useProjectStore.setState({ currentProject: projectMeta, isDirty: false })
  })

  it('marks the project dirty only when undo and redo restore a snapshot', () => {
    useHistoryStore.getState().pushSnapshot('Move clip')
    useTimelineStore.getState().updateClipCanvas('clip-1', { x: 120 })
    useProjectStore.getState().clearDirty()

    expect(undoWithDirty()).toBe(true)
    expect(selectedClipX()).toBe(0)
    expect(useProjectStore.getState().isDirty).toBe(true)

    useProjectStore.getState().clearDirty()

    expect(redoWithDirty()).toBe(true)
    expect(selectedClipX()).toBe(120)
    expect(useProjectStore.getState().isDirty).toBe(true)

    useHistoryStore.getState().clearHistory()
    useProjectStore.getState().clearDirty()

    expect(undoWithDirty()).toBe(false)
    expect(redoWithDirty()).toBe(false)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })

  it('marks the project dirty when jumping to an earlier undo snapshot', () => {
    useHistoryStore.getState().pushSnapshot('First move')
    useTimelineStore.getState().updateClipCanvas('clip-1', { x: 80 })
    useHistoryStore.getState().pushSnapshot('Second move')
    useTimelineStore.getState().updateClipCanvas('clip-1', { x: 160 })
    useProjectStore.getState().clearDirty()

    expect(jumpToUndoIndexWithDirty(1)).toBe(true)
    expect(selectedClipX()).toBe(0)
    expect(useProjectStore.getState().isDirty).toBe(true)

    useProjectStore.getState().clearDirty()

    expect(jumpToUndoIndexWithDirty(10)).toBe(false)
    expect(useProjectStore.getState().isDirty).toBe(false)
  })
})
