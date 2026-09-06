import type { Asset, Clip, Track } from '@/store/timelineStore'
import { getDefaultMediaClipRect } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import { describe, expect, it } from 'vitest'
import {
  collectActiveLayers,
  drawImageLike,
  getAssetUrl,
  getClipFadeOpacity,
  getClipLocalTime,
  getContainedCanvasDisplaySize,
  getFitDrawRect,
  getMediaSourceSize,
  hitTestClip,
  hitTestLayers,
  resolveClipKeyframes,
  withClipTransform,
} from './canvasCompositor'

function clip(overrides: Partial<Clip> = {}): Clip {
  return {
    id: 'clip-1',
    assetId: 'asset-1',
    start: 10,
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
    clips: [clip()],
    visible: true,
    locked: false,
    opacity: 1,
    zIndex: 0,
    ...overrides,
  }
}

const asset: Asset = {
  id: 'asset-1',
  type: 'video',
  path: '/tmp/a.mp4',
  name: 'a.mp4',
  duration: 5,
  width: 1920,
  height: 1080,
}

describe('canvas compositor helpers', () => {
  it('uses the full canvas as the default media clip rect', () => {
    expect(getDefaultMediaClipRect('video', 1920, 1080)).toEqual({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
    })
  })

  it('normalizes primary video track media clips to the current canvas frame', () => {
    useTimelineStore.getState().resetTimeline(1080, 1080)
    useTimelineStore.getState().loadTracks([
      track({
        clips: [
          clip({
            x: -493,
            y: -109,
            width: 1920,
            height: 1080,
            fitMode: 'center',
          }),
        ],
      }),
    ])

    const loadedClip = useTimelineStore.getState().tracks[0]?.clips[0]

    expect(loadedClip).toMatchObject({ x: 0, y: 0, width: 1080, height: 1080, fitMode: 'fit' })
  })

  it('keeps overlay media placement when normalizing primary video clips', () => {
    useTimelineStore.getState().resetTimeline(1920, 1080)
    useTimelineStore.getState().loadTracks([
      track({
        id: 'overlay',
        type: 'overlay',
        clips: [clip({ x: 120, y: 80, width: 640, height: 360 })],
      }),
    ])

    const loadedClip = useTimelineStore.getState().tracks[0]?.clips[0]

    expect(loadedClip).toMatchObject({ x: 120, y: 80, width: 640, height: 360 })
  })

  it('fits newly added video clips to the full canvas frame', () => {
    useTimelineStore.getState().resetTimeline(1920, 1080)
    useTimelineStore.getState().addClip('track-v1', asset, 0)

    const loadedClip = useTimelineStore.getState().tracks[0]?.clips[0]

    expect(loadedClip).toMatchObject({
      x: 0,
      y: 0,
      width: 1920,
      height: 1080,
      fitMode: 'fit',
    })
  })

  it('resizes full-canvas media clips when the canvas size changes', () => {
    useTimelineStore.getState().resetTimeline(1920, 1080)
    useTimelineStore.getState().addClip('track-v1', asset, 0)
    useTimelineStore.getState().setCanvasDimensions(1080, 1080)

    const loadedClip = useTimelineStore.getState().tracks[0]?.clips[0]

    expect(loadedClip).toMatchObject({ x: 0, y: 0, width: 1080, height: 1080 })
  })

  it('fits an existing media clip back to the canvas frame', () => {
    useTimelineStore.getState().resetTimeline(1920, 1080)
    useTimelineStore.getState().loadTracks([
      track({
        clips: [
          clip({
            x: -493,
            y: -109,
            width: 1920,
            height: 1080,
            fitMode: 'center',
          }),
        ],
      }),
    ])
    useTimelineStore.getState().fitClipToCanvas('clip-1')

    const loadedClip = useTimelineStore.getState().tracks[0]?.clips[0]

    expect(loadedClip).toMatchObject({ x: 0, y: 0, width: 1920, height: 1080, fitMode: 'fit' })
  })

  it('collects only visible active non-audio layers sorted by zIndex', () => {
    const lower = track({ id: 'lower', zIndex: 1, clips: [clip({ id: 'lower-clip' })] })
    const upper = track({ id: 'upper', zIndex: 2, clips: [clip({ id: 'upper-clip' })] })
    const hidden = track({
      id: 'hidden',
      visible: false,
      zIndex: 3,
      clips: [clip({ id: 'hidden-clip' })],
    })
    const audio = track({
      id: 'audio',
      type: 'audio',
      zIndex: 4,
      clips: [clip({ id: 'audio-clip' })],
    })

    const layers = collectActiveLayers([upper, audio, hidden, lower], [asset], 12)

    expect(layers.map((layer) => layer.clip.id)).toEqual(['lower-clip', 'upper-clip'])
  })

  it('calculates fit and fill draw rectangles', () => {
    expect(
      getFitDrawRect(1000, 500, clip({ width: 400, height: 400, fitMode: 'fit' }))
    ).toMatchObject({
      dx: 100,
      dy: 150,
      dw: 400,
      dh: 200,
    })

    expect(
      getFitDrawRect(1000, 500, clip({ width: 400, height: 400, fitMode: 'fill' }))
    ).toMatchObject({
      sx: 250,
      sy: 0,
      sw: 500,
      sh: 500,
      dx: 100,
      dy: 50,
      dw: 400,
      dh: 400,
    })
  })

  it('keeps the full source visible in fit mode without source cropping', () => {
    expect(
      getFitDrawRect(1920, 1080, clip({ x: 0, y: 0, width: 1080, height: 1080, fitMode: 'fit' }))
    ).toMatchObject({
      dx: 0,
      dy: 236.25,
      dw: 1080,
      dh: 607.5,
    })
  })

  it('keeps browser object URLs displayable without Tauri asset conversion', () => {
    expect(getAssetUrl({ ...asset, path: 'blob:http://127.0.0.1:1420/test-video' })).toBe(
      'blob:http://127.0.0.1:1420/test-video'
    )
  })

  it('prefers probed asset dimensions for video fit calculations', () => {
    expect(getMediaSourceSize(asset, { width: 1440, height: 1080 }, clip())).toEqual({
      width: 1920,
      height: 1080,
    })
  })

  it('maps timeline time through clip playback rate', () => {
    expect(getClipLocalTime(clip({ start: 10, trimStart: 2, playbackRate: 2 }), 13)).toBe(8)
  })

  it('calculates clip fade opacity from timeline time', () => {
    expect(getClipFadeOpacity(clip({ start: 10, fadeInDuration: 2 }), 11)).toBe(0.5)
    expect(getClipFadeOpacity(clip({ start: 10, fadeOutDuration: 2 }), 14)).toBe(0.5)
  })

  it('interpolates clip transform keyframes at the current timeline time', () => {
    expect(
      resolveClipKeyframes(
        clip({
          start: 10,
          x: 0,
          width: 100,
          opacity: 1,
          keyframes: [{ time: 2, x: 200, y: 50, width: 300, height: 200, opacity: 0.5 }],
        }),
        11
      )
    ).toMatchObject({ x: 100, width: 200, opacity: 0.75 })
  })

  it('caps fixed preview zoom so the full canvas remains visible', () => {
    expect(getContainedCanvasDisplaySize(1920, 1080, 960, 540, 1)).toEqual({
      width: 960,
      height: 540,
    })
  })

  it('uses the requested fixed preview zoom when it fits the viewport', () => {
    expect(getContainedCanvasDisplaySize(1920, 1080, 2200, 1400, 1)).toEqual({
      width: 1920,
      height: 1080,
    })
  })

  it('hit-tests clips and returns topmost layer first', () => {
    const bottom = { track: track({ zIndex: 0 }), clip: clip({ id: 'bottom' }), asset }
    const top = { track: track({ zIndex: 1 }), clip: clip({ id: 'top', x: 150, y: 80 }), asset }

    expect(hitTestClip(top.clip, 170, 100)).toBe(true)
    expect(hitTestLayers([bottom, top], 170, 100)?.id).toBe('top')
  })
})

