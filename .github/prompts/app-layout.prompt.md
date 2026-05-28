---
description: "앱 레이아웃 패턴 구현 — breadcrumb 네비게이션, 드래그 가능한 그리드, localStorage 상태 보존, 리사이즈/이동 다이얼로그, 테마 모드, 반응형 UI"
name: "App Layout Patterns"
argument-hint: "구현할 레이아웃 기능 (예: breadcrumb, grid, dialog, theme, responsive)"
agent: "agent"
---

# App Layout 패턴 구현 가이드

이 프로젝트의 레이아웃 관련 기능을 구현할 때 아래 규칙을 준수하여 일관된 UX를 제공한다.
관련 스킬: [ui-conventions](../../.github/skills/ui-conventions/SKILL.md), [ui-table-patterns](../../.github/skills/ui-table-patterns/SKILL.md)

---

## 1. Breadcrumb 네비게이션

모든 라우트 페이지는 상위/이전 페이지로 이동하는 breadcrumb을 제공해야 한다.

### 규칙
- TanStack Router의 `useMatches()` 훅으로 현재 경로 계층을 읽는다.
- 최상위(`/`)는 "Home"으로 표시하고 클릭 시 루트로 이동한다.
- 현재 페이지는 클릭 불가(비활성) 텍스트로 표시한다.
- MUI `Breadcrumbs` + `Link`/`Typography` 조합을 사용한다.

### 코드 패턴

```tsx
import { Breadcrumbs, Link, Typography } from "@mui/material";
import { useMatches, useNavigate } from "@tanstack/react-router";

export function PageBreadcrumb() {
  const matches = useMatches();
  const navigate = useNavigate();

  return (
    <Breadcrumbs sx={{ mb: 1 }}>
      {matches.slice(0, -1).map((m) => (
        <Link
          key={m.pathname}
          component="button"
          underline="hover"
          onClick={() => navigate({ to: m.pathname })}
        >
          {m.routeContext?.breadcrumb ?? m.pathname}
        </Link>
      ))}
      <Typography color="text.primary">
        {matches.at(-1)?.routeContext?.breadcrumb ?? "현재 페이지"}
      </Typography>
    </Breadcrumbs>
  );
}
```

- 라우트 파일에서 `beforeLoad` 로 `breadcrumb` 컨텍스트를 제공한다:

```ts
// src/routes/mmc/batchjob.tsx 예시
export const Route = createFileRoute("/mmc/batchjob")({
  beforeLoad: () => ({ breadcrumb: "MMC BatchJob" }),
  component: BatchJobPage,
});
```

---

## 2. 드래그 가능한 그리드 레이아웃

레이아웃 영역(패널)은 사용자가 마우스로 크기를 조절할 수 있도록 `LayoutResizer`를 사용한다.
크기 상태는 `usePersistedPanelSize` 훅으로 localStorage에 자동 저장/복원한다.

### 핵심 컴포넌트

| 컴포넌트/훅 | 위치 | 역할 |
|---|---|---|
| `LayoutResizer` | `src/components/LayoutResizer.tsx` | 드래그 가능한 분할선 |
| `usePersistedPanelSize` | `src/hooks/usePersistedPanelSize.ts` | 패널 크기 localStorage 저장 |
| `HOME_LAYOUT_SIZES_STORAGE_KEY` | `src/lib/storageKeys.ts` | 공통 스토리지 키 상수 |

### 코드 패턴

```tsx
import { LayoutResizer } from "../components/LayoutResizer";
import { usePersistedPanelSize } from "../hooks/usePersistedPanelSize";

const STORAGE_KEY = "my-page.leftPane.v1"; // storageKeys.ts에 상수 추가 권장

export function SplitLayout() {
  const { size: leftWidth, setSize: setLeftWidth, persistSize } =
    usePersistedPanelSize({ storageKey: STORAGE_KEY, defaultValue: 280, min: 150, max: 600 });

  return (
    <Box sx={{ display: "flex", height: "100%", overflow: "hidden" }}>
      {/* 좌측 패널 */}
      <Box sx={{ width: leftWidth, flexShrink: 0, overflow: "auto" }}>
        {/* 콘텐츠 */}
      </Box>

      {/* 수평 분할선 */}
      <LayoutResizer
        direction="horizontal"
        onResize={(delta) => setLeftWidth((w) => Math.max(150, Math.min(600, w + delta)))}
        onResizeEnd={persistSize}
      />

      {/* 우측 패널 */}
      <Box sx={{ flex: 1, overflow: "auto" }}>
        {/* 콘텐츠 */}
      </Box>
    </Box>
  );
}
```

