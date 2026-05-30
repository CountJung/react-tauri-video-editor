---
name: tauri-backend
description: Tauri Rust backend, IPC bridge, Rust command 추가 절차, FFmpeg sidecar, 파일시스템, AppError, 환경변수 설정. Keywords: rust, command, invoke, ffmpeg, asset, AppError, env, tauri, sidecar, fs
---
# Tauri Backend Skill — Video Editor

## IPC 패턴

```ts
// src/lib/invoke.ts
const result = await tauriInvoke<T>("command_name", { arg1, arg2 });
const unlisten = await tauriListen<T>("event_name", (payload) => { … });
```

- `@tauri-apps/api/core` 직접 임포트 금지 — wrapper가 Tauri 환경 감지·타임아웃·에러 정규화를 처리.

---

## 에러 처리 — AppError

```ts
// TS: src/lib/errors.ts
interface AppError { code: string; message: string; details?: string; }
```

```rust
// Rust: src-tauri/src/commands/common.rs
#[derive(Debug, serde::Serialize)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}
impl AppError {
    pub fn new(code: &str, message: impl Into<String>) -> Self { … }
    pub fn with_details(code: &str, msg: impl Into<String>, details: impl Into<String>) -> Self { … }
}
```

모든 Rust command → `Result<T, AppError>`. 프론트엔드에서 `toAppError(err)` → Snackbar 표시.

---

## Rust Command 추가 절차

1. `src-tauri/src/commands/<domain>.rs`에 `#[tauri::command]` 함수 작성
2. `src-tauri/src/commands/mod.rs`에 모듈 선언 (`pub mod <domain>;`)
3. `src-tauri/src/lib.rs`의 `invoke_handler!` 목록에 등록
4. 필요 시 `tauri::State<T>` 주입

```rust
// 예시: src-tauri/src/commands/asset.rs
#[tauri::command]
pub async fn asset_import(path: String) -> Result<Asset, AppError> {
    // 파일 유효성 검사, 메타데이터 추출
    Ok(Asset { … })
}
```

---

## FFmpeg Sidecar

### 번들 구성

- FFmpeg 바이너리는 `src-tauri/binaries/` 에 플랫폼별로 배치.
- `tauri.conf.json` `externalBin` 에 등록.

```json
{
  "bundle": {
    "externalBin": ["binaries/ffmpeg", "binaries/ffprobe"]
  }
}
```

### Sidecar 실행 패턴

```rust
// src-tauri/src/commands/ffmpeg.rs
use tauri_plugin_shell::ShellExt;

#[tauri::command]
pub async fn ffmpeg_export(
    app: tauri::AppHandle,
    output_path: String,
    clips: Vec<ClipExportInfo>,
) -> Result<(), AppError> {
    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args(&build_ffmpeg_args(&clips, &output_path))
        .spawn()
        .map_err(|e| AppError::new("FFMPEG_SPAWN", e.to_string()))?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                if let Some(progress) = parse_ffmpeg_progress(&line) {
                    app.emit(EVENT_FFMPEG_PROGRESS, progress).ok();
                }
            }
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    return Err(AppError::new("FFMPEG_FAILED", "Export failed"));
                }
                app.emit(EVENT_FFMPEG_DONE, ()).ok();
                break;
            }
            _ => {}
        }
    }
    Ok(())
}
```

### 진행률 파싱

```rust
fn parse_ffmpeg_progress(line: &[u8]) -> Option<FfmpegProgress> {
    let s = std::str::from_utf8(line).ok()?;
    // "time=00:00:04.00" 파싱 → percent 계산
    None
}
```

- 진행률 이벤트 페이로드: `{ percent: f32, currentTime: f32, totalTime: f32 }`

### 썸네일 생성

```rust
#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    asset_path: String,
    time_sec: f64,
    output_path: String,
) -> Result<String, AppError> {
    app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args(["-ss", &time_sec.to_string(), "-i", &asset_path,
               "-vframes", "1", "-q:v", "2", &output_path])
        .output()
        .await
        .map_err(|e| AppError::new("THUMBNAIL_FAILED", e.to_string()))?;
    Ok(output_path)
}
```