/**
 * 프리뷰 비디오 렌더 경로가 fitMode/clip 변환을 타도록 되돌리기 전에 고정하는
 * characterization test. 여기서 잡는 계약이 곧 Export의 build_fit_filter와 맞물린다.
 */
type DrawCall =
  | { type: 'drawImage'; args: number[] }
  | { type: 'save' }
  | { type: 'restore' }
  | { type: 'translate'; x: number; y: number }
  | { type: 'rotate'; angle: number }
  | { type: 'rect'; args: number[] }
  | { type: 'clip' }
  | { type: 'beginPath' }

function fakeContext() {
  const calls: DrawCall[] = []
  const state = { globalAlpha: 1 }
  const ctx = {
    get globalAlpha() {
      return state.globalAlpha
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value
      alphaHistory.push(value)
    },
    drawImage: (_image: unknown, ...args: number[]) => calls.push({ type: 'drawImage', args }),
    save: () => calls.push({ type: 'save' }),
    restore: () => calls.push({ type: 'restore' }),
    translate: (x: number, y: number) => calls.push({ type: 'translate', x, y }),
    rotate: (angle: number) => calls.push({ type: 'rotate', angle }),
    rect: (...args: number[]) => calls.push({ type: 'rect', args }),
    clip: () => calls.push({ type: 'clip' }),
    beginPath: () => calls.push({ type: 'beginPath' }),
  }
  const alphaHistory: number[] = []
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, alphaHistory }
}

