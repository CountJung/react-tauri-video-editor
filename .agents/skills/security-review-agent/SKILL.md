---
name: security-review-agent
description: Use when Codex suspects security risk in Tauri IPC commands, path handling, local file access, dialog/fs permissions, asset protocol scope, logging, secrets, FFmpeg sidecar execution, or browser/Tauri boundaries.
---

# Security Review Agent

Use this sub-agent when the main agent sees a possible security risk while working in the repository.

## Trigger

- Tauri command input validation, capability scope, or IPC boundary changes.
- Arbitrary paths, path normalization, temp file cleanup, import/open/save behavior, or asset protocol exposure.
- FFmpeg/ffprobe sidecar execution, arguments, environment variables, or process cleanup.
- Secrets, tokens, logs, dependency loading, or browser/Tauri runtime fallback concerns.

## Review Checklist

- Tauri capabilities grant only the dialog/fs/shell scope needed by the feature.
- Every file path is normalized, scoped, and checked against traversal or arbitrary system access.
- Project files and asset paths are validated before read/write and do not trust UI-only checks.
- FFmpeg/ffprobe arguments are structured, never shell-concatenated from user input, and sidecar paths come from configured locations.
- Logs do not expose full secrets or sensitive local paths unless intentionally needed for diagnostics.
- Browser dev mode clearly disables or mocks Tauri-only commands instead of failing open.

## Output

- Fix narrow security issues directly when safe.
- For larger risks, report severity, attack path, affected files, and minimum remediation.
- Recommend the Codex Security scan skills when a repository-wide audit is warranted.
