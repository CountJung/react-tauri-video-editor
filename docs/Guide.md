# Video Editor Guide

## Cross-Platform Debugging

This project targets both macOS and Windows. Keep the local debug entrypoint identical across platforms unless a task explicitly requires platform-specific behavior.

### Normal Development

```bash
pnpm dev
```

`pnpm dev` runs `tauri dev`. Tauri uses `src-tauri/tauri.conf.json` and starts Vite through `beforeDevCommand`.

### Environment Files

Copy `.env.example` to `.env` for local overrides. Frontend keys use the `VITE_` prefix and are
read by Vite. Rust build-time public settings are loaded by `src-tauri/build.rs` from either the OS
environment or root `.env`, but only keys on the explicit allowlist are injected into the binary.
Do not add secrets, signing keys, or personal paths to that allowlist.

### Window State

The desktop window remembers its last size and position through `tauri-plugin-window-state`.
The plugin is registered in `src-tauri/src/lib.rs` and enabled with the `window-state:default`
capability. On the next launch, Tauri restores the previous window bounds automatically.

### Preview Canvas Controls

The preview canvas has two independent size controls:

- Output canvas size: edit W/H in the Select tool properties panel. This updates the project canvas
  dimensions and keeps full-canvas media clips aligned to the new frame.
- Display zoom: use the preview overlay selector (`맞춤`, `25%`, `50%`, `75%`, `100%`, `150%`).
  This changes only how large the canvas appears in the editor, not the export resolution. Fixed
  zoom options are capped by the viewport size so the full canvas stays visible instead of becoming
  a scrollable cropped view.

When a video or image asset is first dropped onto a media track, its clip frame is initialized to the
full project canvas (`x=0`, `y=0`, `width=canvasWidth`, `height=canvasHeight`). The clip `fitMode`
then controls how the source media is drawn inside that frame.

Fit calculations use the probed asset dimensions first, then browser element dimensions as a
fallback. This prevents a browser-decoded `<video>` size mismatch from making the preview look
zoomed or side-cropped when the source is actually the same size as the project canvas.

For current verification, video media layers are drawn directly to the full preview canvas
(`0,0,canvasWidth,canvasHeight`) and ignore the clip fit mode. This keeps the entire decoded video
frame visible while investigating fit-mode behavior.

The media fit controls in the properties sidebar are disabled while this verification renderer is
active. Crop controls are also hidden by default; choose the Crop tool and press the crop edit button
before dragging or editing crop values.

Primary media on the `video` track is treated as the base layer. When a project is loaded or the
canvas output size changes, those clips are reframed to the full canvas. Overlay clips keep their own
placement.

### Build Chunk Splitting

`pnpm build:vite` should not leave JavaScript chunks above Vite's default 500 kB warning threshold.
When a warning appears, review the affected route or component with the project structure review
rules and prefer lazy-loading route bodies, dialogs, editor panels, media tools, and settings screens
before changing `build.chunkSizeWarningLimit`.

### Timeline Layer Panel

The timeline's left label column acts as the layer panel. Each track row exposes visibility, lock,
track opacity, and a drag handle for layer ordering. These controls call `useTimelineStore`
`updateTrackLayer` and `reorderTracks` actions through history-aware UI handlers.
Tracks are grouped by layer family (`Media`, `Graphic`, `Audio`) for bulk visibility and lock
toggles without changing the timeline data model.

During playback, the preview must not seek the hidden `<video>` element on every timeline tick.
Seeking is reserved for pause/scrub, clip changes, or large drift correction; otherwise Canvas draws
the live decoded video frame each animation frame.

### Browser Asset Import Fallback

In Tauri, external file drops are handled through `tauri://drag-drop` and real filesystem paths are
imported with the `asset_import` command. In the plain Vite browser at `http://127.0.0.1:1420`,
those Tauri events and paths do not exist. The asset panel therefore also accepts native browser
`DataTransfer.files` drops and the hidden file input used by the add button.

Browser-imported assets use temporary `blob:` URLs. The preview source helper must pass `blob:`,
`data:`, and HTTP(S) URLs through unchanged, while local filesystem paths continue to go through
Tauri `convertFileSrc`. This keeps web verification media visible without changing desktop import
behavior.

When verifying the local UI from Codex, open `http://127.0.0.1:1420` with the in-app browser first.
If that browser is unavailable, retry the same URL with Playwright MCP and report any remaining
verification limits such as missing screenshot or click tools.

### VS Code Tauri Debugging

Use one of the checked-in launch configurations:

- `Debug Tauri App (macOS)`
- `Debug Tauri App (Windows)`

Both configurations run the same preLaunchTask:

```text
start-vite-dev-server -> pnpm dev:vite:debug -> scripts/vscode-vite-dev.mjs
```

The helper is intentionally cross-platform:

- It probes `http://127.0.0.1:1420` before starting Vite.
- If a dev server is already reachable, it prints `VITE_READY existing dev server detected`.
- If no dev server is reachable, it starts Vite and prints `VITE_READY started dev server` after Vite is ready.
- It avoids spawning `pnpm.cmd` directly on Windows; direct `.cmd` spawning with `shell: false` can fail with `spawn EINVAL`.
- It cleans up the process tree with `taskkill /T /F` on Windows and `SIGTERM` on macOS/Linux.

### Address And Port Rules

Use `127.0.0.1`, not `localhost`, for local debugging:

- `src-tauri/tauri.conf.json` `build.devUrl`
- `.vscode/launch.json` frontend debug URL
- `scripts/vscode-vite-dev.mjs` default `VITE_DEV_URL`
- `vite.config.ts` default dev server host

The fixed local debug URL is:

```text
http://127.0.0.1:1420
```

The port is intentionally strict. If port `1420` is occupied by another reachable Vite server, the helper reuses it. If the port is occupied by a non-Vite process, stop that process before debugging.

### Remote Host Override

Only override the host for remote-device or VM testing. Set both values together so the helper probe and Vite bind host stay aligned:

```bash
VITE_DEV_URL=http://192.168.0.10:1420 TAURI_DEV_HOST=192.168.0.10 pnpm dev:vite:debug
```

On Windows PowerShell:

```powershell
$env:VITE_DEV_URL = "http://192.168.0.10:1420"
$env:TAURI_DEV_HOST = "192.168.0.10"
pnpm dev:vite:debug
```

Do not commit local host overrides unless the default debug topology changes for everyone.

### External Volume Cargo Target Check

On macOS external volumes, AppleDouble files such as `._default.toml` can appear inside
`src-tauri/target` and break Tauri permission generation. Keep Cargo output on an internal/local
disk when working from external media:

```bash
export CARGO_TARGET_DIR="$HOME/.cache/react-tauri-video-editor-target"
pnpm verify:cargo-target
```

The verifier also fails if `._*` metadata files already exist under `src-tauri/target`.
