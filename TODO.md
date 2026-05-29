# Video Editor — 작업 목록

> MasterPlan.md의 개발 단계를 기준으로 작업 진행 상황을 추적합니다.

---

## 초기 설정 (완료)

- [x] MasterPlan 작성
- [x] AGENTS.md 작성 (루트)
- [x] `.github/copilot-instructions.md` 비디오 에디터 맞게 전면 재작성
- [x] `backend.instructions.md` — FFmpeg/파일시스템 지침으로 업데이트
- [x] `ui.instructions.md` — Timeline/Preview 지침으로 업데이트
- [x] `charts.instructions.md` → Timeline 컴포넌트 지침으로 전환
- [x] `tables.instructions.md` → Asset 패널 지침으로 전환
- [x] `docs.instructions.md` 업데이트
- [x] 불필요한 스킬 삭제 (charts-architecture, ui-table-patterns 등 7개)
- [x] `tauri-backend` SKILL.md 전면 재작성
- [x] `timeline-editor` SKILL.md 신규 작성
- [x] `ffmpeg-integration` SKILL.md 신규 작성
- [x] 프로젝트 스캐폴딩 — 프론트엔드 파일 생성
- [x] 프로젝트 스캐폴딩 — Rust(Tauri) 백엔드 파일 생성
- [x] `pnpm install` 완료
- [x] `cargo check` 통과 (tauri::Emitter import 추가)
- [x] 아이콘 파일 생성 (`src-tauri/icons/`)
- [x] `src/routeTree.gen.ts` 생성 (TanStack Router)
- [x] `pnpm typecheck` 오류 0
- [x] `pnpm fix` (Biome) 오류 0
- [x] `.gitignore` 정비

---

## Phase 1 — 파일 임포트 & Asset Panel & 기본 Preview

- [x] **AssetPanel** — 파일 드롭존 구현 (드래그앤드롭으로 파일 추가)
- [x] **AssetPanel** — `asset_import` Tauri 커맨드 연동
- [x] **AssetPanel** — `asset_probe` (ffprobe) 메타데이터 조회 연동
- [x] **AssetPanel** — 썸네일 생성 (`generate_thumbnail`) 연동
- [x] **AssetPanel** — 에셋 목록 UI (썸네일 + 파일명 + 길이 표시)
- [x] **PreviewPlayer** — HTML5 video 소스 연결 (선택된 에셋 재생)
- [x] **PreviewPlayer** — 재생/일시정지/시크 컨트롤 구현
- [x] **PreviewPlayer** — WaveSurfer.js 오디오 파형 표시

---

## Phase 2 — Timeline UI & Clip 배치 & DnD

- [x] **AppLoader** — HTML 스플래시 (`index.html`) + React 부트 진행 화면 (`AppLoader.tsx`)
- [x] **TimelinePanel** — 눈금자(Ruler) 정밀 구현 (zoom 연동, 적응형 tick 간격)
- [x] **TimelinePanel** — 트랙 레이아웃 (비디오/오디오 구분, sticky 레이블)
- [x] **TimelinePanel** — Asset → Timeline 드래그앤드롭 (`addClip`)
- [x] **TimelinePanel** — Clip 이동 (`moveClip`, dnd-kit)
- [x] **TimelinePanel** — 줌 (Ctrl+Wheel / 툴바 버튼, `setZoom`)
- [x] **TimelinePanel** — 수평 스크롤
- [x] **TimelinePanel** — 플레이헤드 클릭 seek (`setCurrentTime`, snap 적용)
- [x] **TimelinePanel** — Snap to grid 동작 확인
- [x] **EditorLayout** — DndContext / DragOverlay 통합
- [x] **AssetPanel** — `useDraggable` DraggableAssetItem 구현

---

## Phase 3 — Trim & Playback Sync

- [x] **Clip Trim** — 좌우 핸들 드래그로 trimStart/trimEnd 조정
- [x] **Clip Trim** — 최소 duration 제한 (0.1초)
- [x] **PreviewPlayer** — currentTime ↔ 타임라인 플레이헤드 동기화 (ruler 클릭 → 비디오 seek)
- [x] **PreviewPlayer** — 재생 시 플레이헤드 자동 이동 (timeupdate → setCurrentTime)
- [x] **TimelinePanel** — Clip 겹침 방지 (resolveCollisions)

