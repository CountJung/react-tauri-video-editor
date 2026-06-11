# Video Editor Guide

## Cross-Platform Debugging

This project targets both macOS and Windows. Keep the local debug entrypoint identical across platforms unless a task explicitly requires platform-specific behavior.

### Normal Development

```bash
pnpm dev
```

`pnpm dev` runs `tauri dev`. Tauri uses `src-tauri/tauri.conf.json` and starts Vite through `beforeDevCommand`.

### Window State

The desktop window remembers its last size and position through `tauri-plugin-window-state`.
The plugin is registered in `src-tauri/src/lib.rs` and enabled with the `window-state:default`
capability. On the next launch, Tauri restores the previous window bounds automatically.

### Preview Canvas Controls

The preview canvas has two independent size controls:

- Output canvas size: edit W/H in the Select tool properties panel. This updates the project canvas
  dimensions and keeps full-canvas media clips aligned to the new frame.
- Display zoom: use the preview overlay selector (`맞춤`, `25%`, `50%`, `75%`, `100%`, `150%`).
  This changes only how large the canvas appears in the editor, not the export resolution.

When a video or image asset is first dropped onto a media track, its clip frame is initialized to the
full project canvas (`x=0`, `y=0`, `width=canvasWidth`, `height=canvasHeight`). The clip `fitMode`
then controls how the source media is drawn inside that frame.

Primary media on the `video` track is treated as the base layer. When a project is loaded or the
canvas output size changes, those clips are reframed to the full canvas. Overlay clips keep their own
placement.

During playback, the preview must not seek the hidden `<video>` element on every timeline tick.
Seeking is reserved for pause/scrub, clip changes, or large drift correction; otherwise Canvas draws
the live decoded video frame each animation frame.

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
