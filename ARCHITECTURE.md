# 아키텍처

## 1. 시스템 경계

이 애플리케이션은 WebView 안의 React 편집기와 Tauri의 Rust 프로세스로 나뉜다.

```text
사용자
  ↓
React route/shell/components
  ↓                 ↘
Zustand stores       Canvas/HTML media preview
  ↓
IPC wrapper (`src/lib/invoke.ts`)
  ↓
Tauri command (`src-tauri/src/commands`)
  ├─ 프로젝트 파일 시스템
  └─ FFmpeg/ffprobe sidecar → progress/done/error event → React
```

- React는 편집 상태와 인터랙션을 소유한다.
- Rust는 신뢰 경계 밖의 파일 접근과 네이티브 sidecar 실행을 소유한다.
- FFmpeg는 편집 중 상시 실행되지 않는다. 에셋 probe/thumbnail과 export 요청에서만 네이티브 처리가 일어난다.

## 2. 프론트엔드 계층

### 조립 계층

`src/main.tsx`가 theme/loader/router를 조립한다. `src/routes/__root.tsx`는 전역 shell과 project lifecycle/shortcut를, index/settings route는 각 화면 body를 lazy-load한다. `EditorLayout.tsx`는 asset, toolbar, preview, properties, timeline panel과 dnd-kit context를 배치한다.

route는 얇은 진입점으로 유지한다. 현재 FSD는 목표 상태일 뿐 아직 구현 구조가 아니므로 새 계층을 한 번에 강제하지 않는다.

### UI/상호작용 계층

- `AssetPanel`: Tauri drag event 및 browser file fallback, probe/thumbnail 요청.
- `TimelinePanel`: track/clip DnD, trim, layer, playhead/zoom.
- `PreviewPlayer`: hidden media element/cache와 Canvas 합성, playback sync, pointer 편집.
- `PropertiesPanel`/`ToolPanel`: 선택 clip과 tool에 따른 편집 명령 생성.
- `GlobalAppBar`: project lifecycle, history, export/settings 진입.

컴포넌트가 도메인 상태를 독자적으로 복제하지 않고 Zustand selector/action을 사용한다. transient UI state만 component/local hook이 소유한다.

### 도메인/상태 계층

`timelineStore.ts`의 `Track[]`와 `Clip`이 프리뷰·히스토리·직렬화·export의 공통 편집 모델이다. 각 store의 소유권은 다음과 같다.

| 소유자 | 책임 | 다른 계층이 하지 말아야 할 일 |
|---|---|---|
| timeline store | track/clip, canvas, selection, clock, 편집 액션 | 컴포넌트가 별도 canonical clip 배열 보유 |
| asset store | asset metadata/selection, blob URL lifecycle | timeline clip에 파일 metadata를 중복 복사 |
| project store | meta/path/dirty/recent, save/load IPC helper | timeline store가 파일 I/O 수행 |
| history store | timeline snapshot undo/redo | 매 pointer move마다 snapshot 생성 |
| settings store | theme | route가 별도 persistent theme 보유 |
| tool store | active tool/mode | panel마다 tool mode를 따로 관리 |

### adapter 계층

- `projectSerialization.ts`: store 상태를 `.vedproj` JSON `{ meta, tracks, assets }`로 투영한다.
- `exportPayload.ts`: 동일 모델을 Rust export DTO로 투영한다.
- `canvasCompositor.ts`: 동일 모델을 Canvas draw 입력으로 사용한다.
- `invoke.ts`: 웹 코드와 Tauri API의 단일 IPC/event 경계다.

프리뷰와 export가 별도 의미 체계를 만들지 않도록 clip timing, transform, opacity, visibility, playback rate의 변경은 이 세 투영 경로를 함께 검토한다.

## 3. 백엔드 계층

`src-tauri/src/lib.rs`가 plugin을 설치하고 command를 allowlist한다. command module은 세 도메인으로 나뉜다.

