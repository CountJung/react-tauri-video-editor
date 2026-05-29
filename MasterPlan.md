# 🎬 Video Editor Master Plan (React + Tauri)

## 1. 🎯 목표 정의

### 핵심 목표

* 동영상 / 오디오 / 이미지 파일을 자유롭게 로드
* 타임라인에서 직관적으로 배치 / 자르기 / 이동
* **캔버스 기반 합성**: 비디오 위에 텍스트·도형·이미지 오버레이를 자유롭게 배치
* 드래그 기반 편집 UX (CapCut / Premiere 수준의 직관성 지향)
* FFmpeg Export로 최종 결과물 출력

### 비목표 (초기)

* 고급 색보정 / LUT
* 복잡한 이펙트 파티클 시스템
* 협업 기능

---

## 2. 🧱 전체 아키텍처

```
[React UI]
 ├─ ToolPanel            ← 도구 선택 (Select/Text/Shape/Razor)
 ├─ AssetPanel           ← 파일 임포트·썸네일 목록
 ├─ CanvasCompositor     ← Canvas 위에 레이어 합성 (실시간 프리뷰)
 │   ├─ VideoLayer       ← 비디오/이미지 드로잉
 │   ├─ TextLayer        ← 텍스트 렌더링
 │   └─ ShapeLayer       ← 도형 렌더링
 └─ TimelinePanel        ← 트랙·클립 배치, 플레이헤드, 줌
      └─ LayerPanel      ← 트랙 가시성/잠금/불투명도/z-order
     ↓ (Zustand: useTimelineStore, useToolStore)
[Tauri (Rust)]
 ├─ asset.rs             ← 파일 임포트, ffprobe 메타데이터
 ├─ ffmpeg.rs            ← Export, 썸네일, 오버레이 합성
 └─ common.rs            ← AppError, 이벤트 상수
```

---

## 3. 📦 핵심 모듈 설계

### 3.1 Asset 관리

#### 데이터 모델

```ts
type Asset = {
  id: string
  type: 'video' | 'audio' | 'image'
  path: string
  name: string
  duration: number      // 초 (이미지: 0)
  width?: number
  height?: number
  thumbnailPath?: string
}
```

---

### 3.2 Timeline & Layer 구조 (핵심)

#### 트랙 기반 구조

```ts
type TrackType = 'video' | 'audio' | 'overlay' | 'text' | 'shape'

type Track = {
  id: string
  type: TrackType
  clips: Clip[]
  // 레이어 속성
  visible: boolean
  locked: boolean
  opacity: number    // 0~1, 트랙 전체 불투명도
  zIndex: number     // 렌더 순서
}

type Clip = {
  id: string
  assetId: string          // '' for text/shape clips
  start: number            // 타임라인 위치 (초)
  duration: number
  trimStart: number
  trimEnd: number
  // Canvas 변환 속성
  x: number                // Canvas 좌표 (픽셀, 0=왼쪽)
  y: number
  width: number            // 표시 크기
  height: number
  rotation: number         // 도(degrees)
  opacity: number          // 0~1 (클립 개별)
  // 타입별 확장 (discriminated)
  clipType: 'media' | 'text' | 'shape'
  textProps?: TextProps    // clipType === 'text'
  shapeProps?: ShapeProps  // clipType === 'shape'
}

type TextProps = {
  text: string
  fontFamily: string
  fontSize: number
  color: string
  bold: boolean
  italic: boolean
  align: 'left' | 'center' | 'right'
  shadow?: { blur: number; color: string; offsetX: number; offsetY: number }
}

type ShapeProps = {
  shapeType: 'rect' | 'circle' | 'arrow'
  fill: string
  stroke: string
  strokeWidth: number
  dash?: number[]
}
```

---

### 3.3 Canvas Compositor (새로운 프리뷰 시스템)

```
[CanvasCompositor]
  ↓ useAnimationFrame (60fps when playing)
  ↓ reads: tracks (sorted by zIndex), currentTime
  ↓ for each visible track:
      → find active clip at currentTime
      → apply clip transform (x, y, w, h, rotation, opacity)
      → drawImage (video/image) or fillText (text) or path (shape)
  ↓ renders to <canvas> element
  ↓ selection overlay (transform handles) drawn on top
```

**Canvas 좌표계**: 캔버스 크기 = 출력 해상도(예: 1920×1080). CSS transform으로 화면에 맞게 축소 표시.

---

### 3.4 도구 시스템 (ToolPanel)

