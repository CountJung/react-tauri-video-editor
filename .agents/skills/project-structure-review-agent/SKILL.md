---
name: project-structure-review-agent
description: Use when Codex finds any single source file over 1000 lines, a file whose responsibilities have grown too broad, or Vite reports a 500kB+ chunk that should be reviewed for lazy-loading/code-splitting opportunities.
---

# Project Structure Review Agent

Use this sub-agent when the main agent discovers a single source file over 1000 lines, a source file that is trending toward multiple durable responsibilities, or a Vite production build reports a chunk over 500kB after minification.

## Trigger

- Any `.ts`, `.tsx`, `.js`, `.jsx`, or `.rs` source file is over 1000 lines.
- A file mixes UI, API calls, state ownership, processing logic, route handling, and storage responsibilities.
- Tauri `lib.rs`, route components, or large panels start accumulating durable business logic instead of composition or thin wiring.
- `pnpm build:vite` reports `Some chunks are larger than 500 kB after minification`.
- A route, dialog, media editor, graph/timeline widget, or settings panel is imported eagerly even though it is not needed for first paint.

## Review Checklist

- Start from `AGENTS.md`, `PROJECT_MAP.md`, `.github/copilot-instructions.md`, `MasterPlan.md`, and `TODO.md`.
- 이 저장소의 FSD/대형 파일 작업은 `docs/FSD_LARGE_FILE_MIGRATION.md`를 추가 기준으로 읽고, 문서에 기록된 추출 순서·소유권·회귀 계약을 우선 적용한다.
- Identify the file's current responsibilities and natural ownership boundaries.
- For frontend splits, keep route pages under `src/routes`, feature components under `src/components/<domain>`, shared utilities under `src/lib`, and state ownership under `src/store`.
- For 500kB+ chunk warnings, inspect the build output first. Prefer lazy-loading route bodies, dialogs, heavy editor panels, media tools, graph/timeline widgets, and settings screens with `React.lazy`/dynamic `import()` before raising `chunkSizeWarningLimit`.
- Keep `src/routeTree.gen.ts` untouched. In TanStack Router file routes, keep the route declaration thin and lazy-load the heavy component rendered by the route.
- Do not hide chunk warnings by only changing `build.chunkSizeWarningLimit` unless the team explicitly accepts the chunk size for Tauri desktop startup.
- For Rust splits, keep Tauri command modules under `src-tauri/src/commands` and shared errors/events in `common.rs`.
- Update imports, exports, command registration, docs, and skills when a split changes ownership or new files are added.
- Keep `PROJECT_MAP.md` fresh whenever files move, new feature folders appear, or ownership boundaries change.

## FSD Migration Guardrails

- FSD는 폴더 이름 변경이 아니라 `app → pages → widgets → features → entities → shared` 의존 방향과 slice 공개 API를 만드는 작업으로 판단한다.
- 큰 파일을 그대로 `widgets`로 이동한 것은 large-file split 완료로 세지 않는다. 현재 경로에서 순수 로직/도구별 UI를 먼저 분리한 뒤 shell을 이동한다.
- `shared`는 domain/store를 import할 수 없다. 특히 `withHistory`/`historyActions`는 여러 entity/store를 조정하므로 `shared`가 아니라 `features/edit-history` 후보다.
- 한 변경에서 동작 변경, 파일 이동, public API rename을 함께 수행하지 않는다. 한 번에 한 pure module 또는 한 slice를 처리한다.
- slice 외부 import는 slice `index.ts` 공개 API를 사용하고, 전역 mega barrel이나 barrel로 숨긴 순환 의존을 만들지 않는다.
- compatibility re-export를 사용하면 allowlist, 제거 조건, 후속 TODO를 함께 남긴다.
- 프론트 FSD와 Rust module split을 같은 레이어 모델로 취급하지 않는다. Rust는 `commands/ffmpeg.rs` facade와 `commands/ffmpeg/*.rs` 도메인 하위 모듈 경계를 유지한다.

## Repository-specific Split Order

현재 우선순위는 다음과 같다. 줄 수는 리뷰 시 `wc -l`로 다시 측정한다.

1. characterization test로 history/media/filter graph 계약을 고정한다.
2. `PropertiesPanel.tsx`: 공통 form control → tool panel → shell 순으로 추출한다.
3. `ffmpeg.rs`: progress/fit → visual filters → plan → graph 순으로 순수 함수를 추출하고 command signature는 유지한다.
4. `PreviewPlayer.tsx`: geometry/sync policy → presentational UI → media lifecycle → playback/render RAF → pointer interaction 순으로 진행한다.
5. 위 split 뒤 FSD import 검사와 `shared → entities → features → widgets → pages/app` 이동을 시작한다.

Preview 분리에서는 timeline clock RAF와 canvas draw RAF를 합치지 않고, video/image cache의 create/sync/release 소유권을 하나의 hook에 둔다. FFmpeg 분리에서는 input index, filter label, z-index/start ordering, escaping, silent audio fallback을 문자열 계약 테스트로 보호한다.

## Verification Matrix

- Frontend/docs: `pnpm typecheck`, `pnpm lint`, `pnpm test -- --run`, `pnpm build:vite`.
- Rust (외장 볼륨 필수): `CARGO_TARGET_DIR=/tmp/react-tauri-video-editor-target cargo fmt -- --check`, `cargo test`, `cargo check`, `cargo clippy --all-targets --all-features -- -D warnings`를 `src-tauri/`에서 실행한다. 모든 Cargo 명령에 동일한 `CARGO_TARGET_DIR`를 붙인다.
- Preview interaction을 옮긴 단계는 재생/seek/source 교체/text·shape/crop/resize·rotate/undo·redo smoke test 결과를 남긴다.
- FSD import 검사가 도입된 뒤에는 `pnpm verify:fsd-imports`를 필수 게이트로 추가한다.

## Output

- If the split is small and safe, perform it and verify builds/checks where practical.
- If the split is risky, provide a staged decomposition plan with target files and responsibilities.
- Do not split generated files, lockfiles, build outputs, or documentation solely because they exceed 1000 lines.
- For bundle work, report the before/after largest chunk size from `pnpm build:vite`.
