---
applyTo: "src/components/assets/**"
---

# 에셋 패널 지침

> **살아있는 문서** — 에셋 목록·파일 드롭·메타데이터 패턴 변경 시 동기화.  

---

## 1. 에셋 데이터 모델

```ts
type Asset = {
  id: string
  type: 'video' | 'audio' | 'image'
  path: string
  name: string
  duration: number   // 초 (이미지는 0)
  width?: number
  height?: number
  thumbnailPath?: string
}
```

## 2. 파일 드롭

- 에셋 패널은 파일 드롭 영역 — Tauri `drag-drop` 이벤트 수신.
- 파일 유효성(확장자) 검사는 Rust 측 `asset_import` command에서 처리.
- 임포트 후 `useAssetStore`(Zustand)에 에셋 추가.

## 3. 썸네일

- 비디오 썸네일은 FFmpeg로 백그라운드 생성 (`ffmpeg-integration` SKILL.md 참조).
- 썸네일 생성 완료 이벤트 `thumbnail-ready` 수신 후 에셋 목록 업데이트.

## 4. 에셋 → Timeline 드래그

- 에셋 항목은 `dnd-kit` `useDraggable` 적용.
- 드래그 데이터: `{ assetId, type, duration }`
- Timeline 드롭 시 `addClip` 액션 호출.