---

## Phase 3-b — 레이아웃 리사이저 & 설정

- [x] **LayoutResizer** — 드래그로 패널 크기 조절 (좌우 에셋 패널, 상하 프리뷰/타임라인)
- [x] **useStickyState** — localStorage 연동 패널 크기 영구 저장
- [x] **settingsStore** — 앱 설정 Zustand 스토어 (themeMode)
- [x] **.env** — `VITE_THEME_MODE`, `VITE_DEFAULT_ZOOM`, `VITE_SNAP_INTERVAL` 기본값
- [x] **AppThemeProvider** — settingsStore 기반 동적 MUI 테마 (dark/light/system)
- [x] **GlobalAppBar** — `__root.tsx`에 앱 바 추가 (설정 아이콘, 뒤로가기)
- [x] **/settings 라우트** — 테마 모드 선택, 줌 슬라이더, 스냅 간격 선택
- [x] **파일 드래그 버그 수정** — Tauri 2.x `tauri://drag-drop` 이벤트명 및 payload 형식 수정

---

## Phase 4 — Export (FFmpeg)

- [x] **Export UI** — 출력 경로 선택 다이얼로그 (ResizableDialog)
- [x] **Export** — `ffmpeg_export` Tauri 커맨드 호출
- [x] **Export** — 진행률 이벤트 수신 (`ffmpeg-progress`) 및 UI 표시
- [x] **Export** — 완료/오류 처리 (`ffmpeg-done`, `ffmpeg-error`)
- [x] **FFmpeg 바이너리** — Windows/macOS/Linux 플랫폼별 다운로드 스크립트 작성

---

## Phase 5 — Canvas 기반 합성 프리뷰 (Canvas Compositor)

> 목표: HTML5 Canvas 위에 비디오·이미지·텍스트·도형을 레이어로 합성하여 실시간 프리뷰

- [ ] **데이터 모델** — `Clip`에 캔버스 변환 속성 추가 (`x, y, width, height, rotation, opacity, scaleX, scaleY`)
- [ ] **데이터 모델** — `Track`에 레이어 속성 추가 (`visible, locked, opacity, zIndex`)
- [ ] **데이터 모델** — `TextClip` 타입 정의 (text, fontFamily, fontSize, color, bold, italic, align)
- [ ] **데이터 모델** — `ShapeClip` 타입 정의 (shapeType: rect|circle|arrow, fill, stroke, strokeWidth)
- [ ] **CanvasCompositor** — PreviewPlayer를 Canvas 기반으로 재설계
  - `<canvas>` 위에 프레임마다 레이어 순서(zIndex)대로 drawImage/fillText/drawShape
  - 비디오 프레임: offscreen `<video>` → `ctx.drawImage(video, x, y, w, h)`
  - 이미지: `ctx.drawImage(img, ...)`
  - 텍스트: `ctx.fillText(...)` with transform
  - 도형: path-based drawing
- [ ] **Canvas 선택 인터랙션** — 클릭으로 오브젝트 선택 (hit testing)
- [ ] **Transform Handles** — 선택된 오브젝트의 8방향 리사이즈 핸들 + 회전 핸들 표시

---

## Phase 6 — 도구 패널 (ToolPanel)

> 목표: 별도 도구 선택 창에서 오브젝트/도구를 골라 캔버스에 추가·편집

- [x] **toolStore** — 현재 활성 도구 상태 관리 (`select | text | rect | circle | arrow | crop | razor`)
- [x] **ToolPanel** — 도구 선택 UI (세로 아이콘 툴바, 캔버스 왼쪽 배치)
- [ ] **Select 도구** — Canvas 오브젝트 클릭 선택 + 이동(드래그) + Transform Handles
- [ ] **Text 도구** — Canvas 클릭 → TextClip 생성 + 인라인 텍스트 에디터 팝업
- [ ] **Rectangle 도구** — Canvas 드래그로 ShapeClip(rect) 생성
- [ ] **Circle 도구** — Canvas 드래그로 ShapeClip(circle) 생성
- [ ] **Arrow 도구** — Canvas 드래그로 ShapeClip(arrow) 생성
- [ ] **Crop 도구** — 비디오 클립의 표시 영역 자르기 (cropRect 속성)
- [ ] **Razor 도구** — 클립을 플레이헤드 위치에서 분할 (splitClip 액션)

