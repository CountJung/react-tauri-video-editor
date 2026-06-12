---
applyTo: "src-tauri/**"
---

# Rust / Tauri 백엔드 지침

> **살아있는 문서** — Rust command, FFmpeg, 파일시스템 변경 시 이 파일도 동기화한다.  
> 자세한 패턴은 `.github/skills/tauri-backend/SKILL.md`를 먼저 읽어라.

---

## 1. Tauri Command 규칙

- 모든 command는 `Result<T, AppError>` 반환 — 다른 에러 타입 직접 반환 금지.
- `AppError` 구조: `{ code: String, message: String, details: Option<String> }` (`common.rs`)
- command는 `src-tauri/src/commands/` 모듈에 위치, `lib.rs`에 등록.
- 새 command 추가 시 tauri-backend SKILL.md의 절차를 따른다.

## 2. FFmpeg Sidecar

- FFmpeg는 `sidecar` 방식으로 번들 (`src-tauri/binaries/`).
- 모든 FFmpeg 실행은 `src-tauri/src/commands/ffmpeg.rs`에서 관리.
- 진행률은 stderr 파싱 → `app.emit("ffmpeg-progress", payload)` 이벤트로 프론트에 전달.
- Export 완료/실패도 이벤트로 전달 — 동기 blocking 호출 금지.
- FFmpeg 명령 패턴은 `ffmpeg-integration` SKILL.md 참조.

## 3. 파일시스템 (에셋 관리)

- 파일 경로·경로 처리는 `src-tauri/src/commands/asset.rs`에서 담당.
- Tauri `fs` plugin 사용 — 직접 `std::fs` 호출보다 Tauri 권한 범위 안에서 처리.
- 에셋 메타데이터(duration, width, height) 추출: FFmpeg probe 또는 `ffprobe` 활용.

## 4. 환경변수 / 설정

- 경로·설정 값 **하드코딩 금지** — `.env` → `std::env::var` 사용.
- 새 ENV 키 추가 시 루트 `PROJECT_MAP.md` 환경변수/설정 맵도 업데이트.
- Tauri 로컬 디버그 `devUrl`은 `http://127.0.0.1:1420`을 유지한다. `localhost`는 Windows WebView2에서 연결 거부를 유발할 수 있으므로 기본값으로 되돌리지 않는다.
- VS Code 디버그 서버는 `start-vite-dev-server` → `pnpm dev:vite:debug` → `scripts/vscode-vite-dev.mjs` 흐름을 사용한다. devUrl/host 변경 시 `AGENTS.md`, `.github/copilot-instructions.md`, `docs/Guide.md`, `tauri-backend` 스킬을 함께 동기화한다.

## 5. 이벤트 (Tauri emit)

- 장시간 작업(FFmpeg 인코딩, 썸네일 일괄 생성)은 진행률 이벤트를 방출한다.
- 이벤트 이름 상수는 `src-tauri/src/commands/common.rs`에 모아서 관리.

## 6. Rust 코드 품질

- `rustfmt` 포맷 + `cargo clippy` 경고 0 유지.
- `#[allow(...)]`로 무조건 억제 금지.
- 모든 작업 후 `cargo check` / `cargo clippy` 실행 확인.
