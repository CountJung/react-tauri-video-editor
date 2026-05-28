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

- [ ] **Export UI** — 출력 경로 선택 다이얼로그 (ResizableDialog)
- [ ] **Export** — `ffmpeg_export` Tauri 커맨드 호출
- [ ] **Export** — 진행률 이벤트 수신 (`ffmpeg-progress`) 및 UI 표시
- [ ] **Export** — 완료/오류 처리 (`ffmpeg-done`, `ffmpeg-error`)
- [ ] **FFmpeg 바이너리** — Windows/macOS/Linux 플랫폼별 다운로드 스크립트 작성

---

## 기술 부채 / 보완 사항

- [ ] `asset.rs` — `uuid_v4()` naive 구현 → `uuid` crate로 교체
- [ ] `.env` 로드 — Rust에서 `dotenv` 또는 빌드 타임 주입 방식 결정
- [ ] `tauri.conf.json` — `externalBin`에 FFmpeg 바이너리 경로 추가
- [ ] `src-tauri/icons/` — 실제 앱 아이콘으로 교체 (현재 placeholder)
- [ ] `.github/prompts/` — `new-route.prompt.md`, `new-command.prompt.md` 내용 검토