---

## Phase 7 — 텍스트 & 도형 렌더링

- [ ] **TextClip Canvas 렌더링** — fontFamily, fontSize, color, bold, italic, shadow, outline
- [ ] **ShapeClip Canvas 렌더링** — fill, stroke, strokeWidth, opacity, dash pattern
- [ ] **텍스트 편집 팝업** — 더블클릭 → ResizableDialog 인라인 에디터
- [ ] **폰트 선택** — Google Fonts 또는 시스템 폰트 목록 조회
- [ ] **색상 피커** — MUI Color Picker 통합
- [ ] **도형 속성 패널** — 선택된 ShapeClip의 속성 편집 (채우기/선 색, 두께 등)

---

## Phase 8 — 레이어 관리 패널

> 목표: 트랙을 레이어처럼 시각화하여 가시성·잠금·불투명도·순서 제어

- [ ] **LayerPanel** — 트랙 목록을 레이어 패널로 표시 (타임라인 왼쪽 레이블 영역 확장)
- [ ] **가시성 토글** — 눈 아이콘(👁) 클릭으로 트랙 숨기기/보이기 (`track.visible`)
- [ ] **잠금 토글** — 자물쇠 아이콘으로 트랙 편집 잠금 (`track.locked`)
- [ ] **트랙 불투명도** — 슬라이더로 트랙 전체 불투명도 조절 (`track.opacity`)
- [ ] **Z-order 변경** — 드래그로 트랙 순서(레이어 순서) 변경 (`reorderTrack`)
- [ ] **트랙 그룹화** — 여러 트랙을 그룹으로 묶어 일괄 제어

---

## Phase 9 — 고급 편집 기능

- [ ] **클립 분할 (Razor)** — 플레이헤드 위치에서 클립을 두 개로 분리 (`splitClip`)
- [ ] **갭 제거** — 클립 삭제 후 이후 클립들을 앞으로 당기기 (`deleteGap`)
- [ ] **재생 속도 조절** — 클립 속성에 `playbackRate` 추가 (0.25×~4×)
- [ ] **페이드 인/아웃** — 클립 시작/끝 불투명도 키프레임 (fade handle)
- [ ] **비디오 크롭** — displayRect로 보여줄 영역 지정 (클립 내부 뷰포트)
- [ ] **키프레임 애니메이션** — 위치·크기·불투명도에 키프레임 추가 (고급)

---

## Phase 10 — FFmpeg Export 고도화

- [ ] **오버레이 합성 Export** — overlay 트랙 이미지/비디오를 FFmpeg overlay 필터로 합성
- [ ] **텍스트 Export** — FFmpeg `drawtext` 필터로 텍스트 번인(burn-in)
- [ ] **도형 Export** — FFmpeg `drawbox`/`geq` 필터 또는 GIF 오버레이
- [ ] **트랙 가시성 Export** — visible=false 트랙 제외
- [ ] **오디오 믹싱** — 다중 오디오 트랙 `amix` 필터
- [ ] **해상도·프레임레이트 설정** — Export 옵션 UI 추가

---

## 기술 부채 / 보완 사항

- [ ] `asset.rs` — `uuid_v4()` naive 구현 → `uuid` crate로 교체
- [ ] `.env` 로드 — Rust에서 `dotenv` 또는 빌드 타임 주입 방식 결정
- [x] `src-tauri/icons/` — 실제 앱 아이콘으로 교체 (클래퍼보드 디자인 생성 완료)
- [ ] **Canvas 성능** — `requestAnimationFrame` 렌더 루프 최적화, offscreen canvas 활용
- [ ] **undo/redo** — Zustand immer 미들웨어로 히스토리 스택 구현
- [ ] **키보드 단축키** — Space(재생), J/K/L(속도), Ctrl+Z(실행 취소), Delete(클립 삭제) 등
- [ ] **프로젝트 저장/불러오기** — 타임라인 상태 JSON 직렬화 → 파일 저장
- [ ] `.github/prompts/` — `new-route.prompt.md`, `new-command.prompt.md` 내용 검토
