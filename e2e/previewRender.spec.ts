import { expect, test } from '@playwright/test'
import {
  BLACK,
  BLUE,
  RED,
  expectColorNear,
  importFixture,
  openEditor,
  placeClip,
  probeCanvas,
  readPixel,
  seekTo,
  setCanvasSize,
  waitForPaintedFrame,
} from './previewCanvas'

/**
 * 프리뷰 비디오 렌더 회귀 테스트.
 *
 * 과거 회귀: 비디오 클립만 `ctx.drawImage(video, 0, 0, canvas.width, canvas.height)`로
 * 캔버스 전체에 강제 stretch되어 fitMode와 clip 사각형을 무시했다.
 * 프리뷰는 늘어나고 Export는 레터박스가 되어 결과가 갈렸고, 오버레이 비디오는
 * 캔버스 전체를 덮어 PIP가 불가능했다.
 */
test.describe('preview video rendering', () => {
  test.beforeEach(async ({ page }) => {
    await openEditor(page)
    await setCanvasSize(page, 1920, 1080)
  })

  /**
   * 과거 회귀: JSX가 MUI `Box component="canvas"`에 width/height를 넘겼는데
   * MUI가 이를 시스템 스타일 prop으로 흡수해 HTML 속성으로 전달하지 않았다.
   * backing store가 기본값 300x150에 머물러 프로젝트 좌표로 그린 레이어가
   * 전부 화면 밖으로 나갔고, 비디오만 canvas 좌표로 그려 가려졌다.
   */
  test('sizes the canvas backing store to the project resolution', async ({ page }) => {
    let probe = await probeCanvas(page)
    expect(probe.width).toBe(1920)
    expect(probe.height).toBe(1080)

    await setCanvasSize(page, 1080, 1920)
    await expect.poll(async () => (await probeCanvas(page)).width).toBe(1080)

    probe = await probeCanvas(page)
    expect(probe.height).toBe(1920)
  })

  test('letterboxes a 4:3 source in a 16:9 canvas in fit mode', async ({ page }) => {
    const assetId = await importFixture(page, 'solid_red_4x3.mp4')
    await placeClip(page, { assetId, trackType: 'video', fitMode: 'fit' })
    await seekTo(page, 1)
    await waitForPaintedFrame(page)

    // 640x480(4:3)을 1920x1080 클립 사각형에 fit:
    // scale = min(1920/640, 1080/480) = 2.25 → 1440x1080, x 오프셋 (1920-1440)/2 = 240
    const probe = await probeCanvas(page)
    expect(probe.firstPaintedX).toBeGreaterThanOrEqual(236)
    expect(probe.firstPaintedX).toBeLessThanOrEqual(244)
    expect(probe.lastPaintedX).toBeGreaterThanOrEqual(1676)
    expect(probe.lastPaintedX).toBeLessThanOrEqual(1684)

    // 세로는 가득 찬다
    expect(probe.firstPaintedY).toBeLessThanOrEqual(2)
    expect(probe.lastPaintedY).toBeGreaterThanOrEqual(1077)

    expectColorNear(await readPixel(page, 60, 540), BLACK, '좌측 필러박스는 검정이어야 한다')
    expectColorNear(await readPixel(page, 1860, 540), BLACK, '우측 필러박스는 검정이어야 한다')
    expectColorNear(await readPixel(page, 960, 540), RED, '중앙에는 소스가 보여야 한다')
  })

  test('fills the whole canvas in stretch mode', async ({ page }) => {
    const assetId = await importFixture(page, 'solid_red_4x3.mp4')
    await placeClip(page, { assetId, trackType: 'video', fitMode: 'stretch' })
    await seekTo(page, 1)
    await waitForPaintedFrame(page)

    const probe = await probeCanvas(page)
    expect(probe.firstPaintedX).toBeLessThanOrEqual(2)
    expect(probe.lastPaintedX).toBeGreaterThanOrEqual(1917)

    expectColorNear(await readPixel(page, 60, 540), RED, 'stretch는 좌측 끝까지 채워야 한다')
    expectColorNear(await readPixel(page, 1860, 540), RED, 'stretch는 우측 끝까지 채워야 한다')
  })

  test('crops instead of letterboxing in fill mode', async ({ page }) => {
    const assetId = await importFixture(page, 'solid_red_4x3.mp4')
    await placeClip(page, { assetId, trackType: 'video', fitMode: 'fill' })
    await seekTo(page, 1)
    await waitForPaintedFrame(page)

    const probe = await probeCanvas(page)
    expect(probe.firstPaintedX).toBeLessThanOrEqual(2)
    expect(probe.lastPaintedX).toBeGreaterThanOrEqual(1917)
    expect(probe.firstPaintedY).toBeLessThanOrEqual(2)
    expect(probe.lastPaintedY).toBeGreaterThanOrEqual(1077)
  })

  test('keeps an overlay video inside its own rect instead of covering the canvas', async ({
    page,
  }) => {
    const baseId = await importFixture(page, 'solid_blue_16x9.mp4')
    const overlayId = await importFixture(page, 'solid_red_4x3.mp4')

    await placeClip(page, { assetId: baseId, trackType: 'video', fitMode: 'stretch' })
    await placeClip(page, {
      assetId: overlayId,
      trackType: 'overlay',
      fitMode: 'stretch',
      rect: { x: 1200, y: 640, width: 480, height: 360 },
    })
    await seekTo(page, 1)
    await waitForPaintedFrame(page)

    // 오버레이 밖은 기본 트랙(파랑)이 그대로 보여야 한다
    expectColorNear(await readPixel(page, 200, 200), BLUE, '좌상단은 기본 트랙이어야 한다')
    expectColorNear(await readPixel(page, 960, 300), BLUE, '상단 중앙은 기본 트랙이어야 한다')

    // 오버레이 사각형 안에서만 오버레이가 보인다
    expectColorNear(await readPixel(page, 1440, 820), RED, '오버레이 사각형 안은 오버레이여야 한다')

    // 경계 바로 바깥은 기본 트랙
    expectColorNear(await readPixel(page, 1180, 820), BLUE, '오버레이 좌측 경계 밖은 기본 트랙')
    expectColorNear(await readPixel(page, 1440, 620), BLUE, '오버레이 상단 경계 밖은 기본 트랙')
  })

  test('honors an explicit clip rect for a base video clip', async ({ page }) => {
    const assetId = await importFixture(page, 'solid_red_4x3.mp4')
    await placeClip(page, {
      assetId,
      trackType: 'video',
      fitMode: 'stretch',
      rect: { x: 480, y: 270, width: 960, height: 540 },
    })
    await seekTo(page, 1)
    await waitForPaintedFrame(page)

    const probe = await probeCanvas(page)
    expect(probe.firstPaintedX).toBeGreaterThanOrEqual(476)
    expect(probe.firstPaintedX).toBeLessThanOrEqual(484)
    expect(probe.lastPaintedX).toBeGreaterThanOrEqual(1436)
    expect(probe.lastPaintedX).toBeLessThanOrEqual(1444)

    expectColorNear(await readPixel(page, 100, 540), BLACK, '클립 사각형 밖은 비어 있어야 한다')
  })

  test('renders images through the same fit path as video', async ({ page }) => {
    const assetId = await importFixture(page, 'solid_red_4x3.png')
    await placeClip(page, { assetId, trackType: 'video', fitMode: 'fit' })
    await seekTo(page, 0.5)
    await waitForPaintedFrame(page)

    const probe = await probeCanvas(page)
    expect(probe.firstPaintedX).toBeGreaterThanOrEqual(236)
    expect(probe.firstPaintedX).toBeLessThanOrEqual(244)
    expect(probe.lastPaintedX).toBeGreaterThanOrEqual(1676)
    expect(probe.lastPaintedX).toBeLessThanOrEqual(1684)
  })
})
