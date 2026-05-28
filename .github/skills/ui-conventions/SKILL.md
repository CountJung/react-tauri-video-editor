---
name: ui-conventions
description: UI 레이아웃, 역할 색상, useStickyState 상태 보존, DIAG 진단 로깅, Context Provider 계층, LayoutResizer 분할 레이아웃, 레이아웃 너비 규칙, ResizableDialog 팝업. Keywords: layout, role, color, useStickyState, diag, logging, logDiag, LayoutResizer, Container, AuthContext, SnackbarProvider, maxWidth, ResizableDialog, dialog, popup, confirm, window.confirm, GlobalAppBar
---
# UI Conventions Skill

---

## ⚠️ 팝업 다이얼로그 — ResizableDialog 절대 필수

**모든 팝업(Dialog)은 반드시 `ResizableDialog`를 사용한다. MUI `Dialog` 직접 사용 금지.**

- 경로: `src/components/ResizableDialog.tsx`
- 드래그(제목바) + 8방향 리사이즈 지원, `storageKey`로 크기/위치 세션 유지
- `dialogTitle` 생략 시 AppBar 없이 children만 렌더

```tsx
import { ResizableDialog } from "../../components/ResizableDialog";

<ResizableDialog
  open={open}
  onClose={onClose}
  dialogTitle="다이얼로그 제목"
  defaultWidth={600}
  defaultHeight={400}
  minWidth={360}
  minHeight={240}
  storageKey="unique-dialog-key"
>
  <DialogContent>...</DialogContent>
  <DialogActions>...</DialogActions>
</ResizableDialog>
```

### 비모달 다중 팝업 (hideBackdrop) 패턴

동시에 여러 창을 독립적으로 열어야 할 때 `hideBackdrop` 사용:

```tsx
<ResizableDialog
  open={open}
  onClose={onClose}
  dialogTitle="룰 상세"
  defaultWidth={900}
  defaultHeight={600}
  hideBackdrop   // ← backdrop 없이 비모달 동작
  // storageKey 지정 가능하나, hideBackdrop 모드에서는
  // 열릴 때마다 cascade 위치로 초기화됨 (위치 캐시 복원 안 함)
  // 여러 인스턴스가 같은 storageKey를 공유해도 겹치지 않음
>
  ...
</ResizableDialog>
```

- 창 클릭 시 자동으로 앞으로 가져오기(z-index 갱신)
- 드래그·리사이즈 독립 동작 (소유권 가드로 동시 이동 방지)
- 내부 구현은 MUI Modal 스택과 분리된 전용 Portal 레이어를 사용해 기존 상세창 뒤로 숨지 않음
- React Portal 이벤트는 컴포넌트 트리 기준으로 부모까지 버블링될 수 있으므로, 비모달 다중 팝업의 Paper/AppBar mousedown은 반드시 전파를 차단해 드래그 owner가 이전 창으로 덮이지 않게 한다
- 다중 팝업 문제 분석 시 `ResizableDialog`의 `[DIAG]` 프론트엔드 로그를 활용해 어떤 창이 `paper mouse down`, `drag start`, `drag owner released`를 기록했는지 확인한다
- `hideBackdrop=true` 창에는 `storageKey`를 통한 위치 복원이 적용되지 않음
  → 여러 인스턴스를 동시에 열어도 항상 계단식(cascade) 위치로 열림

### confirm 다이얼로그 패턴 — `window.confirm` 사용 절대 금지

Tauri WebView에서 `window.confirm()`은 즉시 `false` 반환. 반드시 아래 state 패턴 사용:

```tsx
// State 선언
const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean; title: string; message: string;
  confirmLabel?: string;
  confirmColor?: "error" | "warning" | "primary";
  onConfirm: () => Promise<void>;
} | null>(null);
const [confirmLoading, setConfirmLoading] = useState(false);

// 트리거 — 반드시 동기 함수 (async 금지, 실제 작업은 onConfirm 안에서)
function handleDelete(id: string) {
  setConfirmDialog({
    open: true,
    title: "삭제 확인",
    message: `항목 ${id}을(를) 삭제하시겠습니까?`,
    confirmLabel: "삭제",
    confirmColor: "error",
    onConfirm: async () => {
      await tauriInvoke("item_delete", { id });
      await loadData();
    },
  });
}

// 렌더 — JSX
{confirmDialog && (
  <ResizableDialog
    open={confirmDialog.open}
    onClose={() => setConfirmDialog(null)}
    dialogTitle={confirmDialog.title}
    defaultWidth={420}
    defaultHeight={220}
    minWidth={320}
    minHeight={160}
    storageKey="confirm-dialog"
  >
    <DialogContent>
      <Typography>{confirmDialog.message}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setConfirmDialog(null)}>취소</Button>
      <Button
        variant="contained"
        color={confirmDialog.confirmColor ?? "primary"}
        disabled={confirmLoading}
        onClick={async () => {
          setConfirmLoading(true);
          try { await confirmDialog.onConfirm(); }
          catch (e) { showSnack(toAppError(e).message, "error"); }
          finally { setConfirmLoading(false); setConfirmDialog(null); }
        }}
      >
        {confirmLoading ? <CircularProgress size={18} /> : (confirmDialog.confirmLabel ?? "확인")}
      </Button>
    </DialogActions>
  </ResizableDialog>
)}
```

