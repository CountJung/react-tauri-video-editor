import type { Asset, Clip, Track } from '@/store/timelineStore'
import { getDefaultMediaClipRect } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import { describe, expect, it } from 'vitest'
import { collectActiveLayers, getFitDrawRect, hitTestClip, hitTestLayers } from './canvasCompositor'

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

  it('hit-tests clips and returns topmost layer first', () => {
    const bottom = { track: track({ zIndex: 0 }), clip: clip({ id: 'bottom' }), asset }
    const top = { track: track({ zIndex: 1 }), clip: clip({ id: 'top', x: 150, y: 80 }), asset }

    expect(hitTestClip(top.clip, 170, 100)).toBe(true)
    expect(hitTestLayers([bottom, top], 170, 100)?.id).toBe('top')
  })
})
