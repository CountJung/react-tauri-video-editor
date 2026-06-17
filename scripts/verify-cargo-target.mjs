#!/usr/bin/env node

import { existsSync, readdirSync, statSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const ROOT = resolve(__dirname, '..')
const SRC_TAURI = join(ROOT, 'src-tauri')
const WORKSPACE_TARGET = join(SRC_TAURI, 'target')

function isMacExternalVolume(path) {
  const normalized = path.replaceAll('\\', '/')
  return process.platform === 'darwin' && normalized.startsWith('/Volumes/')
}

function recommendedTargetDir() {
  if (process.platform === 'win32') {
    return join(process.env.USERPROFILE ?? homedir(), '.cache', 'react-tauri-video-editor-target')
  }
  return join(process.env.HOME ?? homedir(), '.cache', 'react-tauri-video-editor-target')
}

function findAppleDoubleFiles(dir, limit = 20) {
  const found = []
  const stack = [dir]

  while (stack.length > 0 && found.length < limit) {
    const current = stack.pop()
    if (!current || !existsSync(current)) continue

    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const fullPath = join(current, entry.name)
      if (entry.name.startsWith('._')) {
        found.push(fullPath)
        if (found.length >= limit) break
      }
      if (entry.isDirectory()) stack.push(fullPath)
    }
  }

  return found
}

function fail(message, details = []) {
  console.error(`[verify-cargo-target] ${message}`)
  for (const detail of details) console.error(`  - ${detail}`)
  process.exit(1)
}

function main() {
  const cargoTargetDir = process.env.CARGO_TARGET_DIR
  const appleDoubleFiles = findAppleDoubleFiles(WORKSPACE_TARGET)
  if (appleDoubleFiles.length > 0) {
    fail('AppleDouble metadata files were found inside src-tauri/target.', [
      ...appleDoubleFiles,
      'Move Cargo output to an internal/local disk with CARGO_TARGET_DIR.',
    ])
  }

  if (isMacExternalVolume(ROOT) && !cargoTargetDir) {
    fail('Repository is on a macOS external volume but CARGO_TARGET_DIR is not set.', [
      `Recommended: export CARGO_TARGET_DIR="${recommendedTargetDir()}"`,
    ])
  }

  if (cargoTargetDir) {
    const resolvedTarget = resolve(cargoTargetDir)
    if (resolvedTarget.startsWith(SRC_TAURI)) {
      fail('CARGO_TARGET_DIR points back into src-tauri.', [
        `Current: ${resolvedTarget}`,
        `Recommended: ${recommendedTargetDir()}`,
      ])
    }

    if (existsSync(resolvedTarget) && !statSync(resolvedTarget).isDirectory()) {
      fail('CARGO_TARGET_DIR exists but is not a directory.', [`Current: ${resolvedTarget}`])
    }
  }

  console.log('Cargo target configuration looks safe for this workspace.')
  console.log(`Recommended external-volume target dir: ${recommendedTargetDir()}`)
}

main()
