# 🎬 Video Editor Master Plan (React + Tauri)

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