```ts
type ToolType = 
  | 'select'    // 오브젝트 선택·이동·리사이즈
  | 'text'      // 클릭 → TextClip 삽입
  | 'rect'      // 드래그 → ShapeClip(rect) 삽입
  | 'circle'    // 드래그 → ShapeClip(circle) 삽입
  | 'arrow'     // 드래그 → ShapeClip(arrow) 삽입
  | 'crop'      // 클립 cropRect 편집
  | 'razor'     // 클릭 → 클립 분할 (splitClip)
```

도구 패널은 CanvasCompositor 좌측에 배치된 세로 아이콘 툴바.

---

### 3.5 Layer 관리 패널

타임라인 레이블 영역을 확장하여 레이어 패널로 사용:

```
[LayerPanel] (타임라인 왼쪽)
  [👁] [🔒] [━━━━━] V  ← 비디오 트랙
  [👁] [🔒] [━━━━━] OL ← 오버레이 트랙
  [👁] [🔒] [━━━━━] T  ← 텍스트 트랙
  [👁] [🔒] [━━━━━] S  ← 도형 트랙
  [👁] [🔒] [━━━━━] A  ← 오디오 트랙
```

---

## 4. 🖱️ UX 핵심 기능

### 4.1 Drag & Drop

* 파일 → Asset Panel (Tauri drag-drop)
* Asset → Timeline Track (dnd-kit)
* Clip → 이동 / 복제 (dnd-kit)
* **새로움**: Asset → Canvas (직접 캔버스에 드롭하여 오버레이 추가)

---

### 4.2 Clip 편집

#### 필수 기능

* 좌우 드래그 → Trim (trimStart/trimEnd)
* 전체 드래그 → 이동
* Razor 도구 → 클립 분할
* 겹침 시 자동 정렬 (resolveCollisions)
* **Canvas에서**: 드래그 이동, 핸들 리사이즈, 핸들 회전

---

### 4.3 Canvas 인터랙션

* Select 도구: 클릭으로 오브젝트 선택 → Transform Handles 표시
* 변환 핸들: 8방향 리사이즈 + 상단 회전 핸들
* 더블클릭 텍스트: 인라인 텍스트 에디터 열기
* Canvas 빈 곳 클릭: 선택 해제

---

## 5. 🔧 기술 스택

### UI

* React 19 (TypeScript)
* MUI v7 (`sx` + CSS Variables)
* dnd-kit (타임라인 DnD)
* Zustand v5 (상태 관리)

### Canvas / Timeline

* HTML5 Canvas API (프리뷰 합성)
* React Flow (타임라인 캔버스 — 향후 노드 기반 편집)

### Media

* HTML5 `<video>` (오프스크린 프레임 소스)
* WaveSurfer.js (오디오 파형)

### Backend

* Tauri 2.0
* FFmpeg (sidecar)

---

## 6. ⚙️ FFmpeg Export 역할

### 사용 기능

* 비디오 concat / trim (concat demuxer or filter_complex)
* 오버레이 합성 (`overlay` 필터)
* 텍스트 번인 (`drawtext` 필터)
* 오디오 믹싱 (`amix` 필터)
* 인코딩 설정 (해상도, 비트레이트, 코덱)

---

## 7. 🧠 핵심 설계 원칙

### 1. 상태 = Timeline + Layer 중심

* 모든 편집 동작은 `useTimelineStore` 액션을 통해 상태를 변경
* FFmpeg는 Export 시에만 호출 (편집 중 절대 호출 안 함)

### 2. Canvas Preview는 "실시간 합성 참조"

* 실제 파일 수정 없음
* 타임라인 currentTime 기준으로 Canvas에 레이어 합성하여 프리뷰

### 3. 도구 → 상태 변경 → Canvas 반영

* ToolPanel에서 도구 선택 → `useToolStore.activeTool` 변경
* Canvas 인터랙션 → `useTimelineStore` 액션으로 Clip 속성 변경
* Canvas는 상태를 읽어 매 프레임 렌더링

---

## 8. 🚀 개발 단계

| Phase | 내용 | 상태 |
|---|---|---|
| Phase 1 | 파일 임포트, Asset Panel, 기본 Preview | ✅ 완료 |
| Phase 2 | Timeline UI, Clip DnD | ✅ 완료 |
| Phase 3 | Trim, Playback Sync, 레이아웃 리사이저 | ✅ 완료 |
| Phase 4 | Export (FFmpeg) | ✅ 완료 |
| Phase 5 | Canvas 기반 합성 프리뷰 | 🚧 설계 완료, 구현 예정 |
| Phase 6 | ToolPanel (Select/Text/Shape/Razor) | 🚧 UI 스켈레톤 구현 |
| Phase 7 | 텍스트 & 도형 렌더링 | ⏳ 예정 |
| Phase 8 | 레이어 관리 패널 | ⏳ 예정 |
| Phase 9 | 고급 편집 (분할, 속도, 크롭) | ⏳ 예정 |
| Phase 10 | FFmpeg Export 고도화 | ⏳ 예정 |

