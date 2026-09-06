import type { Asset, Clip, Track } from '@/store/timelineStore'
import { describe, expect, it } from 'vitest'
import { clampClipMediaTime } from './canvasCompositor'
import {
  collectActiveAudioSources,
  getAudioElementKey,
  getAudioElementVolume,
  getAudioSourceGain,
  makeAudioSyncKey,
} from './previewAudio'

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    assetId: 'asset-video',
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
    id: 'track-video',
    type: 'video',
    clips: [clip()],
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
    ...overrides,
  }
}

const videoAsset: Asset = {
  id: 'asset-video',
  type: 'video',
  path: '/tmp/a.mp4',
  name: 'a.mp4',
  duration: 10,
  width: 1920,
  height: 1080,
}

const audioAsset: Asset = {
  id: 'asset-audio',
  type: 'audio',
  path: '/tmp/bgm.mp3',
  name: 'bgm.mp3',
  duration: 30,
}

const imageAsset: Asset = {
  id: 'asset-image',
  type: 'image',
  path: '/tmp/a.png',
  name: 'a.png',
  duration: 5,
  width: 800,
  height: 600,
}

const assets = [videoAsset, audioAsset, imageAsset]

describe('preview audio source selection', () => {
  it('collects video track embedded audio and audio track clips', () => {
    const tracks = [
      track(),
      track({
        id: 'track-audio',
        type: 'audio',
        clips: [clip({ id: 'clip-audio', assetId: 'asset-audio' })],
      }),
    ]

    const sources = collectActiveAudioSources(tracks, assets, 2)

    expect(sources.map((source) => [source.clip.id, source.kind])).toEqual([
      ['clip-1', 'embedded'],
      ['clip-audio', 'audio'],
    ])
  })

  it('excludes overlay track audio to match the export filter graph', () => {
    const tracks = [
      track({
        id: 'track-overlay',
        type: 'overlay',
        clips: [clip({ id: 'clip-overlay' })],
      }),
    ]

    expect(collectActiveAudioSources(tracks, assets, 2)).toEqual([])
  })

  it('excludes hidden tracks like the export plan does', () => {
    const tracks = [
      track({ visible: false }),
      track({
        id: 'track-audio',
        type: 'audio',
        visible: false,
        clips: [clip({ id: 'clip-audio', assetId: 'asset-audio' })],
      }),
    ]

    expect(collectActiveAudioSources(tracks, assets, 2)).toEqual([])
  })

  it('excludes clips that are not active at the current time', () => {
    const tracks = [track({ clips: [clip({ start: 10, duration: 5 })] })]

    expect(collectActiveAudioSources(tracks, assets, 2)).toEqual([])
    expect(collectActiveAudioSources(tracks, assets, 10)).toHaveLength(1)
    expect(collectActiveAudioSources(tracks, assets, 15)).toEqual([])
  })

  it('ignores non-media clips and assets without a matching track type', () => {
    const tracks = [
      track({
        clips: [
          clip({ id: 'clip-image', assetId: 'asset-image' }),
          clip({ id: 'clip-text', clipType: 'text', assetId: '' }),
        ],
      }),
      track({
        id: 'track-audio',
        type: 'audio',
        clips: [clip({ id: 'clip-audio-video', assetId: 'asset-video' })],
      }),
    ]

    expect(collectActiveAudioSources(tracks, assets, 2)).toEqual([])
  })

  it('ignores clips whose asset is missing', () => {
    const tracks = [track({ clips: [clip({ assetId: 'asset-gone' })] })]

    expect(collectActiveAudioSources(tracks, assets, 2)).toEqual([])
  })
})

describe('preview audio gain', () => {
  it('multiplies clip and track opacity for audio track clips', () => {
    const gain = getAudioSourceGain({
      kind: 'audio',
      clip: { opacity: 0.5 },
      track: { opacity: 0.5 },
    })

    expect(gain).toBeCloseTo(0.25)
  })

  it('clamps audio track gain to the export range', () => {
    expect(getAudioSourceGain({ kind: 'audio', clip: { opacity: 8 }, track: { opacity: 2 } })).toBe(
      4
    )
    expect(
      getAudioSourceGain({ kind: 'audio', clip: { opacity: -1 }, track: { opacity: 1 } })
    ).toBe(0)
  })

  it('leaves embedded video audio unattenuated like the concat segments', () => {
    expect(
      getAudioSourceGain({ kind: 'embedded', clip: { opacity: 0.2 }, track: { opacity: 0.3 } })
    ).toBe(1)
  })

  it('applies master volume and caps element volume at 1', () => {
    expect(getAudioElementVolume(1, 0.5, false)).toBeCloseTo(0.5)
    expect(getAudioElementVolume(4, 1, false)).toBe(1)
    expect(getAudioElementVolume(0.5, 1.5, false)).toBeCloseTo(0.5)
  })

  it('returns silence when muted', () => {
    expect(getAudioElementVolume(1, 1, true)).toBe(0)
  })
})

describe('preview audio element identity', () => {
  it('keys elements by clip so one asset can play twice with different trims', () => {
    const first = { clip: clip({ id: 'clip-a', trimStart: 0, trimEnd: 2 }) }
    const second = { clip: clip({ id: 'clip-b', trimStart: 5, trimEnd: 7 }) }

    expect(getAudioElementKey(first)).toBe('clip-a')
    expect(getAudioElementKey(second)).toBe('clip-b')
    expect(getAudioElementKey(first)).not.toBe(getAudioElementKey(second))
  })

  it('changes the sync key when the clip timing changes', () => {
    const base = clip()

    expect(makeAudioSyncKey(base)).toBe(makeAudioSyncKey(clip()))
    expect(makeAudioSyncKey(base)).not.toBe(makeAudioSyncKey(clip({ trimStart: 1 })))
    expect(makeAudioSyncKey(base)).not.toBe(makeAudioSyncKey(clip({ start: 3 })))
    expect(makeAudioSyncKey(base)).not.toBe(makeAudioSyncKey(clip({ playbackRate: 2 })))
  })

  it('clamps media time into the clip trim range', () => {
    const target = clip({ start: 10, duration: 4, trimStart: 2, trimEnd: 6 })

    expect(clampClipMediaTime(target, 10)).toBe(2)
    expect(clampClipMediaTime(target, 12)).toBe(4)
    expect(clampClipMediaTime(target, 99)).toBe(6)
    expect(clampClipMediaTime(target, 0)).toBe(2)
  })

  it('scales media time by playback rate', () => {
    const target = clip({ start: 0, duration: 10, trimStart: 0, trimEnd: 10, playbackRate: 2 })

    expect(clampClipMediaTime(target, 3)).toBe(6)
  })
})
