---
applyTo: "src/components/timeline/**"
---

# Timeline 컴포넌트 지침

> **살아있는 문서** — Track/Clip 구조·DnD·snap 패턴 변경 시 동기화.  
> 자세한 패턴은 `.github/skills/timeline-editor/SKILL.md`를 먼저 읽어라.

---

## 1. 상태 중심 원칙

- 모든 편집 동작(이동, Trim, 추가, 삭제)은 반드시 `useTimelineStore` 액션을 통해 처리.
- Timeline 컴포넌트는 상태를 **읽고 액션을 호출**할 뿐, 직접 상태 변경 금지.
- FFmpeg는 Export 시에만 호출 — Timeline 조작 중 FFmpeg 호출 금지.

## 2. Track / Clip 데이터 모델

```ts
type Track = { id: string; type: 'video' | 'audio'; clips: Clip[] }
type Clip  = { id: string; assetId: string; start: number; duration: number; trimStart: number; trimEnd: number }
```

- `start` = 타임라인 기준 배치 위치(초).
- `trimStart` / `trimEnd` = 원본 영상 내 자르기 시작·끝(초).

## 3. Drag & Drop (dnd-kit)

- dnd-kit `useDraggable` / `useDroppable` 사용 — 자체 mousedown 드래그 구현 금지.
- Clip 이동 → `moveClip(clipId, newStart)` 액션 호출.
- Asset → Timeline 드롭 → `addClip(trackId, assetId, dropPosition)` 액션 호출.
- 자세한 패턴은 `timeline-editor` SKILL.md 참조.

## 4. Snap & 겹침 방지

- snap 간격은 `useTimelineStore`의 `snapInterval` 상태 기반.
- 클립 겹침 감지·정렬은 `store` 내 `resolveCollisions()` 유틸리티 사용.

## 5. React Flow 사용 규칙

- Timeline 트랙 레이아웃에 `@xyflow/react` 사용 시 `react-flow` SKILL.md 참조.
- Custom Node = Clip, Custom Edge 사용 금지.