### 주의사항
- 스토리지 키는 `src/lib/storageKeys.ts`에 상수로 등록하고 버전 접미사(`.v1`)를 붙인다.
- `direction="vertical"` 로 수직 분할도 동일하게 처리한다.
- 레이아웃 전체(Holy Grail) 구조는 `AppLayout.tsx` 참고.

---

## 3. 모든 UI 상태 → localStorage 보존

**원칙**: 사용자가 조작한 상태는 앱 재시작 후에도 유지되어야 한다.  
다음 우선순위로 저장 방식을 선택한다.

| 상태 종류 | 권장 방식 | 비고 |
|---|---|---|
| 패널 크기 (px) | `usePersistedPanelSize` | min/max clamp 자동 처리 |
| 일반 UI 토글/값 | `getCachedLocalStorage` / `setCachedLocalStorage` (`src/lib/storageCache.ts`) | 레이아웃 안에서 마운트 유지 |
| 라우트 간 유지 상태 | `useStickyState` (`src/hooks/useStickyState.ts`) | 페이지 이동 후 돌아와도 유지 |
| 테이블 컬럼/폰트 크기 | `useDataGridColumnState` / `useResizableColumns` | 스킬 `ui-table-patterns` 참고 |
| 테마 모드 | `ThemeContextProvider` (내장) | `"theme-mode"` 키 자동 사용 |

### useStickyState 사용 패턴

```tsx
import { useStickyState } from "../hooks/useStickyState";

const [tab, setTab] = useStickyState("my-page.selectedTab", 0);
const [filter, setFilter] = useStickyState("my-page.filter", "");
```

키 명명 규칙: `"<route-path>.<stateName>"` (예: `"sub/alarm.alarms"`)

---

## 4. 서브 다이얼로그 — 리사이즈 + 이동

서브 다이얼로그는 `ResizableDialog` 컴포넌트를 사용한다.

### 기능
- 4개 모서리 + 4개 변에서 리사이즈 가능
- AppBar(타이틀 바) 드래그로 이동
- `storageKey` 지정 시 SPA 세션 동안 크기/위치 유지

### 코드 패턴

```tsx
import { ResizableDialog } from "../components/ResizableDialog";

<ResizableDialog
  open={open}
  onClose={() => setOpen(false)}
  dialogTitle="상세 정보"
  defaultWidth={700}
  defaultHeight={500}
  minWidth={400}
  minHeight={300}
  storageKey="my-page.detailDialog.v1"  // 생략하면 매번 초기화
>
  {/* 다이얼로그 내용 */}
</ResizableDialog>
```

### 주의사항
- `storageKey`는 `src/lib/storageKeys.ts`에 상수 등록 권장.
- 크기/위치는 geometryCache(세션 메모리)에 저장 — 앱 재시작 시 초기화된다.  
  앱 재시작 후에도 유지하려면 별도로 localStorage 연동이 필요하다.
- `dialogTitle`을 생략하면 AppBar가 렌더되지 않아 이동 기능 비활성화.

---

## 5. 테마 모드 (light / dark / system)

### 규칙
- `ThemeContextProvider` (`src/context/ThemeContext.tsx`) 를 Context 최상위에 배치.
- 테마 선택은 `useThemeMode()` 훅으로만 접근한다.
- `mounted` 상태 확인으로 SSR/Hydration 불일치를 방지한다 — `mounted === false` 이면 렌더하지 않는다.
- 별도의 커스텀 색상이 없는 경우 MUI 기본 palette (`primary`, `secondary`, `error`, `warning`, `info`, `success`) 를 사용한다.
- 하드코딩 색상(`#1976d2` 등) 대신 `theme.palette.primary.main` 등 토큰을 사용한다.

### 테마 선택 UI 패턴

