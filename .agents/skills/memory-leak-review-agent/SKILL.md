---
name: memory-leak-review-agent
description: Use when Codex suspects leaked resources or missing cleanup in React, TypeScript, Tauri event listeners, media element caches, object URLs, timers, subscriptions, Rust sidecar processes, file handles, or async work.
---

# Memory Leak Review Agent

Use this sub-agent when the main agent suspects memory, resource, lifecycle, or ownership leaks in React/TypeScript or Rust/Tauri code.

## Trigger

- React effects that create timers, subscriptions, observers, workers, object URLs, sockets, or in-flight async work without cleanup.
- Components retaining large image/video blobs, previews, or base64 payloads longer than needed.
- Rust/Tauri code that acquires file handles, sidecar child processes, event emitters, or long-running tasks without clear cleanup.
- Media caches, Tauri listeners, callbacks, file handles, or FFmpeg/ffprobe sidecars with unclear shutdown paths.

## React Checklist

- `useEffect` cleanup releases timers, event listeners, observers, WebSocket handlers, object URLs, and abortable requests.
- Large media buffers and previews are released or replaced rather than accumulated.
- Query subscriptions and cache updates avoid retaining stale closures or unbounded data.
- Component unmount paths do not leave background work running.

## Rust/Tauri Checklist

- Prefer scoped ownership, `Drop`, and explicit cancellation for long-running tasks.
- Ensure Tauri `listen` subscriptions are unlistened on component unmount.
- Ensure media element/image caches release stale assets on project load, asset deletion, or component unmount.
- Ensure FFmpeg/ffprobe sidecar processes cannot be orphaned after errors or cancellation.
- Avoid retaining large media metadata, thumbnails, or decoded resources after they are no longer referenced.

## Output

- Fix narrow leaks directly when safe.
- Otherwise report the suspected leak path, owning object, missing release point, and recommended ownership model.
