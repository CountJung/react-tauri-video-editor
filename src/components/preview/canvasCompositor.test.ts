import type { Asset, Clip, Track } from '@/store/timelineStore'
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

  it('hit-tests clips and returns topmost layer first', () => {
    const bottom = { track: track({ zIndex: 0 }), clip: clip({ id: 'bottom' }), asset }
    const top = { track: track({ zIndex: 1 }), clip: clip({ id: 'top', x: 150, y: 80 }), asset }

    expect(hitTestClip(top.clip, 170, 100)).toBe(true)
    expect(hitTestLayers([bottom, top], 170, 100)?.id).toBe('top')
  })
})