---

## Context Provider 계층 (`src/routes/__root.tsx`)

```
ThemeContextProvider
  └─ SnackbarProvider
       └─ AuthProvider          ← tauriInvoke("auth_login") + tauriListen("mmc_message")
            └─ AppLayout        ← Holy Grail 레이아웃 + LayoutResizer
                 └─ <Outlet />
```

---

## 라우팅 — TanStack Router 파일 기반

- `src/routes/` 파일 = URL 매핑 (예: `routes/mmc/batchjob.tsx` → `/mmc/batchjob`)
- `src/routeTree.gen.ts` 자동 생성 → **수동 편집 금지**
- `pnpm dev:vite`/`pnpm dev` 실행 시 자동 재생성

---

## 역할 색상 (Role Colors)

`src/context/AuthContext.tsx`의 `ROLE_COLORS` 상수가 **단일 출처**.

| 역할 | 색상 코드 | 설명 |
|---|---|---|
| `SUPER USER` | `#f48fb1` | 연분홍 |
| `NORMAL USER` | `#a5d6a7` | 연녹색 |
| `GUEST` | `#90caf9` | 연파랑 |

- `import { ROLE_COLORS, getUserRoleColor } from "../context/AuthContext"` 사용
- 역할 색상 하드코딩 금지

---

## 색상 대비 (Color Contrast) — 텍스트 가독성 필수 규칙

**원칙:** 어떤 배경 위에든 텍스트가 시각적으로 읽히지 않는 상황은 허용하지 않는다.

### 그라데이션/컬러 배경 위 텍스트
| 규칙 | 예시 |
|---|---|
| 색상 배경 위 텍스트 → **흰색(`white`)** + `textShadow: "0 1px 2px rgba(0,0,0,0.5)"` | 시스템 이름, 상태 텍스트 |
| 밝은 배경(Minor/노란색 `#ffeb3b`) 위 텍스트 → **어두운 색(`#333`)** 사용 | 알람 뱃지 숫자 |
| 상태(Active/Standby)를 색상으로 구별할 때 → 텍스트 색상 대신 **색상 도트 인디케이터** + 흰색 텍스트 | `getStatusDotColor()` |

### 금지 패턴
- 🚫 녹색 배경 위 녹색(`#4caf50`) 텍스트 — 동일 색조, 읽을 수 없음
- 🚫 노란색 배경 위 흰색 텍스트 — 대비율 부족
- 🚫 `color: getStatusColor(status)` 를 그라데이션 카드 위에서 직접 사용

### 올바른 패턴
```tsx
// ✅ 상태 표시: 색상 도트 + 흰색 텍스트
<Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
  <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: getStatusDotColor(status) }} />
  <Typography sx={{ color: "white", textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}>
    {statusText}
  </Typography>
</Box>

// ✅ 노란색(minor) 뱃지 숫자: 어두운 텍스트
<Typography sx={{ color: isMinor ? "#333" : "white" }}>{count}</Typography>
```

### 대비 확인 체크리스트
1. 모든 카드/뱃지의 **가장 밝은 배경색**에서 텍스트가 읽히는지 확인
2. `textShadow`를 활용하여 반투명/그라데이션 배경에서 가독성 보장
3. 색상만으로 상태를 구분하지 말고, 형태(도트/아이콘) + 텍스트 라벨 병행

---

## 알람 레벨 색상 시스템

CSS 변수는 `src/styles.css` `:root`에 정의되어 있으며 라이트/다크 모드 공통 사용.

| 레벨 | CSS 변수 | 배경 | 텍스트 | 비고 |
|---|---|---|---|---|
| `critical` | `--alarm-critical-gradient` | `#c62828` (적색) | `#fff` | |
| `major` | `--alarm-major-gradient` | `#e65100` (주황) | `#fff` | |
| `minor` | `--alarm-minor-gradient` | `#f9a825` (노란) | `#222` | **밝은 배경 → 어두운 텍스트 필수** |
| `normal` | `--alarm-normal-gradient` | `#2e7d32` (녹색) | `#fff` | |
| `masked` | `--alarm-mask-gradient` | `#455a64` (청회) | `#fff` | |

### 코드 패턴