1. **asset**: 경로/확장자 확인, ffprobe metadata.
2. **project**: JSON 검증, 임시 파일 작성 후 rename, 파일 읽기.
3. **ffmpeg**: export plan/validation/filter graph/sidecar 실행, thumbnail.

공통 `AppError { code, message, details }`가 IPC 오류 계약이다. FFmpeg 장시간 작업은 command 반환만 기다리지 않고 `ffmpeg-progress`, `ffmpeg-done`, `ffmpeg-error` event를 보낸다.

## 4. 주요 데이터 흐름

### 에셋 임포트

```text
파일 drop/select
→ AssetPanel
→ [Tauri] asset_import → 기본 metadata
→ [Tauri] asset_probe(ffprobe) → duration/dimensions
→ [video/image] generate_thumbnail(FFmpeg)
→ assetStore
→ Timeline drag 시 timelineStore.addClip
```

브라우저 Vite 모드에서는 native path가 없으므로 File/`blob:` URL fallback을 쓰며, asset store가 제거/교체 시 blob URL을 revoke한다.

### 편집과 undo/dirty

```text
gesture 시작/확정
→ withHistory(label, action)
→ historyStore가 action 전 timeline snapshot 1회
→ timelineStore action
→ projectStore.markDirty()
→ Preview/Timeline/Properties가 selector로 갱신
```

연속 pointer gesture는 좌표 변화마다 history를 쌓지 않고 사용자 동작 단위로 한 번만 기록해야 한다. undo/redo 복원 후 duration과 dirty 정책은 `historyActions.ts` 계약을 따른다.

### 프리뷰/재생

`timelineStore.currentTime`이 편집 clock이다. `PreviewPlayer`는 현재 시간에 활성인 visible track clip을 구하고, media/text/shape를 z-order로 Canvas에 그린다. playback 중 hidden video를 매 tick seek하지 않고 clip 전환/스크럽/큰 drift에서만 보정한다. RAF와 media cache cleanup은 PreviewPlayer lifecycle이 소유한다.

### 프로젝트 저장/불러오기

```text
저장: stores → buildProjectJson → project_save → JSON 검사 → *.vedproj.tmp → rename
열기: project_load → projectStore meta → timelineStore.loadTracks + assetStore.loadAssets
      → history/selection/playback normalization
```

저장 스키마 변경 시 backward normalization, 상대/절대 미디어 경로 정책, Rust JSON 검증을 함께 검토한다.

### Export

```text
ExportDialog options + stores
→ exportPayload builder
→ tauriInvoke('ffmpeg_export')
→ Rust validation/probe/export plan/filter graph
→ FFmpeg sidecar
→ events(progress/done/error)
→ ExportDialog
```

command/event 이름과 DTO 필드, filter label/input index는 양쪽 계약이다. 프리뷰 변경은 `exportPayload.test.ts`와 Rust filter graph tests의 회귀 여부를 확인한다.

## 5. 지속성 및 생성물

- `.vedproj`: project meta, tracks/clips, assets.
- localStorage: recent projects, theme, zoom/snap, sticky panel dimensions.
- `dist/`, `src/routeTree.gen.ts`, Tauri schemas: 재생성 가능 산출물.
- `src-tauri/binaries/`: 플랫폼별 다운로드 sidecar, git 제외.
- Cargo target: 저장소가 외장 볼륨에 있으므로 내부 디스크 `CARGO_TARGET_DIR` 사용.

## 6. 변경 시 계약 체크

- clip/track 필드: timeline store → serializer → Canvas → export DTO/Rust tests.
- command: Rust handler 등록 → frontend wrapper call → capability/오류 타입.
- event: Rust 상수/emit → frontend listen/unlisten.
- route: `src/routes` → generated route tree(수동 수정 금지) → lazy boundary.
- sidecar: downloader → verifier → `tauri.conf.json externalBin` → release workflow.
- 구조/소유권: `PROJECT_MAP.md`, 이 문서, 필요 시 `TODO.md`/FSD migration 문서 동기화.
