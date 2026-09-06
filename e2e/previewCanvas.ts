import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { type Page, expect } from '@playwright/test'
import type { FitMode } from '../src/store/timelineStore'

export const FIXTURE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'fixtures')

export type Rgb = [number, number, number]

export const RED: Rgb = [255, 0, 0]
export const BLUE: Rgb = [0, 0, 255]
export const BLACK: Rgb = [0, 0, 0]

/** h.264 yuv420p 왕복으로 단색도 몇 단계 흔들린다. */
const COLOR_TOLERANCE = 40

export function expectColorNear(actual: Rgb, expected: Rgb, message: string): void {
  const distance = Math.max(
    Math.abs(actual[0] - expected[0]),
    Math.abs(actual[1] - expected[1]),
    Math.abs(actual[2] - expected[2])
  )
  expect(distance, `${message} — got rgb(${actual.join(',')})`).toBeLessThanOrEqual(COLOR_TOLERANCE)
}

/** 에디터를 열고 프리뷰 canvas와 테스트 브리지가 준비될 때까지 기다린다. */
export async function openEditor(page: Page): Promise<void> {
  await page.goto('/')
  await page.locator('canvas').first().waitFor({ state: 'visible' })
  await page.waitForFunction(() => Boolean(window.__editorTest))
}

/**
 * 실제 파일 input으로 에셋을 추가한다.
 *
 * 브라우저 모드의 `createWebAssetFromFile` 경로를 그대로 태우므로
 * asset.width/height도 실제 디코딩 결과에서 나온다.
 */
export async function importFixture(page: Page, fileName: string): Promise<string> {
  const before = await page.evaluate(() => window.__editorTest?.assets.getState().assets.length ?? 0)

  await page.setInputFiles('input[type="file"]', path.join(FIXTURE_DIR, fileName))

  await page.waitForFunction(
    (count) => (window.__editorTest?.assets.getState().assets.length ?? 0) > count,
    before
  )

  return page.evaluate((name) => {
    const assets = window.__editorTest?.assets.getState().assets ?? []
    const asset = assets.find((candidate) => candidate.name === name)
    if (!asset) throw new Error(`fixture asset not found: ${name}`)
    return asset.id
  }, fileName)
}

export interface PlaceClipOptions {
  assetId: string
  /** 'video' = 기본 트랙, 'overlay' = 오버레이 트랙 */
  trackType: 'video' | 'overlay' | 'audio'
  start?: number
  fitMode?: FitMode
  /** 지정하면 클립 사각형을 이 값으로 덮어쓴다 (오버레이 PIP 검증용) */
  rect?: { x: number; y: number; width: number; height: number }
  rotation?: number
}

/** 클립 배치는 dnd-kit 드래그로만 가능하므로 store로 세팅한다. 검증은 실제 렌더 결과로 한다. */
export async function placeClip(page: Page, options: PlaceClipOptions): Promise<string> {
  return page.evaluate((opts) => {
    const bridge = window.__editorTest
    if (!bridge) throw new Error('test bridge not installed')

    const timeline = bridge.timeline.getState()
    const asset = bridge.assets.getState().assets.find((a) => a.id === opts.assetId)
    if (!asset) throw new Error(`asset not found: ${opts.assetId}`)

    const track = timeline.tracks.find((candidate) => candidate.type === opts.trackType)
    if (!track) throw new Error(`track not found: ${opts.trackType}`)

    const existing = new Set(track.clips.map((clip) => clip.id))
    timeline.addClip(track.id, asset, opts.start ?? 0)

    const next = bridge.timeline.getState()
    const created = next.tracks
      .find((candidate) => candidate.id === track.id)
      ?.clips.find((clip) => !existing.has(clip.id))
    if (!created) throw new Error('clip was not created')

    if (opts.fitMode || opts.rect || opts.rotation !== undefined) {
      next.updateClipCanvas(created.id, {
        ...(opts.fitMode ? { fitMode: opts.fitMode } : {}),
        ...(opts.rect ?? {}),
        ...(opts.rotation !== undefined ? { rotation: opts.rotation } : {}),
      })
    }

    return created.id
  }, options)
}