```tsx
// src/routes/sub/alarm.tsx 의 구현 예
const ALARM_LEVEL_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "var(--alarm-critical-gradient)", text: "#fff" },
  major:    { bg: "var(--alarm-major-gradient)",    text: "#fff" },
  minor:    { bg: "var(--alarm-minor-gradient)",    text: "#222" }, // ← 노란 배경 → 어두운 텍스트!
  normal:   { bg: "var(--alarm-normal-gradient)",   text: "#fff" },
  masked:   { bg: "var(--alarm-mask-gradient)",     text: "#fff" },
  unknown:  { bg: "#757575",                        text: "#fff" },
};

const getAlarmLevelColor = (level: string): { bg: string; text: string } => {
  return ALARM_LEVEL_COLORS[level.toLowerCase()] ?? { bg: "#757575", text: "#fff" };
};

// Chip에서 사용
const { bg, text } = getAlarmLevelColor(String(params.value ?? ""));
<Chip label={params.value} size="small" sx={{ background: bg, color: text, fontWeight: "bold" }} />
```

### 라이트/다크 모두 안전한 MUI Chip 색상

| 의미 | `color` prop | 용도 예 |
|---|---|---|
| 성공/정상 | `"success"` | 해지 상태, SUCCESS |
| 오류/위험 | `"error"` | 발생 상태, FAIL |
| 경고 | `"warning"` | Major 알람 수 |
| 정보/통과 | `"info"` | PASS, 인지 상태 |
| 기본 | `"default"` | ⚠️ 다크 모드에서 거의 보이지 않음 → 사용 자제 |

> `color="default"` Chip은 다크 모드에서 배경과 대비가 거의 없어 시인성이 매우 낮다.
> 의미 있는 상태에는 반드시 `"success"`, `"error"`, `"warning"`, `"info"` 중 하나를 선택한다.

---

## MUI 다크 모드에서 Contained 버튼 텍스트 색 반전 문제

**원인**: MUI 다크 모드는 `success.main`, `error.main` 등을 자동으로 밝게(lighter) 변환한다.
밝은 배경(예: primary 헤더) 위에 `success`/`error` Contained 버튼이 있으면 버튼도 밝아져서
헤더와 구별이 어렵고, `contrastText` 계산에 따라 텍스트가 어두워질 수 있다.

**증상**: 라이트 모드 → 정상. 다크 모드 → 버튼 배경이 밝은 색, 텍스트도 어두운 색

**Fix — ThemeContext에서 palette 고정 (MUI 자동 밝기 부스트 방지)**

`success.main` / `error.main`을 명시하면 MUI가 어떤 모드에서도 그 값을 그대로 사용한다.

```tsx
// src/context/ThemeContext.tsx
createTheme({
  palette: {
    mode: resolvedMode,
    success: { main: '#2e7d32', contrastText: '#fff' },  // 항상 진한 녹색
    error:   { main: '#c62828', contrastText: '#fff' },  // 항상 진한 빨간
  },
})
```

버튼은 기존대로 `color="success"` / `color="error"` 사용 — palette 고정이 정답이며 `sx`로 `backgroundColor`를 오버라이드하는 방식은 MUI v7에서 specificity 문제로 동작하지 않을 수 있다.

> **`sx={{ backgroundColor: "..." }}`가 동작하지 않는 이유**: MUI v7에서 컴포넌트 자체의 클래스(.MuiButton-containedSuccess 등)가 Emotion sx보다 늦게 주입되어 specificity 경쟁에서 이기는 경우가 있다. palette 정의가 항상 더 신뢰할 수 있는 방법이다.

### disabled 상태 버튼 색상 커스텀 — `&.Mui-disabled` 명시 타겟

MUI의 `disabled` 상태는 사용자 `color` prop을 무시하고 내부 반투명 회색 스타일을 强制 적용한다.
특히 컬러 헤더(`primary.main`) 위에 비활성화 버튼이 있으면 두 색이 섞여 대비가 완전히 무너진다.

`sx` 속성에서 `&.Mui-disabled` 선택자로 명시 오버라이드해야 한다:

```tsx
// ✅ 비활성화되어도 원래 색 계열을 유지하면서 "비활성" 표현 (opacity)
<Button
  variant="contained"
  color="success"       // palette 고정값(#2e7d32)이 활성 상태 색상
  disabled={isRunning}
  sx={{
    minWidth: 80,
    "&.Mui-disabled": {
      bgcolor: "rgba(46, 125, 50, 0.3)",    // success.main + 투명도
      color: "rgba(255, 255, 255, 0.7)",
    },
  }}
>
  RUN
</Button>

<Button
  variant="contained"
  color="error"          // palette 고정값(#c62828)
  disabled={!isRunning}
  sx={{
    minWidth: 80,
    "&.Mui-disabled": {
      bgcolor: "rgba(198, 40, 40, 0.3)",    // error.main + 투명도
      color: "rgba(255, 255, 255, 0.7)",
    },
  }}
>
  STOP
</Button>
```

