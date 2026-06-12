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
- [x] Windows `git pull`용 `{env:HOME}` 캐시 추적 제거 및 개발 설정 보강
- [x] Codex 호환 지침 업데이트 — `AGENTS.md`에서 `.github` Copilot 지침·스킬을 수동 적용하도록 연결하고 code-review 절차를 현재 프로젝트 명령어로 보정

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

## Phase 4-b — 프로젝트 시스템

> 목표: 작업 단위인 "프로젝트"를 도입하여 캔버스 설정·타임라인·에셋 목록을 JSON으로 저장·불러오기

- [x] **데이터 모델** — `ProjectMeta` 타입 정의
  - 이름, 파일 경로, 캔버스 너비·높이, FPS, 생성일, 수정일
  - 프리셋: `1080p_16:9 / 4K_16:9 / 1080p_9:16 (세로) / 1:1 (정방형) / 커스텀`
- [x] **projectStore** — Zustand 프로젝트 상태 관리
  - `currentProject`, `isDirty` (미저장 변경 여부), `recentProjects`
  - `createProject(meta)`, `loadProject(path)`, `saveProject()`, `saveProjectAs(path)`
- [x] **프로젝트 파일 포맷** — `.vedproj` (JSON)
  - 직렬화 대상: `projectMeta`, `tracks` (Clip 전체), `assetList` (경로·메타)
  - 경로는 프로젝트 파일 기준 상대 경로로 저장
- [x] **Tauri 커맨드** — `project_save(path, json)`, `project_load(path) → json`
  - Rust: `src-tauri/src/commands/project.rs` 신규 작성
  - `AppError` 반환, `Result<String, AppError>`
- [x] **새 프로젝트 다이얼로그** — ResizableDialog
  - 프로젝트 이름 입력, 캔버스 프리셋 선택, 저장 위치 선택
- [x] **프로젝트 열기** — Tauri `open()` 다이얼로그 (`.vedproj` 필터)
- [x] **저장 / 다른 이름으로 저장** — Ctrl+S / Ctrl+Shift+S 단축키 연동
- [x] **미저장 경고** — `isDirty` 상태 기반 앱 종료·새 프로젝트 시 확인 (ResizableDialog)
- [x] **최근 프로젝트 목록** — localStorage 최대 10개 히스토리
- [x] **GlobalAppBar 파일 메뉴** — MUI Menu 드롭다운
  - 새 프로젝트 / 열기 / 저장 / 다른 이름으로 저장 / 최근 프로젝트 서브메뉴
- [x] **캔버스 설정 반영** — projectMeta의 width·height → CANVAS_WIDTH·HEIGHT 동기화
  - PreviewPlayer `<canvas>` 크기 및 aspect-ratio 연동
  - timelineStore·canvasCompositor에 전달
- [x] **타이틀 바 업데이트** — `[프로젝트명][*]` 표시 (미저장 시 `*`)

---

## Phase 4-c — Undo/Redo 히스토리 & 키보드 단축키

> 목표: 모든 편집 액션을 되돌리기·다시 실행 가능한 히스토리 스택으로 관리하고, 핵심 단축키를 전역 등록

### Undo/Redo 히스토리 시스템
- [x] **historyStore** — Zustand 기반 히스토리 스토어 (`src/store/historyStore.ts`)
  - 스냅샷 패턴: 각 편집 액션 전 `timelineStore` 상태 복사본을 스택에 push
  - `undoStack: TimelineSnapshot[]`, `redoStack: TimelineSnapshot[]`
  - 최대 스택 깊이: 50개 (초과 시 가장 오래된 항목 제거)
  - `pushSnapshot(label)` — 현재 타임라인 상태를 스냅샷으로 저장
  - `undo()` — undoStack에서 pop → timelineStore 상태 복원 → redoStack에 현재 상태 push
  - `redo()` — redoStack에서 pop → timelineStore 상태 복원 → undoStack에 현재 상태 push
  - `clearHistory()` — 프로젝트 열기·새 프로젝트 시 히스토리 초기화
- [x] **히스토리 연동 액션 래퍼** — `withHistory(label, action)` 유틸리티 함수
  - `addClip`, `moveClip`, `removeClip`, `splitClip`, `trimClipStart`, `trimClipEnd`
  - `addTextClip`, `addShapeClip`, `updateClipCanvas`, `updateTrackLayer`, `reorderTracks`
  - `ripplePushClips` (Magic Wand 삽입)