```tsx
import { useThemeMode } from "../context/ThemeContext";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import SettingsBrightnessIcon from "@mui/icons-material/SettingsBrightness";

const { mode, setMode } = useThemeMode();

const MODES = [
  { value: "light", icon: <LightModeIcon />, label: "라이트" },
  { value: "dark",  icon: <DarkModeIcon />,  label: "다크" },
  { value: "system",icon: <SettingsBrightnessIcon />, label: "시스템" },
] as const;
```

### Hydration 방지 패턴

```tsx
// ThemeContextProvider 내부에서 mounted 이후에만 resolvedMode를 사용
const [mounted, setMounted] = useState(false);
useEffect(() => { setMounted(true); }, []);

const resolvedMode: PaletteMode = mounted
  ? (mode === "system" ? systemPref : mode)
  : "light"; // 서버/초기 렌더 기본값
```

---

## 6. 반응형 UI (앱 + 웹 동시 사용)

Tauri 앱과 브라우저(`pnpm dev:vite`) 모두에서 동작하므로 모바일 뷰포트도 고려한다.

### 기본 원칙
- MUI `useMediaQuery` / `theme.breakpoints` 만 사용 — 미디어 쿼리 직접 작성 금지.
- 테이블/그리드 등 가로 스크롤이 필요한 컴포넌트는 `overflow: "auto"` 컨테이너로 감싼다.
- 사이드바/패널은 모바일(`xs`)에서 숨기거나 드로어로 전환한다.
- 폰트 크기는 `rem` 단위 사용, 기본 `0.8rem` (ui-table-patterns 기준).

### 반응형 레이아웃 패턴

```tsx
import { useMediaQuery, useTheme } from "@mui/material";

const theme = useTheme();
const isMobile = useMediaQuery(theme.breakpoints.down("sm")); // < 600px
const isTablet = useMediaQuery(theme.breakpoints.down("md")); // < 900px

// 반응형 컨테이너
<Box
  sx={{
    display: "flex",
    flexDirection: isMobile ? "column" : "row",
    height: "100%",
    overflow: "hidden",
  }}
>
  {/* 사이드패널: 모바일에서 숨김 */}
  {!isMobile && (
    <Box sx={{ width: leftWidth, flexShrink: 0 }}>
      {/* 사이드 콘텐츠 */}
    </Box>
  )}
  {/* 메인 콘텐츠 */}
  <Box sx={{ flex: 1, overflow: "auto", minWidth: 0 }}>
    {/* 콘텐츠 */}
  </Box>
</Box>
```

### AppBar 반응형

```tsx
// 모바일에서 텍스트 라벨 숨기기
<Button startIcon={<HomeIcon />}>
  {!isMobile && "Home"}
</Button>

// 모바일에서 아이콘만 표시
<Tooltip title="설정">
  <IconButton><SettingsIcon /></IconButton>
</Tooltip>
```

### 다이얼로그 반응형

```tsx
<ResizableDialog
  open={open}
  onClose={() => setOpen(false)}
  defaultWidth={isMobile ? window.innerWidth - 32 : 700}
  defaultHeight={isMobile ? window.innerHeight - 100 : 500}
  storageKey="my-page.dialog.v1"
>
```

---

## 7. 공통 규칙 요약

| 항목 | 규칙 |
|---|---|
| IPC 호출 | `tauriInvoke` / `tauriListen` 만 사용 (`src/lib/invoke.ts`) |
| 에러 처리 | `AppError` 형태 (`src/lib/errors.ts`) |
| 상태 key | `src/lib/storageKeys.ts` 에 상수 등록, 버전 접미사 필수 (`.v1`) |
| 컬러 | MUI palette 토큰 사용, 역할 색상은 `ROLE_COLORS` 상수 참조 |
| 라우트 생성 | `routeTree.gen.ts` 수동 편집 금지 — TanStack Router 자동 생성 |
| 주기/환경값 | `.env` 환경변수 → `settings_get_public` / `std::env::var` 사용 |
| 코드 스타일 | Biome (`pnpm fix`), 2스페이스 들여쓰기 |

---

## 호출 예시

```
/app-layout breadcrumb을 모든 라우트에 추가해줘
/app-layout 왼쪽/오른쪽 패널을 드래그로 크기 조절 가능하게 만들어줘
/app-layout 현재 다이얼로그를 ResizableDialog로 교체해줘
/app-layout 이 페이지 상태를 앱 재시작 후에도 유지되게 해줘
/app-layout 모바일 반응형 레이아웃 적용해줘
```