**원칙**: 비활성 버튼은 완전히 숨기지 말고, 원래 색상의 저채도(투명도 적용) 버전으로 유지해 사용자가 버튼 위치를 계속 인지할 수 있도록 한다.

---

## Tauri 환경에서 파일 저장 (XLSX/다운로드)

`XLSX.writeFile()` 사용 시 Tauri webview에서 파일 다이얼로그 없이 조용히 실패할 수 있다.
`@tauri-apps/plugin-dialog` + `@tauri-apps/plugin-fs`를 사용해 네이티브 저장 다이얼로그를 표시해야 한다.

**필수 capabilities (`src-tauri/capabilities/default.json`)**:
```json
"dialog:default",
"fs:default",
{ "identifier": "fs:allow-read-file", "allow": [{ "path": "**" }] },
{ "identifier": "fs:allow-write-file", "allow": [{ "path": "**" }] }
```

```tsx
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

async function buildExcel(
  rows: Array<Record<string, unknown>>,
  columns: GridColDef[],
  defaultFilename: string,   // 형식: `{page}_{YYYYMMDD}.xlsx`
): Promise<void> {
  // ... XLSX 생성 ...
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "data");

  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const path = await save({
      defaultPath: defaultFilename,
      filters: [{ name: "Excel", extensions: ["xlsx"] }],
    });
    if (!path) return; // 사용자가 취소
    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as Uint8Array;
    await writeFile(path, buffer);
  } else {
    XLSX.writeFile(wb, defaultFilename); // 웹 모드 fallback
  }
}
```

---

## Workflow 캔버스/팔레트 패턴 (React Flow)

워크플로우 노드 팔레트는 드래그-드롭과 더블클릭 자동 배치를 모두 제공한다.

- 드래그-드롭 연결은 `ReactFlow` 컴포넌트의 `onDragOver` + `onDrop`에만 연결한다.
- wrapper 요소에 `onDragOver`를 중복 등록하지 않는다.
- React 19 + XYFlow 조합에서 X(no-drop) 커서가 나타나는 회귀를 막기 위해 wrapper DOM에 native `dragover` 리스너를 추가해 `event.preventDefault()`를 강제한다.
- 팔레트 더블클릭은 `WorkflowCanvas`가 등록한 중앙 배치 함수(`onRegisterNodeAdder`)를 통해 호출한다.

권장 구조:

```tsx
// WorkflowCanvas
onRegisterNodeAdder?: (fn: (editorType: "yaml" | "rule" | "group") => void) => void;

useEffect(() => {
  const el = reactFlowWrapper.current;
  if (!el) return;
  const onNativeDragOver = (e: DragEvent) => {
    if (!e.dataTransfer?.types.includes("text/plain")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  el.addEventListener("dragover", onNativeDragOver);
  return () => el.removeEventListener("dragover", onNativeDragOver);
}, []);
```

```tsx
// NodePalette
<Box
  draggable
  onDragStart={(e) => handleDragStart(e, item.editorType)}
  onDoubleClick={() => onDoubleClick?.(item.editorType)}
/>
```

**기본 파일명 형식**: `{routePage}_{YYYYMMDD}.xlsx` — 예: `statistics_history_20260327.xlsx`

**사전 조건 (capabilities/default.json)**:
```json
"dialog:default",
"fs:default"
```

---

## 분할 레이아웃 리사이저

- split layout → 공용 `LayoutResizer` (`src/components/LayoutResizer.tsx`) 필수
- 분할 위치 → localStorage 저장 (`src/lib/storageCache.ts` 우선 사용)
- 수동 `mousemove`/`mouseup` splitter 신규 작성 금지
- 저장 키 → `src/lib/storageKeys.ts` 상수 관리

### ResizeObserver + scaleY 수직 스케일링 패턴

고정 픽셀 높이를 가진 콘텐츠(예: HW 랙 슬롯)가 컨테이너 높이에 맞춰 확대되어야 할 때 사용.

```tsx
const colRef = useRef<HTMLDivElement>(null);
const contentRef = useRef<HTMLDivElement>(null);
const [scaleY, setScaleY] = useState(1);

// topOffset, bottomPad: 컨테이너의 padding 값
useEffect(() => {
  const measure = () => {
    const col = colRef.current;
    const content = contentRef.current;
    if (!col || !content) return;
    const availableH = Math.max(0, col.clientHeight - topOffset - bottomPad);
    const contentH = content.offsetHeight; // transform 영향 없음
    if (contentH > 0 && availableH > 0) {
      setScaleY(Math.max(1, availableH / contentH)); // 최소 1 (축소 없음)
    }
  };
  measure();
  const obs = new ResizeObserver(measure);
  const col = colRef.current;
  const content = contentRef.current;
  if (col) obs.observe(col);
  if (content) obs.observe(content); // 콘텐츠 높이 변화도 감지
  return () => obs.disconnect();
}, [topOffset]); // topOffset이 state면 deps에 포함

// JSX
<Box ref={colRef} sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', pt: `${topOffset}px`, pb: '8px' }}>
  <Box ref={contentRef} sx={{ transformOrigin: 'bottom center', transform: `scaleY(${scaleY})` }}>
    {/* 고정 높이 슬롯들 */}
  </Box>
</Box>
```

