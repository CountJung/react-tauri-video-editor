---
applyTo: "src/components/**,src/routes/**,src/context/**"
---

# UI 컴포넌트 / 라우트 지침

> **살아있는 문서** — 레이아웃·상태 보존·ResizableDialog·Timeline 패턴 변경 시 동기화.  
> 자세한 패턴은 `.github/skills/ui-conventions/SKILL.md`를 먼저 읽어라.

---

## 1. 팝업 다이얼로그 — ResizableDialog 절대 필수

- **모든 팝업은 `ResizableDialog` 사용** — MUI `Dialog` 직접 사용 금지.
- **`window.confirm()` 사용 금지** — confirmDialog state + ResizableDialog 패턴.
- 경로: `src/components/ResizableDialog.tsx`
- `storageKey`로 크기/위치 세션 유지.

## 2. Timeline 컴포넌트 규칙

- Timeline 편집 상태는 **반드시 `useTimelineStore` (Zustand)** 를 통해 변경.
- UI 컴포넌트가 직접 FFmpeg를 호출하지 않는다 — Export 시에만 Tauri command 호출.
- Track/Clip DnD 구현은 `dnd-kit` 사용 — 자체 drag 이벤트 구현 금지.
- Clip snap, 겹침 방지, Trim 로직은 `src/store/timelineStore.ts` 내 액션으로 처리.
- 자세한 패턴은 `timeline-editor` SKILL.md 참조.

## 3. Preview Player 규칙

- `HTML5 <video>` 엘리먼트로 미디어 재생 — 외부 플레이어 금지.
- `currentTime` 동기화는 Zustand `currentTime` 상태와 연동.
- 오디오 파형 시각화는 WaveSurfer.js 사용.
- Preview는 실제 편집 결과가 아닌 "참조 재생" — 원본 파일을 그대로 재생.

## 4. 레이아웃 리사이저

- `LayoutResizer` 컴포넌트로 패널 드래그 리사이즈.
- `usePersistedPanelSize` 훅으로 크기 localStorage 저장.
- storageKey는 `src/lib/storageKeys.ts`에 상수로 추가.

## 5. 상태 보존

- localStorage 연동 상태는 `useStickyState` 사용.
- key 상수는 `src/lib/storageKeys.ts` 중앙 관리.

## 6. IPC 호출

- `tauriInvoke` / `tauriListen` (`src/lib/invoke.ts`) 만 사용.
- `@tauri-apps/api/core` 직접 import 금지.

## 7. 에러 처리

- 에러는 `AppError` 형태 (src/lib/errors.ts).
- TS 타입 에러·Biome 경고 0 유지.

## 8. 라우팅

- 파일 기반 라우트 (`src/routes/`) — `routeTree.gen.ts` 수동 편집 금지.
- 새 라우트 추가 시 `docs/project-map.md` 라우트 구조 업데이트.

## 9. Drag & Drop (React Flow + dnd-kit)

- React Flow 캔버스 드롭 허용은 `ReactFlow`의 `onDragOver`/`onDrop`에 연결.
- wrapper 요소에 같은 `onDragOver` 중복 연결 금지.
- React 19 환경에서 no-drop(X) 커서 재발 방지: wrapper DOM에 native `dragover` 리스너 추가해 `preventDefault()` 보장.
