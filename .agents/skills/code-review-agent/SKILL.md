---
name: code-review-agent
description: Use when Codex finds warnings, errors, failing checks, brittle code, or regressions outside the immediate user-requested scope and needs a focused review/fix pass without broad unrelated refactors.
---

# Code Review Agent

Use this sub-agent when the main agent discovers warnings, errors, failing checks, or likely regressions that are outside the primary task scope but should not be ignored.

## Trigger

- Build, lint, typecheck, compiler, or test warnings/errors outside the current edit scope.
- Suspicious regressions found while reading nearby code.
- Dead code, unreachable branches, fragile error handling, or inconsistent API shapes that are not part of the requested feature.

## Scope

- Confirm the issue is real and reproducible from the available output or code.
- Fix narrowly when the fix is safe and low-risk.
- If the fix is larger than the discovered issue, report it with file paths, exact symptoms, and recommended next steps.
- Do not reformat broad files, rename public APIs, or refactor unrelated code.

## Review Checklist

- Preserve existing architecture from `AGENTS.md`, `.github/copilot-instructions.md`, `MasterPlan.md`, and `TODO.md`.
- FSD/large-file split 리뷰에서는 `docs/FSD_LARGE_FILE_MIGRATION.md`의 단계 순서와 회귀 계약을 확인한다. 파일 이동만으로 책임 분리가 완료됐다고 판단하지 않는다.
- Keep IPC calls behind `src/lib/invoke.ts`; do not import `@tauri-apps/api/core` directly.
- Keep timeline editing state changes behind `useTimelineStore` actions.
- Keep Rust commands returning `Result<T, AppError>`.
- Use `ResizableDialog` for popup UI and never add `window.confirm()`.
- Add or update focused tests only when the warning/error behavior is covered by existing test infrastructure.
- Report commands run and any remaining warnings.

## Migration Review Addendum

- 리팩터링 diff가 동작 변경, 파일 이동, public API rename을 한꺼번에 포함하면 분리하도록 요청한다.
- Preview 변경은 RAF별 cancellation owner, media source URL 교체/해제, pointer cancel/capture, gesture당 history snapshot 수를 확인한다.
- FFmpeg 변경은 command signature/event/AppError, input index/filter label, z-order, escape, silent audio fallback의 기존 테스트 계약을 대조한다.
- Properties 변경은 한국어 history label, nested props merge, canvas/project metadata 동기화, crop edit 표시 조건을 대조한다.
- 외장 볼륨 Rust 검증 결과는 모든 Cargo 명령에 `CARGO_TARGET_DIR=/tmp/react-tauri-video-editor-target`가 적용됐는지 확인한다.