## 1. 🎯 목표 정의

### 핵심 목표

* 동영상 / 오디오 / 이미지 파일을 자유롭게 로드
* 타임라인에서 직관적으로 배치 / 자르기 / 이동
* 드래그 기반 편집 UX (Premiere 수준의 직관성 지향)

### 비목표 (초기)

* 고급 색보정
* 복잡한 이펙트 시스템
* 협업 기능

---

## 2. 🧱 전체 아키텍처

```
[React UI]
 ├─ Timeline Editor
 ├─ Preview Player
 ├─ Asset Panel
 ↓
[Tauri (Rust)]
 ├─ File System
 ├─ FFmpeg Command
 └─ Background Processing
```

---

## 3. 📦 핵심 모듈 설계

### 3.1 Asset 관리

#### 구조

```
assets/
 ├─ videos
 ├─ audios
 ├─ images
```

#### 데이터 모델

```ts
type Asset = {
  id: string
  type: 'video' | 'audio' | 'image'
  path: string
  duration: number
}
```

---

### 3.2 Timeline 구조 (핵심)

#### 트랙 기반 구조

```ts
type Timeline = {
  tracks: Track[]
}

type Track = {
  id: string
  type: 'video' | 'audio'
  clips: Clip[]
}

type Clip = {
  id: string
  assetId: string
  start: number      // 타임라인 위치
  duration: number
  trimStart: number  // 원본 자르기 시작
  trimEnd: number
}
```

---

### 3.3 Preview 시스템

* HTML5 video 기반
* currentTime = 타임라인 위치와 동기화

---

## 4. 🖱️ UX 핵심 기능

### 4.1 Drag & Drop

* 파일 → Asset Panel
* Asset → Timeline
* Clip → 이동 / 복제

---

### 4.2 Clip 편집

#### 필수 기능

* 좌우 드래그 → Trim
* 전체 드래그 → 이동
* 겹침 시 자동 정렬 (snap)

---

### 4.3 Timeline 인터랙션

* 줌 (wheel)
* 스크롤 (horizontal)
* 플레이헤드 이동

---

## 5. 🔧 기술 스택

### UI

* React (typescript)
* MUI
* dnd-kit
* Zustand

### Timeline

* React Flow (커스터마이징 기반)

### Media

* HTML5 video
* WaveSurfer (오디오)

### Backend

* Tauri
* FFmpeg

---

## 6. ⚙️ FFmpeg 역할

### 사용 기능

* 영상 자르기
* 인코딩
* 썸네일 생성

### 예시

```bash
ffmpeg -ss 00:00:10 -i input.mp4 -t 5 output.mp4
```

---

## 7. 🧠 핵심 설계 원칙

### 1. 상태 = Timeline 중심

* 모든 UI는 Timeline 상태 기반

### 2. Preview는 결과가 아니라 “참조”

* 실제 영상 수정 X
* 타임라인 기준으로 재생

### 3. FFmpeg는 마지막 단계

* 편집 → export 시 적용

---

## 8. 🚀 개발 단계

### Phase 1 (1~2주)

* 파일 import
* Asset panel
* 기본 video preview

---

### Phase 2 (2~3주)

* Timeline UI
* Clip 배치
* Drag & Drop

---

### Phase 3 (2주)

* Trim 기능
* Playback sync

---

### Phase 4 (2주)

* Export (FFmpeg)
* 간단 UI polish

---

## 9. ⚠️ 리스크 관리

### 문제 1: 성능

* 해결: virtualization (보이는 영역만 렌더링)

### 문제 2: 타임라인 복잡도

* 해결: Track 구조 단순 유지

### 문제 3: 프리뷰 지연

* 해결: low-res preview 전략

---

## 10. 🔥 확장 로드맵

* 키프레임 시스템
* 이펙트 레이어
* 멀티 트랙 오디오
* GPU 가속

---

## 11. ✅ 성공 기준

* 드래그로 클립 배치 가능
* Trim이 자연스럽게 동작
* 재생이 끊기지 않음
* Export 정상 동작

---

## 12. 🧩 핵심 한 줄

“타임라인 상태를 중심으로, UI는 조작만 담당하고 실제 영상 처리는 마지막에 한다”
