# Video Editor — Agent & Contributor Guide

> 모든 에이전트와 기여자는 작업 전 이 파일을 읽는다.

---

## 프로젝트 개요

React + Tauri 기반 데스크톱 비디오 에디터.  
타임라인 상태 중심 설계 — 편집은 상태 조작, 실제 미디어 처리는 Export 시에만.

---

## 핵심 규칙 요약

| # | 규칙 |
|---|---|
| 1 | IPC는 `tauriInvoke` / `tauriListen` (`src/lib/invoke.ts`) 만 사용 |
| 2 | Rust command는 `Result<T, AppError>` 반환 |
| 3 | `routeTree.gen.ts` 수동 편집 금지 (TanStack Router 자동 생성) |
| 4 | 경로·설정 값 하드코딩 금지 → `.env` + `std::env::var` |
| 5 | 팝업 다이얼로그는 `ResizableDialog` 필수, `window.confirm()` 금지 |
| 6 | 편집 동작은 반드시 `useTimelineStore` 액션을 통해 처리 |
| 7 | FFmpeg는 Export 시에만 호출 |
| 8 | 단일 파일 1,000줄 초과 시 역할별 분리 |
| 9 | 에러·경고 무시 금지 (`#[allow(...)]` / `@ts-ignore` 무조건 억제 금지) |
| 10 | 소스 변경 시 관련 문서·스킬 동기화 필수 |

---

## 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | React 19 + TypeScript + TanStack Router |
| UI | MUI v7 |
| 상태 관리 | Zustand (`useTimelineStore`, `useAssetStore`) |
| DnD | dnd-kit |
| Timeline 캔버스 | React Flow (`@xyflow/react`) |
| 미디어 프리뷰 | HTML5 video + WaveSurfer.js |
| IPC | Tauri 2.0 |
| Backend | Rust (Tauri commands) |
| 미디어 처리 | FFmpeg sidecar |

---

## 폴더 구조

```
src/
  routes/           # TanStack Router 파일 기반 라우트
  components/
    timeline/       # Timeline, Track, Clip, 플레이헤드
    preview/        # PreviewPlayer, WaveSurfer
    assets/         # AssetPanel, AssetItem
    common/         # ResizableDialog, LayoutResizer 등
  store/
    timelineStore.ts
    assetStore.ts
  lib/
    invoke.ts       # tauriInvoke / tauriListen wrapper
    errors.ts       # AppError 타입
    storageKeys.ts  # localStorage 키 상수
src-tauri/
  src/
    commands/
      asset.rs      # 파일 임포트, ffprobe
      ffmpeg.rs     # FFmpeg export, 썸네일
      common.rs     # AppError, 이벤트 상수
    lib.rs
  binaries/         # FFmpeg/ffprobe sidecar 바이너리
```

---

## 개발 명령어

```bash
pnpm dev          # Tauri 개발 모드 (Rust 빌드 포함)
pnpm build        # 릴리즈 빌드
pnpm test         # Vitest
pnpm fix          # Biome 자동 포맷/린트
cargo check       # Rust 컴파일 확인 (src-tauri/ 내에서)
cargo clippy      # Rust lint
```

---

## 스킬 파일 (도메인별 상세 지침)

| 스킬 | 경로 |
|---|---|
| tauri-backend | `.github/skills/tauri-backend/SKILL.md` |
| timeline-editor | `.github/skills/timeline-editor/SKILL.md` |
| ffmpeg-integration | `.github/skills/ffmpeg-integration/SKILL.md` |
| ui-conventions | `.github/skills/ui-conventions/SKILL.md` |
| rust-skills | `.github/skills/rust-skills/SKILL.md` |
| react-best-practices | `.github/skills/react-best-practices/SKILL.md` |
| react-flow | `.agents/skills/react-flow/SKILL.md` |

---

## 자동 지침 파일

| 파일 | 적용 범위 |
|---|---|
| `backend.instructions.md` | `src-tauri/**` |
| `ui.instructions.md` | `src/components/**`, `src/routes/**` |
| `charts.instructions.md` (→ timeline) | `src/components/timeline/**` |
| `tables.instructions.md` (→ assets) | `src/components/assets/**` |
| `docs.instructions.md` | `docs/**`, `AGENTS.md`, `.github/**` |

---

## 작업 전 체크리스트

- [ ] `useTimelineStore` 액션을 통해 상태 변경하는가?
- [ ] FFmpeg를 Export 외에 호출하지 않는가?
- [ ] `tauriInvoke` wrapper를 사용하는가?
- [ ] Rust command가 `Result<T, AppError>`를 반환하는가?
- [ ] 하드코딩된 경로·값이 없는가?
- [ ] `cargo clippy` / Biome 경고가 0인가?
- [ ] 관련 문서·스킬 파일을 업데이트했는가?
