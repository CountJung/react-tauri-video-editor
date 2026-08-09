# 검증 하니스 맵

> 모든 명령은 저장소 루트에서 실행한다. 패키지 관리자는 lockfile과 release workflow가 사용하는 `pnpm`이다.

## 1. 전제조건

- Node.js + pnpm (`package.json`, `pnpm-lock.yaml`)
- Rust stable + Cargo (Rust/Tauri 검사와 sidecar verifier의 target 탐지에 필요)
- 전체 Tauri 개발/번들: 플랫폼별 Tauri 시스템 의존성 + FFmpeg/ffprobe sidecar
- 최초 설치: `pnpm install --frozen-lockfile`

`.env.example`은 공개 기본값 템플릿이다. 실제 `.env`와 signing secret은 커밋하지 않는다.

## 2. 외장 볼륨 Cargo 규칙

이 저장소는 `/Volumes/Crucial X6/...`에 있다. macOS 외장 볼륨의 AppleDouble `._*`가 Tauri permission 생성에 섞이지 않도록 Cargo output을 내부 디스크에 둔다.

```bash
export CARGO_TARGET_DIR="$HOME/.cache/react-tauri-video-editor-target"
pnpm verify:cargo-target
```

같은 shell/session에서 이어지는 모든 `cargo`, `pnpm dev`, `pnpm build`에 이 환경변수를 유지한다. `src-tauri/target`이나 `/Volumes/...` 아래를 target으로 지정하지 않는다. verifier는 `src-tauri/target`에 이미 생긴 `._*`도 실패로 보고한다.

## 3. 빠른 변경 게이트

| 목적 | 일회성 명령 | 비고 |
|---|---|---|
| Biome lint/format 검사 | `pnpm lint` | `src/` 대상, 수정 없음 |
| Biome 자동 수정 | `pnpm fix` | 파일을 변경하므로 diff 확인 |
| TypeScript | `pnpm typecheck` | strict, emit 없음 |
| Vitest 일회 실행 | `pnpm test -- --run` | 현재 3 test files; `pnpm test`는 watch |
| 프론트 빌드 | `pnpm build:vite` | `dist/` 생성, Tauri bundle/sidecar 불필요 |

권장 frontend 순서:

```bash
pnpm lint
pnpm typecheck
pnpm test -- --run
pnpm build:vite
```

## 4. Rust 게이트

Rust toolchain이 PATH에 있어야 한다. 루트에서 manifest를 명시하면 작업 디렉터리 혼동을 피할 수 있다.

```bash
export CARGO_TARGET_DIR="$HOME/.cache/react-tauri-video-editor-target"
pnpm verify:cargo-target
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

- `cargo test`: `src-tauri/src/commands/ffmpeg/tests.rs`의 export/filter graph unit tests 포함.
- `cargo clippy ... -D warnings`: 신규 warning을 실패 처리.
- Rust command/DTO/filter graph 변경은 네 명령을 모두 실행한다.

## 5. FFmpeg sidecar 게이트

| 목적 | 명령 |
|---|---|
| 현재 host sidecar 다운로드 | `pnpm install-ffmpeg` |
| 지원 플랫폼 전체 다운로드 | `pnpm install-ffmpeg:all` |
| 현재 host 검증 | `pnpm verify:ffmpeg-sidecars` |
| 전체 플랫폼 파일 검증 | `pnpm verify:ffmpeg-sidecars:all` |

sidecar는 `src-tauri/binaries/`에 놓이며 git 제외다. verifier는 Rust host triple 감지, Tauri `externalBin`, 파일명, 실행 비트와 버전 실행을 검사하므로 Rust toolchain과 다운로드된 바이너리가 필요하다.

## 6. 실행/빌드 하니스

| 범위 | 명령 | 기대 동작 |
|---|---|---|
| 브라우저 UI | `pnpm dev:vite` | `http://127.0.0.1:1420`, native 기능은 fallback/guard |
| Tauri 개발 | `pnpm dev` | `tauri dev`; config가 Vite를 `beforeDevCommand`로 시작 |
| Vite preview | `pnpm preview` | 사전 `pnpm build:vite` 필요 |
| 전체 desktop bundle | `pnpm build` | `tauri build`; Vite build + Rust release + sidecar/bundle |
| VS Code helper | `pnpm dev:vite:debug` | 기존 1420 서버 재사용 가능한 helper |

전체 Tauri smoke 전:

```bash
export CARGO_TARGET_DIR="$HOME/.cache/react-tauri-video-editor-target"
pnpm verify:cargo-target
pnpm install-ffmpeg
pnpm verify:ffmpeg-sidecars
pnpm dev
```

`pnpm build`는 OS별 installer/toolchain/signing 조건이 있으므로 `pnpm build:vite`의 대체가 아니다. release workflow는 Windows, macOS arm64/x64에서 installer를 만들고 Linux에서 sidecar를 검증한다.

## 7. 변경 유형별 최소 매트릭스

| 변경 | 최소 검증 | 추가 확인 |
|---|---|---|
| 문서만 | 링크/경로와 명령 대조, `git diff --check` | markdown/html local link 존재 |
| 일반 TS/UI | lint + typecheck + Vitest + Vite build | 브라우저/Tauri UI smoke |
| timeline/Canvas | 위 전체 | compositor/export payload tests, gesture history 1회 |
| project save/load | 위 전체 | `.vedproj` round trip, dirty/recent/history reset |
| Rust command | frontend gate + Cargo fmt/check/test/clippy | command 등록과 AppError |
| FFmpeg/export | 모든 frontend/Rust gate | sidecar verify, event cleanup, 실제 짧은 export smoke |
| Tauri config/release | 모든 gate | capabilities, externalBin, 해당 OS `pnpm build` |

## 8. 결과 기록 형식

완료 보고에는 명령, exit 결과, 의도적 미실행과 이유를 적는다. 환경 누락으로 실행되지 않은 검사를 통과로 표기하지 않는다.

이 문서 작성 시 확인된 환경 특이사항: frontend 하니스는 실행 가능하지만 현재 shell PATH에는 `cargo`/`rustc`가 없으면 Rust 게이트와 Rust host triple을 요구하는 sidecar verifier가 실행될 수 없다. 실제 작업 시 `command -v cargo rustc`로 먼저 확인한다.