describe('canvas compositor draw geometry', () => {
  it('stretches to the clip rect without source cropping in stretch mode', () => {
    expect(
      getFitDrawRect(1000, 500, clip({ x: 20, y: 30, width: 400, height: 400, fitMode: 'stretch' }))
    ).toEqual({ dx: 20, dy: 30, dw: 400, dh: 400 })
  })

  it('keeps the original source size centered in the clip rect in center mode', () => {
    expect(
      getFitDrawRect(200, 100, clip({ x: 20, y: 30, width: 400, height: 400, fitMode: 'center' }))
    ).toEqual({ dx: 120, dy: 180, dw: 200, dh: 100 })
  })

  it('uses cropRect as the source rectangle in crop mode', () => {
    expect(
      getFitDrawRect(
        1920,
        1080,
        clip({
          x: 10,
          y: 20,
          width: 640,
          height: 360,
          fitMode: 'crop',
          cropRect: { x: 100, y: 50, width: 800, height: 450 },
        })
      )
    ).toEqual({ sx: 100, sy: 50, sw: 800, sh: 450, dx: 10, dy: 20, dw: 640, dh: 360 })
  })

  it('falls back to fit when crop mode has no cropRect', () => {
    expect(
      getFitDrawRect(1000, 500, clip({ x: 0, y: 0, width: 400, height: 400, fitMode: 'crop' }))
    ).toEqual({ dx: 0, dy: 100, dw: 400, dh: 200 })
  })

  it('offsets fit and fill results by the clip position', () => {
    const fit = getFitDrawRect(
      1000,
      500,
      clip({ x: 200, y: 100, width: 400, height: 400, fitMode: 'fit' })
    )
    const fill = getFitDrawRect(
      1000,
      500,
      clip({ x: 200, y: 100, width: 400, height: 400, fitMode: 'fill' })
    )

    expect(fit).toMatchObject({ dx: 200, dy: 200 })
    expect(fill).toMatchObject({ dx: 200, dy: 100 })
  })

  it('crops the source vertically when the source is taller than the clip', () => {
    expect(
      getFitDrawRect(500, 1000, clip({ x: 0, y: 0, width: 400, height: 200, fitMode: 'fill' }))
    ).toEqual({ sx: 0, sy: 375, sw: 500, sh: 250, dx: 0, dy: 0, dw: 400, dh: 200 })
  })

  it('uses the 5-argument drawImage when no source rectangle is needed', () => {
    const { ctx, calls } = fakeContext()

    drawImageLike(
      ctx,
      {} as CanvasImageSource,
      1000,
      500,
      clip({ x: 0, y: 0, width: 400, height: 400, fitMode: 'fit' })
    )

    expect(calls).toEqual([{ type: 'drawImage', args: [0, 100, 400, 200] }])
  })

  it('uses the 9-argument drawImage when the source is cropped', () => {
    const { ctx, calls } = fakeContext()

    drawImageLike(
      ctx,
      {} as CanvasImageSource,
      1000,
      500,
      clip({ x: 0, y: 0, width: 400, height: 400, fitMode: 'fill' })
    )

    expect(calls).toEqual([{ type: 'drawImage', args: [250, 0, 500, 500, 0, 0, 400, 400] }])
  })

  it('applies clip opacity, track opacity, rotation and clipping around the clip center', () => {
    const { ctx, calls, alphaHistory } = fakeContext()
    let drew = false

    withClipTransform(
      ctx,
      clip({ x: 100, y: 50, width: 400, height: 200, rotation: 90, opacity: 0.5 }),
      0.5,
      () => {
        drew = true
      }
    )

    expect(drew).toBe(true)
    expect(alphaHistory).toEqual([0.25])
    expect(calls).toEqual([
      { type: 'save' },
      { type: 'translate', x: 300, y: 150 },
      { type: 'rotate', angle: Math.PI / 2 },
      { type: 'translate', x: -300, y: -150 },
      { type: 'beginPath' },
      { type: 'rect', args: [100, 50, 400, 200] },
      { type: 'clip' },
      { type: 'restore' },
    ])
  })

  it('clamps the combined opacity into 0..1', () => {
    const { ctx: high, alphaHistory: highAlpha } = fakeContext()
    const { ctx: low, alphaHistory: lowAlpha } = fakeContext()

    withClipTransform(high, clip({ opacity: 4 }), 4, () => {})
    withClipTransform(low, clip({ opacity: -1 }), 1, () => {})

    expect(highAlpha).toEqual([1])
    expect(lowAlpha).toEqual([0])
  })

  it('prefers probed asset dimensions over decoded media dimensions', () => {
    expect(
      getMediaSourceSize({ width: 1920, height: 1080 }, { width: 640, height: 360 }, clip())
    ).toEqual({ width: 1920, height: 1080 })

    expect(
      getMediaSourceSize(
        { width: undefined, height: undefined },
        { width: 640, height: 360 },
        clip()
      )
    ).toEqual({ width: 640, height: 360 })

    expect(
      getMediaSourceSize(
        { width: undefined, height: undefined },
        {},
        clip({ width: 400, height: 200 })
      )
    ).toEqual({ width: 400, height: 200 })
  })
})
