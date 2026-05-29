# Video Editor (React + Tauri) — AI Agent Instructions

> 이 파일은 **핵심 규칙만 포함**합니다. 도메인별 상세 지침은 `.github/skills/` 아래 스킬 파일을 참조하세요.

---

## 핵심 규칙 (항상 준수)

1. **IPC wrapper 필수** — `tauriInvoke` / `tauriListen` (`src/lib/invoke.ts`) 만 사용. `@tauri-apps/api/core` 직접 import 금지.
2. **에러는 `AppError`** — TS(`src/lib/errors.ts`) ↔ Rust(`src-tauri/src/commands/common.rs`) 동일 형태. Rust command는 `Result<T, AppError>` 반환.
3. **`routeTree.gen.ts` 수동 편집 금지** — TanStack Router가 자동 생성.
4. **경로·설정 값 하드코딩 금지** — `.env` 환경변수 → `std::env::var` 사용.
5. **모든 팝업 다이얼로그는 `ResizableDialog` 필수** — MUI `Dialog` 직접 사용 금지. `window.confirm()` 사용 금지.
6. **Timeline 상태 중심 설계** — 모든 편집 동작은 Zustand `useTimelineStore`를 통해 Timeline 상태를 변경한다. UI는 상태를 조작하고, FFmpeg는 Export 시에만 호출한다.
7. **문서 동기화 필수** — 소스 변경이 아래 항목에 해당하면 관련 문서를 함께 업데이트한다.
   - Rust 커맨드 추가/변경, FFmpeg 통합, 파일시스템 → `tauri-backend` 스킬 + `docs/Guide.md`
   - Timeline/Track/Clip 구조 변경 → `timeline-editor` 스킬
   - FFmpeg 명령 패턴·진행률 이벤트 변경 → `ffmpeg-integration` 스킬
   - 레이아웃·상태 보존 규칙 변경 → `ui-conventions` 스킬
   - 빌드·배포 절차 변경 → `docs/Guide.md`
   - 핵심 규칙 변경 → 이 파일(`copilot-instructions.md`)
8. **살아있는 문서 체계 유지** — 이 파일, `AGENTS.md`(루트), 모든 스킬 파일(`.github/skills/**`), 지침 파일(`.github/instructions/`)은 항상 살아있는 상태를 유지한다.
   - "살아있다" = 모든 작업 시 해당 파일들을 기준으로 **체크 → 검증 → 필요 시 수정**하는 과정을 반드시 거친다.
9. **에러·경고 무시 금지** — 모든 작업 완료 후 컴파일 에러·Clippy 경고·Biome 경고·TS 타입 에러를 반드시 확인하고 수정한다. `#[allow(...)]` / `// @ts-ignore` 로 무조건 억제 금지. 코드 작업 완료 후 에러가 있으면 **Code Review 에이전트**를 호출하여 검토·수정한다.
10. **반복 요청 시 근본 원인 점검** — 비슷한 요청이 반복될 경우 관련 스킬이 누락·오류·미갱신 상태인지 점검하고 처리 방식에 변화를 준다.
11. **MD 다이어그램 — 한글+박스 그림 금지** — 아키텍처 다이어그램은 **Mermaid**(`mermaid` 코드 블록) 또는 ASCII 전용(`+`, `-`, `|`) 박스를 사용한다. 트리(`├─`, `└─`) 구조에서 한글 라벨은 허용.
12. **단일 파일 1,000줄 초과 시 리팩토링 필수** — 역할·도메인 기준으로 분리. `src/components/{feature}/` 하위에 관련 파일 그룹화.
13. **TODO.md 체크 표시 즉시 반영 필수** — 기능 구현이 완료되는 즉시 `TODO.md`의 해당 항목을 `[ ]` → `[x]`로 변경한다. 구현 세션이 끝날 때 미체크 항목이 남아있으면 안 된다. 부분 구현 항목은 하위 항목별로 개별 체크한다.

---

## Stack & Key Files

