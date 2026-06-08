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
| 11 | **기능 구현 완료 즉시 `TODO.md` 해당 항목을 `[x]`로 체크** — 세션 종료 전 미체크 금지 |

---

## Codex 적용 방식

이 저장소의 GitHub Copilot 지침·스킬은 Codex에서도 같은 효과를 내도록 **공통 지침 원천**으로 사용한다. Codex/OpenAI 기반 에이전트는 `AGENTS.md`를 진입점으로 삼고, 작업 전 아래 파일을 수동으로 적용한다.

1. 항상 `.github/copilot-instructions.md`를 공통 핵심 지침으로 확인한다.
2. 수정 대상 경로가 `.github/instructions/*.instructions.md`의 `applyTo` 범위에 걸리면 해당 파일을 함께 확인한다.
3. 작업 도메인에 맞는 `.github/skills/**/SKILL.md`를 먼저 읽고, 그 절차·금지사항·검증 기준을 따른다.
4. React Flow 작업은 `.agents/skills/react-flow/SKILL.md`와 필요 reference를 확인한다.
5. 코드 리뷰·오류 수정 요청은 `.github/agents/code-review.agent.md`를 Codex용 체크리스트로 사용한다.
6. 새 라우트·새 Tauri command 스캐폴딩 작업은 `.github/prompts/*.prompt.md` 템플릿을 참조한다.

Copilot 전용 표현(예: `applyTo` 자동 적용, Copilot Chat 명령, 커스텀 에이전트 호출)은 Codex에서 직접 실행되지 않을 수 있다. 이 경우 같은 의도를 Codex 도구로 수행한다. 예를 들어 `applyTo`는 파일 경로 기준 수동 매칭으로, Code Review 에이전트는 체크리스트 기반 자체 리뷰로, `/graphify`는 `graphify-out/GRAPH_REPORT.md` 존재 여부 확인으로 대체한다.

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

> Codex는 `.github/skills/`를 자동 로드하지 않으므로, 관련 파일을 수정하기 전에 위 표의 스킬을 직접 읽고 적용한다.

---

## 자동 지침 파일

GitHub Copilot은 `applyTo`로 자동 적용하고, Codex는 수정 대상 경로와 아래 표를 직접 대조해 해당 파일을 읽는다.

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
- [ ] 라이브러리 API 사용 전 `mcp_context7_query-docs`로 최신 버전 확인했는가?

---

## mcp_context7 라이브러리 문서 조회

라이브러리 API 작성 전 반드시 `mcp_context7_query-docs`로 최신 문서를 조회한다.  
훈련 데이터의 낡은 API 패턴 사용을 방지한다.

### 절차

1. `mcp_context7_resolve-library-id` → 라이브러리 ID 획득
2. `mcp_context7_query-docs` → 구체적인 질문 조회 (질문당 최대 3회)
3. 조회 결과 기준으로 코드 작성

### 확정 Context7 라이브러리 ID

| 라이브러리 | ID |
|---|---|
| Tauri 2 | `/tauri-apps/tauri-docs` |
| Material UI v7 | `/websites/mui_material-ui` |
| TanStack Router | `/tanstack/router` |
| React Flow, Zustand, dnd-kit, WaveSurfer.js, Vite | `resolve-library-id`로 먼저 조회 |
