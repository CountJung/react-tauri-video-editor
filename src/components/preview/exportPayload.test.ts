import type { ProjectMeta } from '@/store/projectStore'
import type { Asset, Clip, Track } from '@/store/timelineStore'
import { describe, expect, it } from 'vitest'
import { collectActiveLayers } from './canvasCompositor'
import { buildExportTimelinePayload } from './exportPayload'
import { collectActiveAudioSources, getAudioSourceGain } from './previewAudio'

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    assetId: 'asset-1',
    start: 0,
    duration: 5,
    trimStart: 0,
    trimEnd: 5,
    clipType: 'media',
    x: 100,
    y: 50,
    width: 400,
    height: 200,
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
    id: 'track-1',
    type: 'video',
    clips: [],
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
    ...overrides,
  }
}

const assets: Asset[] = [
  {
    id: 'video-1',
    type: 'video',
    path: '/fixture/video.mp4',
    name: 'video.mp4',
    duration: 5,
    width: 1920,
    height: 1080,
  },
  {
    id: 'overlay-1',
    type: 'image',
    path: '/fixture/title.png',
    name: 'title.png',
    duration: 5,
    width: 800,
    height: 450,
  },
  {
    id: 'audio-1',
    type: 'audio',
    path: '/fixture/music.wav',
    name: 'music.wav',
    duration: 6,
  },
]

const projectMeta: ProjectMeta = {
  id: 'fixture-project',
  name: 'Fixture',
  filePath: null,
  canvasWidth: 1920,
  canvasHeight: 1080,
  fps: 30,
  preset: '1080p_16:9',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function activePayloadClipIds(tracks: Track[], time: number): string[] {
  return tracks
    .filter((candidate) => candidate.visible && candidate.type !== 'audio')
    .sort((a, b) => a.zIndex - b.zIndex)
    .flatMap((candidate) =>
      candidate.clips
        .filter(
          (candidateClip) =>
            time >= candidateClip.start && time < candidateClip.start + candidateClip.duration
        )
        .map((candidateClip) => candidateClip.id)
    )
}

describe('preview/export payload consistency', () => {
  it('keeps a representative project fixture aligned with the preview layer model', () => {
    const timelineTime = 2
    const tracks: Track[] = [
      track({
        id: 'video-track',
        type: 'video',
        zIndex: 0,
        clips: [
          clip({
            id: 'base-video',
            assetId: 'video-1',
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
          }),
        ],
      }),
      track({
        id: 'overlay-track',
        type: 'overlay',
        zIndex: 1,
        opacity: 0.8,
        clips: [
          clip({
            id: 'image-overlay',
            assetId: 'overlay-1',
            start: 1,
            duration: 3,
            x: 320,
            y: 180,
            width: 640,
            height: 360,
            opacity: 0.75,
          }),
        ],
      }),
      track({
        id: 'text-track',
        type: 'text',
        zIndex: 2,
        clips: [
          clip({
            id: 'title-text',
            assetId: '',
            clipType: 'text',
            start: 1,
            duration: 4,
            x: 480,
            y: 700,
            width: 960,
            height: 120,
            textProps: {
              text: 'Preview = Export',
              fontFamily: 'sans-serif',
              fontSize: 72,
              color: '#ffffff',
              bold: true,
              italic: false,
              align: 'center',
              outline: { width: 4, color: '#000000' },
              shadow: { blur: 8, color: '#000000', offsetX: 4, offsetY: 6 },
            },
          }),
        ],
      }),
      track({
        id: 'shape-track',
        type: 'shape',
        zIndex: 3,
        clips: [
          clip({
            id: 'shape-callout',
            assetId: '',
            clipType: 'shape',
            start: 0.5,
            duration: 2,
            x: 1200,
            y: 160,
            width: 240,
            height: 180,
            shapeProps: {
              shapeType: 'rect',
              fill: '#3a7bd5',
              stroke: '#ffffff',
              strokeWidth: 6,
              cornerRadius: 16,
            },
          }),
        ],
      }),
      track({
        id: 'hidden-track',
        type: 'text',
        visible: false,
        zIndex: 4,
        clips: [clip({ id: 'hidden-text', assetId: '', clipType: 'text' })],
      }),
      track({
        id: 'audio-track',
        type: 'audio',
        zIndex: -1,
        clips: [clip({ id: 'music', assetId: 'audio-1', clipType: 'media' })],
      }),
    ]

    const previewLayers = collectActiveLayers(tracks, assets, timelineTime)
    const payload = buildExportTimelinePayload({
      projectMeta,
      tracks,
      assets,
      canvasWidth: 1920,
      canvasHeight: 1080,
      settings: { width: 960, height: 540, fps: 24 },
    })

    expect(payload.projectMeta).toMatchObject({ canvasWidth: 960, canvasHeight: 540, fps: 24 })
    expect(activePayloadClipIds(payload.tracks, timelineTime)).toEqual(
      previewLayers.map((layer) => layer.clip.id)
    )

    const payloadOverlay = payload.tracks
      .find((candidate) => candidate.id === 'overlay-track')
      ?.clips.find((candidate) => candidate.id === 'image-overlay')
    const payloadText = payload.tracks
      .find((candidate) => candidate.id === 'text-track')
      ?.clips.find((candidate) => candidate.id === 'title-text')
    const payloadShape = payload.tracks
      .find((candidate) => candidate.id === 'shape-track')
      ?.clips.find((candidate) => candidate.id === 'shape-callout')

    expect(payloadOverlay).toMatchObject({ x: 160, y: 90, width: 320, height: 180 })
    expect(payloadText).toMatchObject({ x: 240, y: 350, width: 480, height: 60 })
    expect(payloadText?.textProps).toMatchObject({
      fontSize: 36,
      outline: { width: 2 },
      shadow: { blur: 4, offsetX: 2, offsetY: 3 },
    })
    expect(payloadShape).toMatchObject({ x: 600, y: 80, width: 120, height: 90 })
    expect(payloadShape?.shapeProps).toMatchObject({ strokeWidth: 3, cornerRadius: 8 })
  })

  it('selects the same audio sources the export plan would build', () => {
    const timelineTime = 2
    const tracks: Track[] = [
      track({
        id: 'video-track',
        type: 'video',
        clips: [clip({ id: 'base-video', assetId: 'video-1' })],
      }),
      track({
        id: 'overlay-track',
        type: 'overlay',
        zIndex: 1,
        clips: [clip({ id: 'overlay-video', assetId: 'video-1' })],
      }),
      track({
        id: 'audio-track',
        type: 'audio',
        zIndex: -1,
        opacity: 0.8,
        clips: [clip({ id: 'music', assetId: 'audio-1', opacity: 0.5 })],
      }),
      track({
        id: 'muted-audio-track',
        type: 'audio',
        zIndex: -1,
        visible: false,
        clips: [clip({ id: 'muted-music', assetId: 'audio-1' })],
      }),
    ]

    const sources = collectActiveAudioSources(tracks, assets, timelineTime)

    // Export의 build_plan_from_payload과 같은 선택 결과여야 한다:
    // video 트랙 비디오의 embedded 오디오 + audio 트랙 클립. overlay/hidden은 제외.
    expect(sources.map((source) => [source.clip.id, source.kind])).toEqual([
      ['base-video', 'embedded'],
      ['music', 'audio'],
    ])

    // Export의 amix 게인 = clip.opacity * track.opacity, embedded는 감쇠 없음
    expect(sources.map((source) => getAudioSourceGain(source))).toEqual([1, 0.4])
  })
})