| 레이어 | 기술 | 핵심 경로 |
|---|---|---|
| Frontend | React 19 + TanStack Router (파일 기반) | `src/routes/` |
| UI | MUI v7 | - |
| 상태 관리 | Zustand | `src/store/` |
| DnD | dnd-kit | `src/components/timeline/` |
| Timeline 캔버스 | React Flow (`@xyflow/react`) | `src/components/timeline/` |
| 미디어 프리뷰 | HTML5 video + WaveSurfer.js | `src/components/preview/` |
| IPC | Tauri 2.0 `invoke` / `listen` | `src/lib/invoke.ts` |
| Backend | Rust (Tauri commands) | `src-tauri/src/commands/` |
| 미디어 처리 | FFmpeg (sidecar) | `src-tauri/src/commands/ffmpeg.rs` |
| 파일시스템 | Tauri fs plugin | `src-tauri/src/commands/asset.rs` |

---

## 개발 명령어

| 목적 | 명령어 | 비고 |
|---|---|---|
| Tauri 전체 개발 | `pnpm dev` | Rust 빌드 포함 |
| Vite 빌드 | `pnpm build:vite` | |
| Tauri 릴리즈 빌드 | `pnpm build` | |
| Rust 컴파일 확인 | `cargo check` (`src-tauri/`) | |
| 테스트 | `pnpm test` | Vitest |
| 자동 포맷/린트 | `pnpm fix` | Biome (TS/JS) |

---

## 코드 스타일

- **TS/JS**: Biome, 2스페이스, import 자동 정렬.
- **Rust**: `rustfmt` + `clippy` 경고 0.
- `src/routeTree.gen.ts` Biome 대상 제외.

---

## 스킬 안내 (도메인별 상세 지침)

| 스킬 | 적용 시점 | 경로 |
|---|---|---|
| **tauri-backend** | Rust 커맨드, IPC, 파일시스템, FFmpeg sidecar | `.github/skills/tauri-backend/SKILL.md` |
| **timeline-editor** | Timeline/Track/Clip 구조, dnd-kit, React Flow 커스텀 | `.github/skills/timeline-editor/SKILL.md` |
| **ffmpeg-integration** | FFmpeg 명령, 썸네일, Export, 진행률 이벤트 | `.github/skills/ffmpeg-integration/SKILL.md` |
| **ui-conventions** | 레이아웃, useStickyState, DIAG 로깅, ResizableDialog | `.github/skills/ui-conventions/SKILL.md` |
| **rust-skills** | Rust 데이터 구조, trait, 에러 처리, clippy/fmt | `.github/skills/rust-skills/SKILL.md` |
| **react-best-practices** | React 성능 최적화, 리렌더 방지, 비동기 패턴 | `.github/skills/react-best-practices/SKILL.md` |
| **react-flow** | React Flow 커스텀 노드/엣지, 캔버스 상호작용 | `.agents/skills/react-flow/SKILL.md` |

---

## 자동 지침 파일 (파일 범위별 적용)

VS Code / GitHub Copilot은 `applyTo` 글로브에 해당하는 파일 편집 시 아래 지침을 자동 적용한다.

| 지침 파일 | 적용 범위 | 내용 |
|---|---|---|
| `backend.instructions.md` | `src-tauri/**` | Rust command, FFmpeg, 파일시스템 규칙 |
| `ui.instructions.md` | `src/components/**`, `src/routes/**` | Timeline, Preview, ResizableDialog, IPC 호출 |
| `timeline.instructions.md` | `src/components/timeline/**` | Track/Clip DnD, 상태 패턴, snap 규칙 |
| `asset.instructions.md` | `src/components/assets/**` | 에셋 패널, 파일 드롭, 메타데이터 |
| `docs.instructions.md` | `docs/**`, `AGENTS.md`, `.github/**` | 문서 동기화 규칙, MD 다이어그램 |

---

## 프롬프트 안내 (재사용 가능한 태스크 템플릿)

| 프롬프트 | 용도 | 경로 |
|---|---|---|
| **New Route** | TanStack Router 파일 기반 라우트 스캐폴딩 | `.github/prompts/new-route.prompt.md` |
| **New Command** | Rust Tauri command 스캐폴딩 | `.github/prompts/new-command.prompt.md` |

---

## 커스텀 에이전트