- `transform: scaleY()` 는 레이아웃에 영향 없음 → `offsetHeight`는 변환 전 자연 높이 반환
- `transformOrigin: 'bottom center'` → 콘텐츠가 위쪽으로 팽창 (아래쪽 고정)
- 컨테이너 `overflow: hidden` 필수 — 스케일 후 범위 밖 콘텐츠 클리핑
- 설정값 변경 → 커스텀 이벤트 (`window.dispatchEvent(new Event(EVENT_NAME))`) + 수신 측 `invalidateStorageCache` 패턴으로 실시간 반영

---

## ⚠️ HardwareView — 이미지 기반 랙 뷰 + 컴포넌트 상태 오버레이

> **핵심 개념 — 혼동 금지**: HardwareView는 단순 색상 박스 목록이 아니다.  
> **물리적 랙 이미지 위에 컴포넌트 상태 표시기를 오버레이하여, 어느 위치의 장치에 장애가 발생했는지를 시각화하는 것이 주 목적이다.**

### 목적

- 서버 장비의 전면(Front) / 후면(Rear) 이미지에 실제 컴포넌트(디스크, LAN 포트, PSU 등)의 위치에 맞춰 상태 색상 인디케이터를 오버레이
- 디스크 DISK01이 장애 상태라면 → 전면 이미지의 해당 디스크 슬롯 위치에 빨간 사각형
- 포트 ENO1이 연결 불량이라면 → 후면 이미지의 해당 포트 위치에 경고 색상
- 운영자가 물리적 서버에서 장애 부품 위치를 즉시 파악하도록 지원

### 컴포넌트 구조

```
src/components/hw/
  HardwareView.tsx       - 좌측 패널: 랙 전체 서버 목록 (기계별 상태 이미지 슬롯)
  HwComponentPanel.tsx   - 우측 HW 탭: 선택된 기계의 컴포넌트 오버레이 뷰
  HwStatusImage.tsx      - level 값 → 상태별 서버 이미지 (normal.gif / critical.gif 등)
  HwPortOverlay.tsx      - 이미지 위에 포트 상태 인디케이터를 % 좌표로 오버레이
  hwPortConfig.ts        - 포트 오버레이 위치 기본값 (% 좌표 기반)
  ServerSlot.tsx         - 개별 서버 슬롯: 제목 + HwStatusImage + HwPortOverlay
  SwitchSlot.tsx         - 스위치 슬롯
  types.ts               - HwSystemItem, SlotImageType 등 공통 타입
```

### 아키텍처

```
HardwareView (좌측 패널)
  └─ 시스템 목록 순회 → 각 시스템 = 이미지 슬롯(ServerSlot-based)
     - HwStatusImage: 기계 레벨에 따른 상태 이미지(gif/png)
     - 클릭 → /system-detail 이동

system-detail HW 탭 → HwComponentPanel
  ├─ 전면(Front) 탭: 전면 이미지 + DISK 그룹 컴포넌트 오버레이
  └─ 후면(Rear) 탭:  후면 이미지 + ENO/ENS 등 포트 그룹 오버레이
     └─ HwPortOverlay (% 좌표 기반 인디케이터 그리드)
```

### 컴포넌트 그룹 ↔ 전/후면 배치 규칙

| 기본값 | 표시 면 | 설명 |
|---|---|---|
| `DISK` 그룹 (DISK01, DISK02...) | **전면(Front)** | 디스크 베이는 서버 전면에 위치 |
| `ENO`, `ENS` 등 나머지 그룹 | **후면(Rear)** | LAN 포트, PSU 등은 서버 후면에 위치 |

- 그룹 접두어 기준: `hwGroupPrefix("DISK01") → "DISK"` (끝 숫자 제거)
- 배치 설정: `.env HW_COMP_FRONT_GROUPS` / `HW_COMP_REAR_GROUPS` (SUPER USER만 변경)
- 컴포넌트 종류가 다른 하드웨어는 설정에서 전/후면 재지정 가능

### 오버레이 위치 설정 (`hwPortConfig.ts` + localStorage)

각 컴포넌트 그룹의 오버레이 위치는 **이미지 대비 % 좌표**로 저장:

```ts
interface HwGroupOverlayConfig {
  groupPrefix: string;   // "DISK", "ENO", "ENS"
  side: "front" | "rear";
  xPct: number;          // 이미지 좌측 기준 X (%)
  yPct: number;          // 이미지 상단 기준 Y (%)
  itemWPct: number;      // 인디케이터 너비 (%)
  itemHPct: number;      // 인디케이터 높이 (%)
  cols: number;          // 그리드 열 수
  gapXPct: number;       // 가로 간격 (%)
  gapYPct: number;       // 세로 간격 (%)
}
```