- [x] **Undo/Redo 버튼** — GlobalAppBar에 Undo(↩) / Redo(↪) 아이콘 버튼 추가
  - `undoStack.length === 0` 이면 Undo 버튼 비활성화
  - `redoStack.length === 0` 이면 Redo 버튼 비활성화
  - 툴팁에 마지막 액션 레이블 표시 (예: "실행 취소: 클립 이동")
- [ ] **히스토리 패널 (선택)** — 우측 PropertiesPanel 내 탭 형태로 히스토리 목록 표시
  - 액션 이름·아이콘 목록, 클릭으로 특정 지점으로 이동 (고급)

### 키보드 단축키 전역 등록
- [x] **useGlobalShortcuts 훅** — `src/lib/useGlobalShortcuts.ts`
  - `__root.tsx`에서 마운트 (전역 적용)
  - 단축키 목록:
    | 단축키 | 동작 |
    |---|---|
    | `Ctrl+Z` | Undo |
    | `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
    | `Ctrl+S` | 프로젝트 저장 |
    | `Ctrl+Shift+S` | 다른 이름으로 저장 |
    | `Ctrl+N` | 새 프로젝트 |
    | `Ctrl+O` | 프로젝트 열기 |
    | `Space` | 재생/일시정지 토글 |
    | `Delete` / `Backspace` | 선택된 클립 삭제 |
    | `V` | Select 도구 |
    | `T` | Text 도구 |
    | `R` | Rectangle 도구 |
    | `C` | Circle 도구 |
    | `A` | Arrow 도구 |
    | `X` | Crop 도구 |
    | `S` | Razor 도구 |
    | `Ctrl+D` | 선택 클립 복제 |
    | `[` / `]` | 플레이헤드 이전/다음 클립 경계로 이동 |
    | `,` / `.` | 프레임 단위 이전/다음 이동 |

---

## Phase 5 — Canvas 기반 합성 프리뷰 (Canvas Compositor)

> 목표: HTML5 Canvas 위에 비디오·이미지·텍스트·도형을 레이어로 합성하여 실시간 프리뷰

- [x] **데이터 모델** — `Clip`에 캔버스 변환 속성 추가 (`x, y, width, height, rotation, opacity`)
- [x] **데이터 모델** — `Track`에 레이어 속성 추가 (`visible, locked, opacity, zIndex`)
- [x] **데이터 모델** — `TextClip` 타입 정의 (`TextProps`: text, fontFamily, fontSize, color, bold, italic, align, shadow, outline)
- [x] **데이터 모델** — `ShapeClip` 타입 정의 (`ShapeProps`: shapeType: rect|circle|arrow, fill, stroke, strokeWidth, dash, cornerRadius)
- [x] **CanvasCompositor** — PreviewPlayer를 Canvas 기반으로 재설계
  - `<canvas>` 위에 프레임마다 레이어 순서(zIndex)대로 drawImage/fillText/drawShape
  - 비디오 프레임: offscreen `<video>` → `ctx.drawImage(video, x, y, w, h)`
  - 이미지: `ctx.drawImage(img, ...)`
  - 텍스트: `ctx.fillText(...)` with transform
  - 도형: path-based drawing
- [x] **Canvas 선택 인터랙션** — 클릭으로 오브젝트 선택 (hit testing)
- [x] **Transform Handles** — 선택된 오브젝트의 8방향 리사이즈 핸들 + 회전 핸들 표시
- [x] **에셋 크기 맞춤 모드** — 프로젝트 캔버스 크기와 클립 원본 크기가 다를 때 배치 정책
  - `fit`    — 비율 유지, 캔버스 안에 맞춤 (레터박스/필러박스)
  - `fill`   — 비율 유지, 캔버스 꽉 채움 (초과 부분 crop)
  - `stretch`— 비율 무시, 캔버스 크기에 맞게 늘리기
  - `center` — 원본 크기 그대로 중앙 배치 (초과 시 클리핑)
  - `crop`   — 사용자가 직접 `cropRect` 지정 (Crop 도구 연동)
  - `Clip` 에 `fitMode: 'fit' | 'fill' | 'stretch' | 'center' | 'crop'` 속성 추가
  - 클립 우클릭 컨텍스트 메뉴 또는 속성 패널에서 변경 가능
- [x] **fitMode → FFmpeg Export 연동** — fit/fill/stretch를 `scale` + `pad`/`crop` 필터로 변환
- [x] **초기 미디어 캔버스 배치 수정** — 에셋을 비디오 라인에 놓으면 클립 프레임을 캔버스 전체(`x=0`, `y=0`, `W/H=canvas`)로 배치하고 `fit`은 내부 소스 맞춤만 담당
- [x] **프리뷰 캔버스 크기 UI** — 속성 패널에서 출력 캔버스 W/H 조절, 프리뷰 오버레이에서 표시 배율(`맞춤`, `25%`~`150%`) 조절
- [x] **Canvas 비디오 실시간 재생 수정** — 재생 중 매 프레임 seek를 중단하고 정지/스크럽·클립 전환·큰 드리프트에서만 video currentTime 보정

---

## Phase 6 — 도구 패널 (ToolPanel)

> 목표: 별도 도구 선택 창에서 오브젝트/도구를 골라 캔버스에 추가·편집

- [x] **toolStore** — 현재 활성 도구 상태 관리 (`select | text | rect | circle | arrow | crop | razor`)
- [x] **ToolPanel** — 도구 선택 UI (세로 아이콘 툴바, 캔버스 왼쪽 배치)
- [x] **PropertiesPanel** — 우측 속성 사이드바 컴포넌트 (`src/components/properties/PropertiesPanel.tsx`)
  - [x] EditorLayout 우측에 배치 (기본 너비 240px, LayoutResizer로 리사이즈)
  - [x] `useStickyState`로 패널 너비 영구 저장
  - [x] 열기/닫기 토글 버튼 (GlobalAppBar 또는 오른쪽 엣지)
- [x] **PropertiesPanel — 도구별 옵션 패널** — 활성 도구에 따라 동적으로 내용 변경 (기본 UI 구현)
  - **공통 클립 속성** (Select 도구 + 클립 선택 시)
    - 위치 `x, y` 수치 입력 (px)
    - 크기 `width, height` 수치 입력 + 비율 잠금 아이콘
    - 회전 `rotation` 슬라이더 (-180° ~ 180°) + 수치 입력
    - 불투명도 `opacity` 슬라이더 (0~100%)
    - `fitMode` 선택 (fit / fill / stretch / center / crop 라디오 버튼)
    - 클립 시작 시각 / 지속 시간 수치 표시
  - **Text 도구 옵션**
    - 폰트 패밀리 선택 (시스템 폰트 목록)
    - 폰트 크기 슬라이더 + 수치 입력
    - 텍스트 색상 (MUI 색상 입력 또는 커스텀 ColorSwatch)
    - Bold / Italic / Underline 토글 버튼
    - 정렬 (left / center / right)
    - 그림자 토글 + 오프셋·블러·색상 세부 설정
    - 아웃라인 토글 + 두께·색상
  - **Rect 도구 옵션**
    - 채우기 색 + 불투명도
    - 선 색 + 두께 + 대시 패턴
    - 모서리 반지름 슬라이더
  - **Circle 도구 옵션**
    - 채우기 색 + 불투명도
    - 선 색 + 두께
  - **Arrow 도구 옵션**
    - 선 색 + 두께
    - 화살촉 스타일 (filled / open / none)
    - 선 스타일 (solid / dashed)
  - **Crop 도구 옵션**
    - cropRect 수치 입력 (x, y, w, h)
    - 비율 잠금 토글
    - 프리셋 비율 버튼 (16:9 / 9:16 / 1:1 / 4:3 / 자유)
    - 재설정(Reset) 버튼
  - **Razor 도구 안내**
    - 현재 플레이헤드 위치 표시
    - "클립을 클릭하면 현재 위치에서 분할됩니다" 안내 텍스트
- [x] **Select 도구** — Canvas 오브젝트 클릭 선택 + 이동(드래그) + Transform Handles
- [x] **Text 도구** — Canvas 클릭 → TextClip 생성 + 인라인 텍스트 에디터 팝업
- [x] **Rectangle 도구** — Canvas 드래그로 ShapeClip(rect) 생성
- [x] **Circle 도구** — Canvas 드래그로 ShapeClip(circle) 생성
- [x] **Arrow 도구** — Canvas 드래그로 ShapeClip(arrow) 생성
- [x] **Crop 도구** — 비디오 클립의 표시 영역 자르기 (cropRect 속성)
- [x] **Razor 도구** — 클립을 플레이헤드 위치에서 분할 (splitClip 액션)

---

## Phase 7 — 텍스트 & 도형 렌더링

- [x] **TextClip Canvas 렌더링** — fontFamily, fontSize, color, bold, italic, shadow, outline
- [x] **ShapeClip Canvas 렌더링** — fill, stroke, strokeWidth, opacity, dash pattern
- [x] **텍스트 편집 팝업** — 더블클릭 → ResizableDialog 인라인 에디터
- [x] **폰트 선택** — Google Fonts 또는 시스템 폰트 목록 조회
- [x] **색상 피커** — MUI Color Picker 통합
- [x] **도형 속성 패널** — 선택된 ShapeClip의 속성 편집 (채우기/선 색, 두께 등)

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
- [ ] **Timeline Magic Wand (자동 삽입)** — 기준 트랙 위에 다른 클립을 삽입할 때 기준 영상이 자동 조정되는 스마트 삽입 기능
  - **삽입 모드 선택** — 타임라인 드롭 시 `overlay` vs `insert` 모드 선택 UI (드롭 미니 팝오버)
  - **insert 모드 동작**:
    1. 삽입 지점에서 기준 트랙 클립을 `splitClip()`으로 자동 분할
    2. 삽입 클립 duration만큼 분할된 후반부 클립을 뒤로 이동 (ripple push)
    3. 삽입 클립을 해당 위치에 배치
    4. 결과: 기준 영상이 삽입 구간만큼 일시정지 후 삽입 영상 재생 → 다시 기준 영상 재생
  - **Ripple Push** — 특정 시간 이후의 클립 전체를 지정 delta만큼 일괄 이동 (`ripplePushClips(time, delta)` 액션)
  - **Magic Wand 버튼** — ToolPanel 또는 타임라인 툴바에 Magic Wand 토글 버튼 추가
    - 활성화 시 드롭 기본 동작이 insert 모드로 변경
  - **되돌리기 지원** — undo/redo 스택과 연동 필요
- [ ] **재생 속도 조절** — 클립 속성에 `playbackRate` 추가 (0.25×~4×)
- [ ] **페이드 인/아웃** — 클립 시작/끝 불투명도 키프레임 (fade handle)
- [ ] **비디오 크롭** — displayRect로 보여줄 영역 지정 (클립 내부 뷰포트)
- [ ] **키프레임 애니메이션** — 위치·크기·불투명도에 키프레임 추가 (고급)

---

## Phase 10 — FFmpeg Export 고도화

- [ ] **Export Payload 재설계** — 단순 clips 배열 대신 `projectMeta + tracks + assets` 전체 타임라인 모델을 Rust로 전달
- [ ] **타임라인 위치/갭 Export 반영** — clip `start`, 빈 구간, overlap 정책을 FFmpeg filter graph에 반영
- [ ] **오버레이 합성 Export** — overlay 트랙 이미지/비디오를 FFmpeg overlay 필터로 합성
- [ ] **텍스트 Export** — FFmpeg `drawtext` 필터로 텍스트 번인(burn-in)
- [ ] **도형 Export** — FFmpeg `drawbox`/`geq` 필터 또는 GIF 오버레이
- [ ] **트랙 가시성 Export** — visible=false 트랙 제외
- [ ] **오디오 믹싱** — 다중 오디오 트랙 `amix` 필터
- [ ] **무음/오디오 없는 소스 Export 대응** — 비디오/이미지 입력에 오디오 스트림이 없을 때 `anullsrc` fallback 또는 무음 export 경로 구현
- [ ] **해상도·프레임레이트 설정** — Export 옵션 UI 추가
- [ ] **프리뷰-Export 일치성 테스트** — 대표 프로젝트 fixture로 Canvas Preview 모델과 Export 결과가 같은지 회귀 검증

---

## 리뷰 기반 개선 백로그

- [x] **프로젝트 lifecycle 1차 안정화** — 새 프로젝트 생성 시 timeline/assets/history 초기화, 프로젝트 로드 시 duration/선택/history 재설정
- [x] **dirty 1차 연결** — `withHistory()` 기반 편집 액션 후 `isDirty` 설정
- [x] **타임라인 duration 재계산 누락 수정** — trim/split 후 `duration` 재계산
- [x] **FFmpeg/ffprobe 실패 상태 확인** — 썸네일 생성/metadata probe에서 non-zero exit 에러 처리
- [x] **프로젝트 저장 안정화 1차** — JSON 검증 후 임시 파일 write + rename 방식 저장
- [ ] **Dirty/Undo 적용 범위 완성** — Canvas 드래그, PropertiesPanel 입력, ToolPanel 액션 전체를 `withHistory()`로 통합
- [ ] **Undo/Redo 후 dirty 정책 정리** — undo/redo 실행 후 저장 필요 상태와 저장 직후 history 정책 결정
- [x] **브라우저 개발 모드 Tauri guard** — Vite 브라우저 실행 시 `window.__TAURI__` 부재를 명확히 처리하고 IPC 버튼을 mock/disable
- [x] **브라우저 검증 fallback 지침화** — Codex 인앱 브라우저 실패 시 Playwright MCP로 `127.0.0.1:1420` 재시도
- [x] **브라우저 AssetPanel 파일 추가 fallback** — Vite 웹 환경에서 native file drop/input으로 `blob:` URL 에셋을 생성하고 프리뷰 URL 변환을 우회
- [x] **fitMode 동일 비율 안내** — 원본 소스와 클립 프레임 비율이 같아 맞춤 모드 차이가 보이지 않는 경우 속성 패널에서 안내
- [x] **프리뷰 fit 계산 기준 수정** — 브라우저 videoWidth 불일치보다 ffprobe 에셋 W/H를 우선해 전체 영상 영역이 보이도록 보정
- [x] **프리뷰 고정 배율 전체 보기 보장** — 100% 같은 표시 배율이 뷰포트보다 크면 자동 축소해 캔버스 일부만 보이는 스크롤 상태 방지
- [x] **검증용 비디오 전체 캔버스 고정 렌더** — fitMode를 우회하고 비디오 프레임을 `0,0,canvasWidth,canvasHeight`에 직접 그려 표시 확인
- [ ] **Tauri 보안 범위 축소** — `csp: null`, `assetProtocol.scope: ["**"]`, shell/fs 권한을 필요한 범위로 제한
- [ ] **미디어 캐시/RAF 정리** — 에셋 삭제·프로젝트 로드·언마운트 시 video/image cache 해제 및 비재생 시 redraw 최적화
- [x] **도구별 Canvas 편집 완성** — Text/Shape/Crop/Razor 도구를 실제 clip 생성·수정·분할 액션에 연결
- [ ] **번들 코드 스플리팅** — Vite build의 500kB+ 청크 경고 해소를 위해 route/dialog/vendor chunk 분리
- [ ] **FFmpeg sidecar 배포 검증** — macOS arm64/x64, Windows, Linux별 sidecar 파일명/서명/번들 검증

---

## 기술 부채 / 보완 사항

- [ ] `asset.rs` — `uuid_v4()` naive 구현 → `uuid` crate로 교체
- [ ] `.env` 로드 — Rust에서 `dotenv` 또는 빌드 타임 주입 방식 결정
- [x] `src-tauri/icons/` — 실제 앱 아이콘으로 교체 (클래퍼보드 디자인 생성 완료)
- [x] **Canvas 성능** — Phase 5에서 Canvas Compositor 구현 시 처리
- [x] **undo/redo** — Phase 4-c로 이관 (상세 항목 참조)
- [x] **키보드 단축키** — Phase 4-c로 이관 (상세 항목 참조)
- [x] **프로젝트 저장/불러오기** — Phase 4-b로 이관 (상세 항목 참조)
- [x] **macOS AppleDouble 메타데이터 방어** — `._*` 파일이 Biome/Vitest 검증에 섞이지 않도록 ignore 설정 추가
- [x] **VS Code 디버깅 preLaunchTask 안정화** — Vite 1420 포트가 이미 사용 중이어도 `start-vite-dev-server`가 실패하지 않도록 idempotent helper 추가
- [x] **크로스플랫폼 디버깅 지침화** — macOS/Windows 공통 Vite helper, 127.0.0.1 devUrl 규칙, 플랫폼별 cleanup 절차를 스크립트와 문서에 명시
- [x] **미저장 종료 경고 수정** — 창 닫기 시 `저장하지 않고 종료`가 재차 close guard에 막히지 않도록 우회 플래그와 상황별 버튼 라벨 적용
- [x] **창 크기·위치 복원** — `tauri-plugin-window-state`로 앱 종료/재시작 간 메인 창 bounds 저장
- [ ] **외장 볼륨 Cargo target 보완** — Tauri permission 생성 중 `._default.toml`이 생기는 환경에서는 `CARGO_TARGET_DIR`를 로컬 디스크로 지정하는 검증 스크립트/문서화 필요
- [ ] `.github/prompts/` — `new-route.prompt.md`, `new-command.prompt.md` 내용 검토
