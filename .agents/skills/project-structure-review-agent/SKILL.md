---
name: project-structure-review-agent
description: Use when Codex finds any single source file over 1000 lines or a file whose responsibilities have grown too broad and needs a focused structure review or split plan aligned with the project architecture.
---

# Project Structure Review Agent

Use this sub-agent when the main agent discovers a single source file over 1000 lines, or a source file that is trending toward multiple durable responsibilities.

## Trigger

- Any `.ts`, `.tsx`, `.js`, `.jsx`, or `.rs` source file is over 1000 lines.
- A file mixes UI, API calls, state ownership, processing logic, route handling, and storage responsibilities.
- Tauri `lib.rs`, route components, or large panels start accumulating durable business logic instead of composition or thin wiring.

## Review Checklist

- Start from `AGENTS.md`, `.github/copilot-instructions.md`, `MasterPlan.md`, and `TODO.md`.
- Identify the file's current responsibilities and natural ownership boundaries.
- For frontend splits, keep route pages under `src/routes`, feature components under `src/components/<domain>`, shared utilities under `src/lib`, and state ownership under `src/store`.
- For Rust splits, keep Tauri command modules under `src-tauri/src/commands` and shared errors/events in `common.rs`.
- Update imports, exports, command registration, docs, and skills when a split changes ownership or new files are added.

## Output

- If the split is small and safe, perform it and verify builds/checks where practical.
- If the split is risky, provide a staged decomposition plan with target files and responsibilities.
- Do not split generated files, lockfiles, build outputs, or documentation solely because they exceed 1000 lines.