- 기본 설정: `src/lib/hwCompConfig.ts` 의 `DEFAULT_GROUP_OVERLAY_CONFIGS`
- 사용자 커스텀: localStorage `"hw-comp-group-config.v1"` 에 저장
- 설정 에디터: Settings 페이지 "HW 컴포넌트 그룹 오버레이 위치" 아코디언
- 드래그 미세조정: `HW_DRAG_MODE=true` 시 인디케이터 드래그로 위치 조정

### 오버레이 렌더링 패턴

```tsx
// 이미지 컨테이너 (position: relative 필수)
<Box sx={{ position: "relative", display: "inline-block" }}>
  <HwStatusImage level={machineLevel} imageType="server-mp" style={{ width: "100%" }} />
  {/* 각 그룹 컴포넌트 오버레이 */}
  {diskRows.map((row, idx) => {
    const col = idx % cfg.cols;
    const rowIdx = Math.floor(idx / cfg.cols);
    const left = cfg.xPct + col * (cfg.itemWPct + cfg.gapXPct);
    const top  = cfg.yPct + rowIdx * (cfg.itemHPct + cfg.gapYPct);
    return (
      <Tooltip key={row.info_name} title={`${row.info_name}: ${statusLabel(row)}`}>
        <Box sx={{
          position: "absolute",
          left: `${left}%`, top: `${top}%`,
          width: `${cfg.itemWPct}%`, height: `${cfg.itemHPct}%`,
          bgcolor: severityColor(row),
          border: "1px solid rgba(0,0,0,0.4)",
          cursor: dragMode ? "grab" : "default",
        }} />
      </Tooltip>
    );
  })}
</Box>
```

### 금지 패턴

- 🚫 `HardwareView`를 단순 상태별 색상 박스(MachineBox) 목록으로 구현 — 물리 이미지 없으면 의미 없음
- 🚫 `HwComponentPanel`을 색상 블록 그리드로만 구현 — 물리 이미지 위에 오버레이가 핵심
- 🚫 포트/디스크 오버레이 위치를 픽셀 하드코딩 — 반드시 이미지 대비 % 좌표 사용
- 🚫 `HwPortConfigEditor` 및 그룹 위치 설정 아코디언을 Settings에서 제거 — 위치 조정이 핵심 기능

### 올바른 패턴

- ✅ `HardwareView` 좌측 패널 = 기계별 `HwStatusImage` 이미지 슬롯 + 클릭 시 상세 이동
- ✅ `HwComponentPanel` = 전면/후면 이미지에 그룹별 컴포넌트 상태 오버레이
- ✅ Settings 에서 전/후면 그룹 지정 + 각 그룹의 오버레이 X%, Y%, 크기% 조정 가능
- ✅ 드래그 모드: 인디케이터를 이미지 위에서 마우스로 드래그하여 위치 미세조정

### usePersistedPanelSize 훅 (`src/hooks/usePersistedPanelSize.ts`)

패널 크기를 localStorage에 영속 저장. **options 객체** 방식 — 위치 인자(tuple) 아님.

```tsx
// ✅ 올바른 사용법
const { size, setSize, persistSize } = usePersistedPanelSize({
  storageKey: STORAGE_KEYS.RULE_PANEL_SIZE,  // src/lib/storageKeys.ts 상수
  defaultValue: 280,
  min: 150,
  max: 600,
});

// ❌ 잘못된 사용법 (tuple 방식)
const [size, setSize] = usePersistedPanelSize("key", 280);  // 컴파일 에러
```

- `size`: 현재 패널 크기 (px)
- `setSize`: 실시간 크기 변경 (드래그 중 호출)
- `persistSize`: 드래그 종료(mouseup) 시 localStorage 저장 호출

---

## 레이아웃 너비

모든 라우트의 최상단 `Container`는 `maxWidth={false}` 필수 (로그인 포함 예외 없음).

---

## useStickyState — 페이지 상태 보존

`src/hooks/useStickyState.ts` — 모듈 레벨 `Map<string, unknown>` 캐시 기반 `useState` 대체.
SPA 라이프타임 동안 값 보존 (새로고침 전까지).

```tsx
// DB 결과, 필터, 선택값 → useStickyState
const [rows, setRows] = useStickyState<MyRow[]>("page.rows", []);
const [systemName, setSystemName] = useStickyState("page.systemName", "");

// 로딩/에러/다이얼로그 → useState 유지
const [loading, setLoading] = useState(false);
```

### 변환 판별

| 구분 | useStickyState | useState |
|---|---|---|
| DB 조회 결과, 필터, 페이지네이션, 선택 상태 | ✅ | |
| 로딩/에러/다이얼로그/보안 데이터 | | ✅ |
| **폴링으로 갱신되는 대용량 데이터** | | ✅ |

