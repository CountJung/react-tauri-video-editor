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
- Identify the file's current responsibilities and natural ownership boundaries.
- For frontend splits, keep route pages under `src/routes`, feature components under `src/components/<domain>`, shared utilities under `src/lib`, and state ownership under `src/store`.
- For 500kB+ chunk warnings, inspect the build output first. Prefer lazy-loading route bodies, dialogs, heavy editor panels, media tools, graph/timeline widgets, and settings screens with `React.lazy`/dynamic `import()` before raising `chunkSizeWarningLimit`.
- Keep `src/routeTree.gen.ts` untouched. In TanStack Router file routes, keep the route declaration thin and lazy-load the heavy component rendered by the route.
- Do not hide chunk warnings by only changing `build.chunkSizeWarningLimit` unless the team explicitly accepts the chunk size for Tauri desktop startup.
- For Rust splits, keep Tauri command modules under `src-tauri/src/commands` and shared errors/events in `common.rs`.
- Update imports, exports, command registration, docs, and skills when a split changes ownership or new files are added.
- Keep `PROJECT_MAP.md` fresh whenever files move, new feature folders appear, or ownership boundaries change.

## Output

- If the split is small and safe, perform it and verify builds/checks where practical.
- If the split is risky, provide a staged decomposition plan with target files and responsibilities.
- Do not split generated files, lockfiles, build outputs, or documentation solely because they exceed 1000 lines.
- For bundle work, report the before/after largest chunk size from `pnpm build:vite`.
