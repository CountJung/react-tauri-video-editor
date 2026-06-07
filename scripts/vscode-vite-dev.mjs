#!/usr/bin/env node
/**
 * VS Code preLaunchTask helper for Tauri debugging.
 *
 * The normal `pnpm dev:vite` command fails with "Port 1420 is already in use"
 * when another VS Code debug session or terminal already has Vite running.
 * This helper makes the task idempotent: if the dev server is reachable it
 * reports readiness and keeps the background task alive; otherwise it starts
 * Vite and forwards its output.
 */
import { spawn } from 'node:child_process'
import http from 'node:http'

const DEV_URL = process.env.VITE_DEV_URL ?? 'http://127.0.0.1:1420'
const isWindows = process.platform === 'win32'
let child = null
let keepAlive = null

function probe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(800, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function markReady(message) {
  console.log(`VITE_READY ${message}`)
}

function holdOpen() {
  keepAlive = setInterval(() => {}, 60_000)
}

function cleanup() {
  if (keepAlive) clearInterval(keepAlive)
  if (child && !child.killed) child.kill('SIGTERM')
}

process.on('SIGINT', () => {
  cleanup()
  process.exit(0)
})
process.on('SIGTERM', () => {
  cleanup()
  process.exit(0)
})

console.log(`VITE_START ${DEV_URL}`)

if (await probe(DEV_URL)) {
  markReady('existing dev server detected')
  holdOpen()
} else {
  const command = isWindows ? 'pnpm.cmd' : 'pnpm'
  child = spawn(command, ['exec', 'vite'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    env: process.env,
  })

  let ready = false
  const forward = (stream, writer) => {
    stream.on('data', (chunk) => {
      const text = chunk.toString()
      writer.write(text)
      if (!ready && /ready in|Local:/i.test(text)) {
        ready = true
        markReady('started dev server')
      }
    })
  }

  forward(child.stdout, process.stdout)
  forward(child.stderr, process.stderr)

  child.on('exit', (code, signal) => {
    if (!ready) {
      console.error(`VITE_EXIT_BEFORE_READY code=${code ?? 'null'} signal=${signal ?? 'null'}`)
      process.exit(code ?? 1)
      return
    }
    process.exit(code ?? 0)
  })
}