### ⚠️ useStickyState 사용 금지 케이스 — 대용량 폴링 데이터

`useStickyState`는 값이 변경될 때마다 `JSON.stringify(value)`를 **메모리 Map에 직접 저장**한다.
1 MB 이상의 데이터를 10 초 간격으로 갱신하면 심각한 GC 압박 → WebView OOM 발생 원인.

**금지 케이스:**
- 차트 응답 (`ChartsResponse` 등 폴링 데이터 전체)
- 테이블 전체 rows (페이지당 수백~수천 행)
- 10 초 이하 주기로 갱신되는 JSON 배열/객체

**대안:** `useState` 사용. 페이지 새로고침 후 백엔드 폴링으로 즉시 재획득 가능한 데이터는
localStorage 지속 저장 불필요.

```tsx
// ❌ 잘못된 패턴 — 폴링 응답을 useStickyState에 보관
const [data, setData] = useStickyState<ChartsResponse | null>("sub/charts.data", null);

// ✅ 올바른 패턴 — useState 사용 + 필요 시 마운트에서 stale key 제거
const [data, setData] = useState<ChartsResponse | null>(null);
useEffect(() => {
  // 이전 세션에 잘못 저장된 키가 있으면 제거
  localStorage.removeItem("sub/charts.data");
}, []);
```

### 로그아웃 시 초기화
`AuthContext.performLogoutCleanup()` → `clearAllStickyState()` 호출.

---

## DIAG 진단 로깅 — `logDiag` 패턴

```tsx
import { logDiag } from "../../lib/logger";

const SCOPE = "ComponentName";

// 진단 로그 — 설정 페이지에서 진단 옵션 활성화 시에만 파일에 기록됨
logDiag(SCOPE, "폴링 진단", { pollCount, totalSeries, heapMB });
```

- `logDiag(scope, message, details?)` — `[DIAG]` 접두사를 자동 추가하여 `logFrontend` 호출
- **`LOG_DIAGNOSTIC_ENABLED=true`** (.env) 일 때만 Rust 측에서 실제 파일에 기록됨
- 설정 페이지 "Log Management → 진단 로그 기록" 토글로 런타임 활성화 가능
- 비활성 시 Rust `write_frontend_log`가 `[DIAG]` 접두사 메시지를 조기 반환하여 I/O 없음
- 일반 운영 로그(info/warn/error)는 기존 `logFrontend` 사용 — DIAG 게이팅 대상 아님

### 패턴 비교

| 상황 | 함수 | 파일 기록 조건 |
|---|---|---|
| 폴링 통계, 힙 사이즈, 상태 덤프 | `logDiag` | `LOG_DIAGNOSTIC_ENABLED=true` 일 때만 |
| 재연결 성공/실패, 인증 오류 | `logFrontend(..., "warn"/"error", ...)` | 항상 |
| UX 에러 메시지 | `logFrontend(..., "error", ...)` | 항상 |

### 백엔드 DIAG 속도 제한
`LOG_DIAGNOSTIC_ENABLED=true` → `write_diag()` 동일 메시지(100자 기준) `LOG_DIAG_RATE_LIMIT_SECS`(기본 60초) 내 재기록 차단.
프론트엔드 발 `[DIAG]` 메시지에는 속도 제한이 적용되지 않으므로, 폴링 루프에서 호출 빈도를 직접 제어해야 한다 (예: `pollCount % 6 === 1`).
- 설정 0 → 제한 없음
- Settings → "Log Management" → `LOG_DIAG_RATE_LIMIT_SECS`

---

### 에러 핸들링 — `[object Object]` 방지

`tauriInvoke`의 오류는 `AppError` **객체**로 throw된다. `String(e)`를 사용하면 `"[object Object]"`가 표시된다.

```tsx
// ❌ 잘못된 패턴
} catch (e) {
  showSnack(String(e), "error");     // AppError 객체 → "[object Object]"
  setError(String(e));
}

// ✅ 올바른 패턴
import { toAppError } from "../../lib/errors";
} catch (e) {
  showSnack(toAppError(e).message, "error");   // "DB 연결이 설정되지 않았습니다." 등 실제 메시지
  setError(toAppError(e).message);
}
```

**규칙**: 모든 `catch (e)` 블록에서 `toAppError(e).message`를 사용. `String(e)` 금지.

---

## 로깅 정책 — `console.*` 금지

**`console.log / console.warn / console.error` 는 어떤 경우에도 사용 금지.**

