#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { constants, existsSync, readFileSync } from 'node:fs'
import { access, stat } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const BINARIES_DIR = join(ROOT, 'src-tauri', 'binaries')
const TAURI_CONF = join(ROOT, 'src-tauri', 'tauri.conf.json')

const TARGETS = [
  {
    triple: 'x86_64-pc-windows-msvc',
    ext: '.exe',
    os: 'windows',
    runnable: process.platform === 'win32',
  },
  {
    triple: 'x86_64-apple-darwin',
    ext: '',
    os: 'macos-x64',
    runnable: process.platform === 'darwin' && process.arch === 'x64',
  },
  {
    triple: 'aarch64-apple-darwin',
    ext: '',
    os: 'macos-arm64',
    runnable: process.platform === 'darwin' && process.arch === 'arm64',
  },
  {
    triple: 'x86_64-unknown-linux-gnu',
    ext: '',
    os: 'linux-x64',
    runnable: process.platform === 'linux' && process.arch === 'x64',
  },
  {
    triple: 'aarch64-unknown-linux-gnu',
    ext: '',
    os: 'linux-arm64',
    runnable: process.platform === 'linux' && process.arch === 'arm64',
  },
]

function getRustTriple() {
  const out = execFileSync('rustc', ['-vV'], { encoding: 'utf8' })
  const match = out.match(/host:\s+(\S+)/)
  if (!match) throw new Error('rustc -vV output did not include a host triple')
  return match[1]
}

function expectedBinaryNames(target) {
  return [`ffmpeg-${target.triple}${target.ext}`, `ffprobe-${target.triple}${target.ext}`]
}

function readTauriConfig() {
  return JSON.parse(readFileSync(TAURI_CONF, 'utf8'))
}

async function assertExecutable(path, target) {
  const info = await stat(path)
  if (!info.isFile()) throw new Error(`${path} is not a file`)

  if (target.ext === '.exe') return
  await access(path, constants.X_OK)
}

function assertTauriBundleConfig() {
  const config = readTauriConfig()
  const externalBin = config.bundle?.externalBin ?? []
  for (const entry of ['binaries/ffmpeg', 'binaries/ffprobe']) {
    if (!externalBin.includes(entry)) {
      throw new Error(`tauri.conf.json bundle.externalBin is missing "${entry}"`)
    }
  }
}

function runVersion(binaryPath, tool) {
  const out = execFileSync(binaryPath, ['-version'], { encoding: 'utf8' })
  if (!out.toLowerCase().startsWith(tool)) {
    throw new Error(`${basename(binaryPath)} did not print a ${tool} version banner`)
  }
}

async function verifyTarget(target, { run }) {
  for (const name of expectedBinaryNames(target)) {
    const path = join(BINARIES_DIR, name)
    if (!existsSync(path)) throw new Error(`Missing sidecar: ${path}`)
    await assertExecutable(path, target)
    if (run && target.runnable) runVersion(path, name.startsWith('ffmpeg') ? 'ffmpeg' : 'ffprobe')
    console.log(`ok ${target.os}: ${name}`)
  }
}

async function main() {
  assertTauriBundleConfig()

  const verifyAll = process.argv.includes('--all')
  const hostTriple = getRustTriple()
  const targets = verifyAll ? TARGETS : TARGETS.filter((target) => target.triple === hostTriple)

  if (targets.length === 0) {
    throw new Error(`Unsupported host triple for FFmpeg sidecar verification: ${hostTriple}`)
  }

  for (const target of targets) {
    await verifyTarget(target, { run: !verifyAll || target.runnable })
  }

  console.log(
    verifyAll
      ? 'FFmpeg sidecar file names, executable bits, and bundle config are valid for all configured targets.'
      : `FFmpeg sidecars are valid for host target ${hostTriple}.`
  )
}

main().catch((error) => {
  console.error(`[verify-ffmpeg-sidecars] ${error.message}`)
  process.exit(1)
})
