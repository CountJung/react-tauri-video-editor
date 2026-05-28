#!/usr/bin/env node
/**
 * FFmpeg / ffprobe 사이드카 바이너리 다운로드 스크립트
 *
 * 사용법:  pnpm setup
 *
 * - ffbinaries.com API에서 플랫폼 맞는 빌드를 자동 선택
 * - 파일을 src-tauri/binaries/ffmpeg-{triple}[.exe] 형식으로 저장
 * - rustc -vV 로 호스트 triple 자동 감지
 */

import { execSync, execFileSync } from 'child_process'
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, unlinkSync, rmSync } from 'fs'
import { get } from 'https'
import { join, resolve } from 'path'
import { fileURLToPath } from 'url'
import { tmpdir } from 'os'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries')
const FFBINARIES_API = 'https://ffbinaries.com/api/v1/version/latest'

// ── Rust host triple ────────────────────────────────────────────────────────
function getRustTriple() {
  try {
    const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
    const m = out.match(/host:\s+(\S+)/)
    if (!m) throw new Error('host triple not found in rustc -vV output')
    return m[1]
  } catch (e) {
    throw new Error(`rustc를 찾을 수 없습니다: ${e.message}\nRust toolchain이 설치되어 있는지 확인하세요.`)
  }
}

// ── Rust triple → ffbinaries 플랫폼 키 ─────────────────────────────────────
function getFfbinariesPlatform(triple) {
  if (triple.includes('windows')) return 'windows-64'
  if (triple.includes('apple') && triple.includes('aarch64')) return 'osx-arm-64'
  if (triple.includes('apple')) return 'osx-64'
  if (triple.includes('linux')) return 'linux-64'
  throw new Error(`지원하지 않는 플랫폼: ${triple}`)
}

// ── HTTP(S) 다운로드 (리다이렉트 지원) ──────────────────────────────────────
function download(url, destPath) {
  return new Promise((ok, fail) => {
    const file = createWriteStream(destPath)
    const req = (targetUrl) =>
      get(targetUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close()
          // 임시 파일을 재사용하기 위해 다시 열어서 redirect
          const redir = createWriteStream(destPath)
          return get(res.headers.location, (r) => { r.pipe(redir); redir.on('finish', () => redir.close(ok)) })
            .on('error', fail)
        }
        if (res.statusCode !== 200) {
          return fail(new Error(`HTTP ${res.statusCode}: ${targetUrl}`))
        }
        res.pipe(file)
        file.on('finish', () => file.close(ok))
      }).on('error', (e) => { file.close(); fail(e) })
    req(url)
  })
}

// ── zip 해제 ─────────────────────────────────────────────────────────────────
function extractZip(zipPath, destDir) {
  if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true })
  if (process.platform === 'win32') {
    execSync(
      `powershell -NoProfile -NonInteractive -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'"`,
      { stdio: 'inherit' },
    )
  } else {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' })
  }
}

// ── 디렉터리에서 실행파일 탐색 ───────────────────────────────────────────────
function findExe(dir, name) {
  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      const found = findExe(full, name)
      if (found) return found
    } else {
      const base = entry.name.toLowerCase().replace(/\.exe$/, '')
      if (base === name.toLowerCase()) return full
    }
  }
  return null
}

// ── fetch wrapper (redirect 지원) ────────────────────────────────────────────
async function fetchJson(url) {
  // Node 18+ 내장 fetch 사용
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API 요청 실패: ${res.status} ${url}`)
  return res.json()
}

// ── 메인 ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== FFmpeg 사이드카 바이너리 다운로드 ===\n')

  const triple = getRustTriple()
  const platform = getFfbinariesPlatform(triple)
  const ext = process.platform === 'win32' ? '.exe' : ''

  console.log(`Rust host triple : ${triple}`)
  console.log(`ffbinaries 플랫폼: ${platform}`)
  console.log(`출력 디렉터리    : ${BINARIES_DIR}\n`)

  if (!existsSync(BINARIES_DIR)) {
    mkdirSync(BINARIES_DIR, { recursive: true })
  }

  const targets = [
    { tool: 'ffmpeg', dest: join(BINARIES_DIR, `ffmpeg-${triple}${ext}`) },
    { tool: 'ffprobe', dest: join(BINARIES_DIR, `ffprobe-${triple}${ext}`) },
  ]

  const allExist = targets.every(({ dest }) => existsSync(dest))
  if (allExist) {
    console.log('✓ 바이너리가 이미 존재합니다. 다운로드를 건너뜁니다.')
    console.log('  강제 재다운로드: 기존 파일 삭제 후 pnpm setup 재실행')
    return
  }

  console.log('ffbinaries API 조회 중...')
  const data = await fetchJson(FFBINARIES_API)
  const bins = data.bin?.[platform]
  if (!bins) throw new Error(`플랫폼 '${platform}'의 다운로드 URL을 찾을 수 없습니다.`)
  console.log(`ffbinaries 버전  : ${data.version}\n`)

  const tmp = tmpdir()

  for (const { tool, dest } of targets) {
    if (existsSync(dest)) {
      console.log(`✓ ${tool} 이미 존재 — 건너뜀`)
      continue
    }

    const url = bins[tool]
    if (!url) throw new Error(`${tool}의 다운로드 URL 없음 (플랫폼: ${platform})`)

    const zipPath = join(tmp, `${tool}-ffbinaries.zip`)
    const extractDir = join(tmp, `${tool}-extract-${Date.now()}`)

    // 이전 잔여 파일 정리
    if (existsSync(zipPath)) unlinkSync(zipPath)
    if (existsSync(extractDir)) rmSync(extractDir, { recursive: true, force: true })

    console.log(`⬇  ${tool} 다운로드 중...`)
    console.log(`   URL: ${url}`)
    await download(url, zipPath)
    console.log(`   압축 해제 중...`)
    extractZip(zipPath, extractDir)

    const exePath = findExe(extractDir, tool)
    if (!exePath) throw new Error(`압축 파일에서 ${tool} 실행파일을 찾을 수 없습니다.`)

    renameSync(exePath, dest)

    if (process.platform !== 'win32') {
      execSync(`chmod +x "${dest}"`)
    }

    // 임시 파일 정리
    unlinkSync(zipPath)
    rmSync(extractDir, { recursive: true, force: true })

    console.log(`✓ ${tool} → ${dest}\n`)
  }

  console.log('=== FFmpeg 바이너리 설치 완료 ===')
  console.log('이제 "pnpm dev" 또는 "pnpm build"로 앱을 실행할 수 있습니다.')
}

main().catch((e) => {
  console.error('\n[오류]', e.message)
  process.exit(1)
})