| 에이전트 | 용도 | 경로 |
|---|---|---|
| **Code Review** | 작업 완료 후 Biome/Clippy/TSC/핵심 규칙 위반 자동 검토·수정 | `.github/agents/code-review.agent.md` |

---

## 프로젝트 맵 & 프로젝트 구조 문서

- **핵심 규칙 & 에이전트 지침** → `AGENTS.md` (루트) — 모든 에이전트가 작업 전 참조
- **프로젝트 전체 구조 맵** → `docs/project-map.md` — 레이어 구조, 라우트 맵, 커맨드 맵, 환경변수, 체크리스트

**모든 작업 전 두 파일을 기준으로 체크하고, 소스와 불일치하면 즉시 업데이트한다.**

---

## 라이브러리 문서 조회 — mcp_context7 활용 규칙

> 라이브러리 API, 옵션, 패턴을 다룰 때 **훈련 데이터 대신 mcp_context7** 를 먼저 조회한다.  
> 버전 불일치로 인한 빌드 오류·deprecated API 사용을 방지하고 최신 스타일을 유지한다.

### 언제 조회하는가

- 라이브러리 API 사용법이 확실하지 않을 때
- 새 라이브러리 코드를 **처음 작성**하기 전
- 기존 코드가 컴파일·타입 오류를 낼 때 (API 변경 여부 확인)
- 메이저·마이너 버전 업그레이드 시
- deprecated 경고가 발생할 때

### 절차

1. `mcp_context7_resolve-library-id` 로 라이브러리 ID 획득
2. `mcp_context7_query-docs` 로 구체적인 질문 조회 (3회/질문 한도)
3. 조회 결과를 기준으로 코드 작성 — 훈련 데이터 추측 금지

### 프로젝트 핵심 라이브러리 Context7 ID

| 라이브러리 | Context7 Library ID | 용도 |
|---|---|---|
| Tauri 2 | `/tauri-apps/tauri-docs` | Rust 커맨드, IPC, 플러그인 |
| Material UI v7 | `/websites/mui_material-ui` | UI 컴포넌트, 테마 |
| TanStack Router | `/tanstack/router` | 파일 기반 라우팅 |
| React Flow | `/xyflow/xyflow` (resolve 필요) | Timeline 캔버스 |
| Zustand | `/pmndrs/zustand` (resolve 필요) | 상태 관리 |
| dnd-kit | `/clauderic/dnd-kit` (resolve 필요) | DnD |
| WaveSurfer.js | `/katspaugh/wavesurfer.js` (resolve 필요) | 오디오 파형 |
| Vite | `/vitejs/vite` (resolve 필요) | 빌드 |

> `(resolve 필요)` 항목은 `mcp_context7_resolve-library-id` 로 정확한 ID를 먼저 조회한다.

### 코드 최신 스타일 기준

- **Tauri 2**: `invoke` 대신 항상 `tauriInvoke` wrapper 사용. 플러그인 API는 최신 `@tauri-apps/plugin-*` 패키지 참고.
- **MUI v7**: `sx` prop + CSS Variables 테마 (`theme.cssVars`) 패턴 사용. v5 legacy `makeStyles` 금지.
- **TanStack Router**: 파일 기반 라우트 + `createFileRoute`. `useSearch`, `useParams` 타입 추론 활용.
- **Zustand v5**: `create` + `immer` 미들웨어. v4 이하 `set` 패턴 주의.
- **React 19**: `use()` hook, Server Components 없음 (Tauri SPA). `useTransition` 비동기 상태 활용.

---

## graphify

For any question about this repo's architecture, structure, components, or how to add/modify/find
code, your **first tool call must be** to read `graphify-out/GRAPH_REPORT.md` (if it exists).

Triggers: "how do I…", "where is…", "what does … do", "add/modify a <component>",
"explain the architecture", or anything that depends on how files or classes relate.

After reading the report (and `graphify-out/wiki/index.md` for deep questions), answer from the
graph. Only read source files when (a) modifying/debugging specific code, (b) the graph lacks
the needed detail, or (c) the graph is missing or stale.

Type `/graphify` in Copilot Chat to build or update the graph.