---

## 파일시스템 — 에셋 관리

```rust
// src-tauri/src/commands/asset.rs
const VIDEO_EXTS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm"];
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "aac", "flac", "ogg"];
const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp"];

#[tauri::command]
pub async fn asset_probe(
    app: tauri::AppHandle,
    path: String,
) -> Result<AssetMeta, AppError> {
    // ffprobe -v quiet -print_format json -show_streams <path>
    // JSON 파싱 → AssetMeta { duration, width, height }
}
```

---

## 이벤트 상수

모든 이벤트 이름은 `src-tauri/src/commands/common.rs`에 상수로 관리.

```rust
pub const EVENT_FFMPEG_PROGRESS: &str = "ffmpeg-progress";
pub const EVENT_FFMPEG_DONE: &str    = "ffmpeg-done";
pub const EVENT_FFMPEG_ERROR: &str   = "ffmpeg-error";
pub const EVENT_THUMBNAIL_READY: &str = "thumbnail-ready";
```

---

## 환경변수

경로·설정 값 하드코딩 금지. `.env` → `std::env::var` 사용.

```
# .env
APP_TEMP_DIR=.video-editor-temp
```

---

## macOS 외장하드 디버깅 주의사항

외장 exFAT 볼륨에서 Tauri/Rust를 디버깅할 때는 빌드 산출물이 워크스페이스 내부 `src-tauri/target`에 남지 않도록 반드시 분리한다.

### 왜 필요한가

- macOS는 exFAT에 `._*` 메타데이터 파일을 생성한다.
- Tauri `build.rs`가 생성된 permissions 파일을 읽을 때 `._default.toml` 같은 메타파일을 만나면 UTF-8 패닉이 발생할 수 있다.
- CodeLLDB의 `cargo` 실행은 `launch.json`의 일반 `env`가 아니라 `cargo.env`를 사용해야 한다.
- rust-analyzer는 `terminal.integrated.env.*`를 따르지 않으므로 별도 `extraEnv`가 필요하다.

### 반드시 지킬 설정 규칙

1. CodeLLDB 사용 시 `launch.json`의 `cargo.env.CARGO_TARGET_DIR`로 내부 드라이브 캐시를 지정한다.
2. rust-analyzer 사용 시 `rust-analyzer.server.extraEnv`, `rust-analyzer.cargo.extraEnv`, `rust-analyzer.check.extraEnv`에 동일한 `CARGO_TARGET_DIR`를 지정한다.
3. rust-analyzer 설정에서는 `${env:HOME}` 같은 변수 치환을 기대하지 말고 실제 절대 경로를 넣는다. 치환이 안 되면 `src-tauri/${env:HOME}/...` 같은 잘못된 캐시 경로가 생긴다.
4. `rust-analyzer.cargo.targetDir = true`는 워크스페이스 아래 `target/rust-analyzer`를 다시 만들 수 있으므로 외장 exFAT에서는 사용하지 않는다.
5. 외장 드라이브의 기존 `src-tauri/target/`은 필요 시 삭제하고, `dot_clean`으로 `._*` 메타파일을 정리한다.
6. 디버그 실패 시 먼저 `src-tauri/target/` 내부에 `._default.toml` 또는 `._*` 파일이 있는지 확인한다.

### 권장 체크 포인트

- Debug 실행 전 `cargo check`가 내부 드라이브 캐시를 사용하고 있는지 확인한다.
- `src-tauri/target/`이 외장하드에 다시 생기면 즉시 설정을 점검한다.
- Tauri 창 닫기/저장 다이얼로그 오류와 별개로, 빌드 단계에서의 패닉인지 런타임 오류인지 먼저 구분한다.
- rust-analyzer가 만든 캐시가 보이면, 먼저 설정 문자열에 리터럴 `${env:...}`가 섞여 있지 않은지 확인한다.
