---
description: "Video Editor 앱 레이아웃 패턴 — editor split layout, panel resizing, sticky state, ResizableDialog, theme/settings"
name: "App Layout Patterns"
argument-hint: "구현할 레이아웃 기능 (예: editor panel resize, dialog, sticky state, theme, responsive)"
agent: "agent"
---

# App Layout 패턴 구현 가이드

관련 스킬: [ui-conventions](../skills/ui-conventions/SKILL.md), [react-best-practices](../skills/react-best-practices/SKILL.md)

프로젝트 맵: [PROJECT_MAP.md](../../PROJECT_MAP.md)

---

## 기본 규칙

1. 작업 전 `PROJECT_MAP.md`, `.github/instructions/ui.instructions.md`, `.github/skills/ui-conventions/SKILL.md`를 확인한다.
2. 앱 첫 화면은 실제 편집 UI여야 한다. 랜딩 페이지나 설명용 hero를 만들지 않는다.
3. 루트/라우트 파일은 얇게 유지하고, 무거운 화면은 `React.lazy`로 분리한다.
4. 패널 크기와 UI 설정은 `src/lib/storageKeys.ts` 상수 + `useStickyState`를 사용한다.
5. 팝업은 항상 `ResizableDialog`를 사용한다. MUI `Dialog` 직접 사용과 `window.confirm()`은 금지한다.
6. Tauri IPC는 `tauriInvoke` / `tauriListen` wrapper만 사용한다.
7. Timeline 편집 상태 변경은 `useTimelineStore` 액션과 필요 시 `withHistory()`를 통한다.
8. `routeTree.gen.ts`는 수동 편집하지 않는다.

---

## Editor Split Layout

`src/components/EditorLayout.tsx`는 에셋 패널, 툴바, 프리뷰, 타임라인, 속성 패널을 조합하는 중심이다.

```tsx
<Box sx={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>
  <AssetPanel />
  <LayoutResizer direction="horizontal" onResize={...} />
  <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
    <PreviewPlayer />
    <LayoutResizer direction="vertical" onResize={...} />
    <TimelinePanel />
  </Box>
  <LayoutResizer direction="horizontal" onResize={...} />
  <PropertiesPanel />
</Box>
```

레이아웃 패널을 추가하거나 이동하면 `PROJECT_MAP.md`와 `ui-conventions` skill을 함께 확인한다.

---

## Panel Size Persistence

```tsx
import { STORAGE_KEYS } from '@/lib/storageKeys'
import { useStickyState } from '@/lib/useStickyState'

const [panelWidth, setPanelWidth] = useStickyState(280, STORAGE_KEYS.MY_PANEL_WIDTH)
```

- storage key는 문자열을 컴포넌트에 직접 쓰지 말고 `STORAGE_KEYS`에 추가한다.
- fixed-format UI는 `minWidth`, `maxWidth`, `minHeight`, `minHeight: 0`, `overflow`를 명확히 둔다.
- 텍스트가 버튼/패널 안에서 넘치지 않게 `minWidth: 0`, `textOverflow`, `whiteSpace`를 점검한다.

---

## ResizableDialog

```tsx
<ResizableDialog
  open={open}
  onClose={() => setOpen(false)}
  dialogTitle="내보내기"
  defaultWidth={520}
  defaultHeight={460}
  minWidth={360}
  minHeight={260}
  storageKey={STORAGE_KEYS.EXPORT_DIALOG}
>
  {/* content */}
</ResizableDialog>
```

- `dialogTitle`을 제공해 이동 가능한 title bar를 유지한다.
- 위험 동작 확인도 ResizableDialog 기반 상태로 구현한다.
- 다이얼로그 내부는 카드 안 카드 구조를 피하고, 조밀한 폼 레이아웃을 유지한다.

---

## Theme And Settings

- 테마는 `src/components/AppThemeProvider.tsx`와 `src/store/settingsStore.ts`가 담당한다.
- 설정 화면은 `src/components/settings/SettingsPage.tsx`에 두고 `src/routes/settings.tsx`에서 lazy-load한다.
- 새 설정값은 `.env.example`, `settingsStore`, `storageKeys`, docs를 함께 검토한다.
- MUI `sx`와 theme palette를 우선 사용하고, 일회성 hardcoded 색상 남발을 피한다.

---

## Responsive Rules

- 데스크톱 편집 앱이므로 반복 작업에 필요한 정보 밀도를 유지한다.
- 작은 화면에서는 패널 폭/높이에 `minmax`, `minHeight: 0`, `overflow: auto`를 명시해 겹침을 막는다.
- hero/marketing 구성 대신 편집 가능한 실제 UI를 우선한다.
- `pnpm build:vite`에서 500kB+ chunk 경고가 나오면 route body, dialogs, editor panels를 lazy-load 후보로 먼저 검토한다.

---

## 완료 체크리스트

- [ ] `PROJECT_MAP.md` 기준 대상 파일 확인
- [ ] `LayoutResizer` / `useStickyState` / `STORAGE_KEYS` 패턴 준수
- [ ] popup은 `ResizableDialog`
- [ ] Tauri IPC wrapper 사용
- [ ] Timeline 변경은 store action 및 history 정책 준수
- [ ] 관련 docs/skills/TODO 갱신
- [ ] `pnpm typecheck`, Biome, 필요한 테스트 통과