export async function setCanvasSize(page: Page, width: number, height: number): Promise<void> {
  await page.evaluate(
    ({ w, h }) => window.__editorTest?.timeline.getState().setCanvasDimensions(w, h),
    { w: width, h: height }
  )
}

export async function seekTo(page: Page, time: number): Promise<void> {
  await page.evaluate((t) => window.__editorTest?.timeline.getState().setCurrentTime(t), time)
}

interface CanvasProbe {
  width: number
  height: number
  /** 중앙 가로줄에서 배경(검정)이 아닌 첫/마지막 x. 없으면 null */
  firstPaintedX: number | null
  lastPaintedX: number | null
  /** 중앙 세로줄에서 배경이 아닌 첫/마지막 y */
  firstPaintedY: number | null
  lastPaintedY: number | null
}

const PROBE_BACKGROUND_THRESHOLD = 24

/**
 * 프리뷰 canvas의 실제 픽셀을 읽는다.
 *
 * 스크린샷 비교 대신 픽셀을 직접 읽는 이유: 검증 대상이 "영상이 캔버스의
 * 어느 사각형에 그려졌는가"이고, 이건 경계 좌표로 정확히 판정할 수 있다.
 * 이미지 diff는 코덱 색 흔들림과 렌더 타이밍에 약하다.
 */
export async function probeCanvas(page: Page): Promise<CanvasProbe> {
  return page.evaluate((threshold) => {
    const canvas = document.querySelector('canvas')
    if (!canvas) throw new Error('preview canvas not found')
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('2d context unavailable')

    const midY = Math.floor(canvas.height / 2)
    const midX = Math.floor(canvas.width / 2)
    const isPainted = (data: Uint8ClampedArray, index: number) =>
      data[index] > threshold || data[index + 1] > threshold || data[index + 2] > threshold

    const row = ctx.getImageData(0, midY, canvas.width, 1).data
    let firstPaintedX: number | null = null
    let lastPaintedX: number | null = null
    for (let x = 0; x < canvas.width; x += 1) {
      if (isPainted(row, x * 4)) {
        if (firstPaintedX === null) firstPaintedX = x
        lastPaintedX = x
      }
    }

    const column = ctx.getImageData(midX, 0, 1, canvas.height).data
    let firstPaintedY: number | null = null
    let lastPaintedY: number | null = null
    for (let y = 0; y < canvas.height; y += 1) {
      if (isPainted(column, y * 4)) {
        if (firstPaintedY === null) firstPaintedY = y
        lastPaintedY = y
      }
    }

    return {
      width: canvas.width,
      height: canvas.height,
      firstPaintedX,
      lastPaintedX,
      firstPaintedY,
      lastPaintedY,
    }
  }, PROBE_BACKGROUND_THRESHOLD)
}

/** 프로젝트 좌표계(캔버스 backing store) 기준 한 점의 색 */
export async function readPixel(page: Page, x: number, y: number): Promise<Rgb> {
  return page.evaluate(
    ({ px, py }) => {
      const canvas = document.querySelector('canvas')
      if (!canvas) throw new Error('preview canvas not found')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('2d context unavailable')
      const data = ctx.getImageData(px, py, 1, 1).data
      return [data[0], data[1], data[2]] as [number, number, number]
    },
    { px: Math.round(x), py: Math.round(y) }
  )
}

/** 비디오 디코딩과 draw가 끝나 캔버스에 뭔가 그려질 때까지 기다린다. */
export async function waitForPaintedFrame(page: Page): Promise<void> {
  await expect
    .poll(async () => (await probeCanvas(page)).firstPaintedX, {
      message: 'preview canvas never painted a frame',
      timeout: 15_000,
    })
    .not.toBeNull()
}