| 목적 | 대신 사용 |
|---|---|
| 디버그/진행 로그 | `void logFrontend(SCOPE, "debug", "메시지", details)` → 백엔드 로그 파일 기록 |
| 경고 로그 | `void logFrontend(SCOPE, "warn", "메시지", details)` |
| 오류 로그 | `void logFrontend(SCOPE, "error", "메시지", err)` |
| 사용자 알림 (성공/경고/오류) | `showSnackbar("메시지", "success" \| "warning" \| "error")` |
| 페이지 내 영구 오류 표시 | `setError("메시지")` → Alert 컴포넌트 (`const [error, setError] = useState("")`) |

### 올바른 패턴

```tsx
import { logFrontend } from "../../lib/logger";
import { useSnackbar } from "../../context/SnackbarContext";

const SCOPE = "MyPage";  // 모듈 레벨 상수

function MyPage() {
  const { showSnackbar } = useSnackbar();
  const [error, setError] = useState("");

  const handleAction = async () => {
    void logFrontend(SCOPE, "debug", "[action] 시작", { param });
    try {
      await doSomething();
      showSnackbar("작업이 완료되었습니다.", "success");
    } catch (err) {
      void logFrontend(SCOPE, "error", "[action] 실패", err);
      showSnackbar("작업에 실패했습니다.", "error");
    }
  };
}
```

> `logFrontend`는 `tauriInvoke`를 통해 Rust 백엔드 로그 파일에 기록된다.
> `void`를 붙여 Promise를 명시적으로 무시한다 (로그 실패가 메인 흐름에 영향 주지 않음).

---

## 글로벌 가청알람 — AppLayout 통합 관리

가청알람(useAlarmSound)은 **AppLayout에서 전역 관리**한다. 개별 페이지에서 `useAlarmSound`를 직접 호출하지 않는다.

### 아키텍처

```text
AppLayout (isAuthenticated && !isLoginPage)
  ├─ alarm_list 10초 폴링 → AlarmCounts 집계 (mask 제외)
  ├─ useAlarmSound(alarmCounts, soundMuted)  ← 전역 1회 호출
  └─ MenuToolbar
       └─ MMC / COND / DB 칩 → VolumeUp/VolumeOff IconButton
```

### storageKey

```ts
// src/lib/storageKeys.ts
ALARM_SOUND_MUTED_KEY = "sub-alarm.sound.muted.v1"
```

`AppLayout`과 알람 페이지가 `useStickyState(ALARM_SOUND_MUTED_KEY, false)`를 공유.  
음소거 상태는 localStorage 영속 저장.

### AppLayout 알람 폴링 패턴

```tsx
// AppLayout 내부
const [soundMuted, setSoundMuted] = useStickyState(ALARM_SOUND_MUTED_KEY, false);
const [alarmCounts, setAlarmCounts] = useState<AlarmCounts>({ critical: 0, major: 0, minor: 0 });

useEffect(() => {
  if (!isAuthenticated || isLoginPage) return;

  const fetchAlarms = async () => {
    try {
      const alarmsData = await tauriInvoke<Record<string, string>[]>("alarm_list");
      let critical = 0, major = 0, minor = 0;
      for (const a of alarmsData) {
        const mask = String(a.mask ?? "").trim();
        const isMasked = (mask !== "" && mask !== "0") ||
          String(a.alarm_level ?? "").toLowerCase() === "masked";
        if (isMasked) continue;
        switch (String(a.alarm_level).toLowerCase()) {
          case "critical": critical++; break;
          case "major": major++; break;
          case "minor": minor++; break;
        }
      }
      setAlarmCounts({ critical, major, minor });
    } catch { /* 연결 미설정 시 무시 */ }
  };

  void fetchAlarms();
  const timer = setInterval(() => void fetchAlarms(), 10_000);
  return () => clearInterval(timer);
}, [isAuthenticated, isLoginPage]);

useAlarmSound(alarmCounts, soundMuted || isLoginPage);
```

### 음소거 버튼 — MenuToolbar (DB 칩 다음)

```tsx
<Tooltip title={soundMuted ? "알람 소리 켜기" : alarmCounts.critical > 0 ? `Critical ${alarmCounts.critical}건` : "알람 소리 끄기"}>
  <IconButton
    size="small"
    onClick={onToggleMute}
    sx={{
      color: !soundMuted && alarmCounts.critical > 0 ? "#ff4444"
           : !soundMuted && alarmCounts.major > 0   ? "#ff8800"
           : !soundMuted && alarmCounts.minor > 0   ? "#ffee00"
           : "rgba(255,255,255,0.7)",
    }}
  >
    {soundMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
  </IconButton>
</Tooltip>
```

### 금지 패턴

- 🚫 개별 페이지에서 `useAlarmSound` 직접 호출 — AppLayout에서 전역 1회만 호출
- 🚫 개별 페이지에서 자체 음소거 버튼 추가 — AppBar 통합 버튼 사용
- 🚫 `alarm.tsx` `CurrentAlarmTab`에서 `useAlarmSound`, `VolumeUpIcon`, `VolumeOffIcon` 중복 선언
