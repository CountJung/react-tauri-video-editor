#!/usr/bin/env node
/**
 * E2E 프리뷰 렌더 테스트용 미디어 fixture 생성.
 *
 * 저장소에 바이너리를 커밋하지 않기 위해 ffmpeg로 매번 만들어 쓴다.
 * 이미 존재하면 다시 만들지 않으므로 반복 실행이 싸다.
 *
 * 각 소스는 단색이다. 프리뷰 canvas에서 픽셀을 읽어 배치를 판정하기 때문에
 * testsrc 같은 패턴을 쓰면 "어느 색이 나와야 하는가"를 단정할 수 없다.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const FIXTURE_DIR = path.join(rootDir, 'e2e', 'fixtures')

/** 픽셀 판정에 쓰는 색. RGB 값이 서로 충분히 떨어져 있어야 한다. */
export const FIXTURE_COLORS = {
  /** 4:3 소스 — 순수 빨강 */
  portraitSafeRed: { r: 255, g: 0, b: 0 },
  /** 16:9 소스 — 순수 파랑 */
  wideBlue: { r: 0, g: 0, b: 255 },
}

const FIXTURES = [
  {
    name: 'solid_red_4x3.mp4',
    args: [
      '-f',
      'lavfi',
      '-i',
      'color=c=red:size=640x480:rate=30:duration=4',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
    ],
  },
  {
    name: 'solid_blue_16x9.mp4',
    args: [
      '-f',
      'lavfi',
      '-i',
      'color=c=blue:size=1280x720:rate=30:duration=4',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=880:duration=4',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-shortest',
    ],
  },
  {
    name: 'solid_red_4x3.png',
    args: ['-f', 'lavfi', '-i', 'color=c=red:size=640x480', '-frames:v', '1'],
  },
]

function hasFfmpeg() {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

export function ensureFixtures() {
  mkdirSync(FIXTURE_DIR, { recursive: true })

  const missing = FIXTURES.filter((fixture) => !existsSync(path.join(FIXTURE_DIR, fixture.name)))
  if (missing.length === 0) return FIXTURE_DIR

  if (!hasFfmpeg()) {
    throw new Error(
      'E2E fixture 생성에 ffmpeg가 필요합니다. macOS: `brew install ffmpeg`, ' +
        '또는 미리 만들어 둔 파일을 e2e/fixtures/에 두세요.'
    )
  }

  for (const fixture of missing) {
    const outputPath = path.join(FIXTURE_DIR, fixture.name)
    execFileSync('ffmpeg', ['-y', '-v', 'error', ...fixture.args, outputPath], {
      stdio: 'inherit',
    })
    console.log(`created ${path.relative(rootDir, outputPath)}`)
  }

  return FIXTURE_DIR
}

if (import.meta.url === `file://${process.argv[1]}`) {
  ensureFixtures()
  console.log(`fixtures ready in ${path.relative(rootDir, FIXTURE_DIR)}`)
}
