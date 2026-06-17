---
name: ui-conventions
description: Video editor UI conventions for MUI v7, ResizableDialog, LayoutResizer, useStickyState, AppThemeProvider, TanStack Router routes, and frontend error handling. Keywords: layout, MUI, ResizableDialog, dialog, popup, confirm, window.confirm, LayoutResizer, useStickyState, storageKeys, AppThemeProvider, GlobalAppBar, EditorLayout
---
# UI Conventions Skill

이 스킬은 React + Tauri 비디오 에디터의 UI 변경 전 확인용 지침이다. 과거 다른 앱의 인증, 알람, DB, 서버 장비 도메인 규칙은 이 프로젝트에 적용하지 않는다.

---

## 팝업 다이얼로그

모든 팝업은 `src/components/common/ResizableDialog.tsx`의 `ResizableDialog`를 사용한다. MUI `Dialog`를 직접 새로 쓰거나 `window.confirm()`을 사용하지 않는다.

```tsx
import { ResizableDialog } from '@/components/common/ResizableDialog'

<ResizableDialog
  open={open}
  onClose={onClose}
  dialogTitle="Export"
  defaultWidth={520}
  defaultHeight={420}
  minWidth={360}
  minHeight={260}
  storageKey="export-dialog"
>
  <DialogContent>...</DialogContent>
  <DialogActions>...</DialogActions>
</ResizableDialog>
```

- `dialogTitle`을 생략하면 AppBar 없이 children만 렌더한다.
- 크기 저장이 필요한 다이얼로그는 고유 `storageKey`를 지정한다.
- 여러 창을 독립적으로 띄워야 할 때만 `hideBackdrop`을 사용한다.

### 확인 다이얼로그 패턴

Tauri WebView에서 브라우저 기본 confirm은 UX와 동작이 불안정하므로 state 기반 `ResizableDialog`를 사용한다.

```tsx
const [confirmDialog, setConfirmDialog] = useState<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmColor?: 'error' | 'warning' | 'primary'
  onConfirm: () => Promise<void> | void
} | null>(null)
const [confirmLoading, setConfirmLoading] = useState(false)
const [errorMessage, setErrorMessage] = useState('')

function requestDelete() {
  setConfirmDialog({
    open: true,
    title: '클립 삭제',
    message: '선택한 클립을 삭제할까요?',
    confirmLabel: '삭제',
    confirmColor: 'error',
    onConfirm: async () => {
      // 실제 변경은 useTimelineStore 액션 또는 withHistory 내부에서 처리
    },
  })
}
```

```tsx
{confirmDialog ? (
  <ResizableDialog
    open={confirmDialog.open}
    onClose={() => setConfirmDialog(null)}
    dialogTitle={confirmDialog.title}
    defaultWidth={420}
    defaultHeight={220}
    minWidth={340}
    minHeight={180}
    storageKey="confirm-dialog"
  >
    <DialogContent>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Typography>{confirmDialog.message}</Typography>
    </DialogContent>
    <DialogActions>
      <Button onClick={() => setConfirmDialog(null)}>취소</Button>
      <Button
        variant="contained"
        color={confirmDialog.confirmColor ?? 'primary'}
        disabled={confirmLoading}
        onClick={async () => {
          setConfirmLoading(true)
          setErrorMessage('')
          try {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
          } catch (e) {
            setErrorMessage(toAppError(e).message)
          } finally {
            setConfirmLoading(false)
          }
        }}
      >
        {confirmLoading ? <CircularProgress size={18} /> : (confirmDialog.confirmLabel ?? '확인')}
      </Button>
    </DialogActions>
  </ResizableDialog>
) : null}
```

---

## 앱 셸과 라우팅

- `src/main.tsx`는 `AppThemeProvider` → `AppLoader` → `RouterProvider` 순서로 앱을 감싼다.
- `src/routes/__root.tsx`는 `GlobalAppBar`, `ExportDialog`, `NewProjectDialog` 같은 루트 UI를 lazy loading한다.
- 새 라우트는 `src/routes/**`에 추가하고 `src/routeTree.gen.ts`는 직접 수정하지 않는다.
- 설정 화면은 `src/routes/settings.tsx`에서 route body를 lazy loading하는 패턴을 유지한다.

---

## 에디터 레이아웃

- 메인 작업 화면은 `src/components/EditorLayout.tsx`가 소유한다.
- 좌측 asset panel, 중앙 preview/timeline, 우측 properties panel의 크기 조정은 `src/components/common/LayoutResizer.tsx`를 사용한다.
- 패널 크기, 접힘 상태, preview zoom 같은 UI 상태 키는 `src/lib/storageKeys.ts`의 `STORAGE_KEYS`에 추가하고 `useStickyState`로 보존한다.
- 수동 `mousemove`/`mouseup` splitter 구현을 새로 만들지 않는다. 공통 resizer를 확장해야 한다.

```tsx
const [assetWidth, setAssetWidth] = useStickyState(240, STORAGE_KEYS.PANEL_ASSET_WIDTH)

<LayoutResizer
  direction="vertical"
  onResize={(delta) => setAssetWidth((value) => Math.max(180, value + delta))}
/>
```

---

## useStickyState

`src/lib/useStickyState.ts`는 첫 렌더에서 `localStorage` 값을 복원하고, 이후 변경분을 JSON으로 저장한다.

```tsx
const [previewHeight, setPreviewHeight] = useStickyState(
  520,
  STORAGE_KEYS.PANEL_PREVIEW_HEIGHT
)
```

| useStickyState 적합 | useState 적합 |
|---|---|
| 패널 크기, zoom, 설정 화면 입력값, 최근 UI 선택값 | 로딩, 에러, 다이얼로그 열림, export 진행률 |
| 새로고침 후에도 유지하면 좋은 작은 값 | media element, canvas context, 대용량 asset/cache 객체 |

1 MB 이상 데이터, media element, `blob:` URL, polling 응답 전체를 sticky state에 넣지 않는다.

---

## 상태 변경

- timeline/clip/track 편집은 `useTimelineStore` 액션을 통해 처리한다.
- undo/redo가 필요한 편집은 `withHistory` 또는 `src/lib/historyActions.ts`의 helper를 사용한다.
- asset 목록은 `useAssetStore`, project dirty/save/open은 `useProjectStore`, 도구 선택은 `useToolStore`를 따른다.
- 컴포넌트 내부 local state는 UI 일시 상태에만 사용한다.

---

## 에러 표시

`tauriInvoke` 에러는 `AppError` 형태로 정규화된다. 사용자에게 표시할 때는 `String(e)` 대신 `toAppError(e).message`를 사용한다.

```tsx
import Alert from '@mui/material/Alert'
import { toAppError } from '@/lib/errors'

const [errorMessage, setErrorMessage] = useState('')

try {
  await doSomething()
} catch (e) {
  setErrorMessage(toAppError(e).message)
}

{errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
```

- 페이지 또는 다이얼로그 안에서 유지되어야 하는 오류는 MUI `Alert`로 표시한다.
- 일시적인 작업 실패도 사용자가 이해할 수 있는 메시지로 변환한다.
- `@ts-ignore`나 빈 `catch`로 경고/오류를 숨기지 않는다. 의도적으로 무시하는 경우에도 이유를 코드로 드러낸다.

---

## MUI 테마와 색상

- 전역 테마는 `src/components/AppThemeProvider.tsx`에서 `useSettingsStore().themeMode`를 기준으로 만든다.
- 도메인 상태 색상은 각 컴포넌트 근처의 명확한 상수나 theme token을 사용한다.
- 읽기 어려운 색 조합을 만들지 않는다. 밝은 배경에는 어두운 텍스트, 어두운/채도 높은 배경에는 충분히 대비되는 텍스트를 둔다.
- 아이콘 버튼에는 가능한 MUI icon을 사용하고 `Tooltip`으로 의미를 보완한다.
- 카드 반경은 기존 MUI 기본감과 맞추고, 화면 전체를 카드 안에 다시 넣는 중첩 카드 레이아웃을 피한다.

---

## 성능과 lazy loading

- route body, export dialog, 새 프로젝트 dialog처럼 첫 화면에 항상 필요하지 않은 UI는 `React.lazy`를 우선 고려한다.
- `pnpm build:vite`에서 500 kB 이상 chunk 경고가 발생하면 `.agents/skills/project-structure-review-agent/SKILL.md` 기준으로 route/dialog/editor panel/settings 분리를 검토한다.
- 무거운 계산은 `useMemo`, 자식에 넘기는 안정 콜백은 `useCallback`을 사용하되 단순 primitive 계산에는 남용하지 않는다.
- Canvas/preview 관련 변경은 RAF loop와 media cache cleanup을 함께 확인한다.

---

## 금지 패턴

- `window.confirm()` 또는 MUI `Dialog` 직접 신규 사용
- `routeTree.gen.ts` 직접 편집
- `STORAGE_KEYS`를 거치지 않는 임의 localStorage 키 추가
- 편집 상태를 store 액션 없이 컴포넌트에서 직접 변형
- UI에서 FFmpeg를 직접 호출하거나 export 외 시점의 처리 흐름을 새로 만드는 것
- 실제 코드에 없는 전역 알림, 인증, 운영 모니터링, 서버 장비 도메인 규칙을 재도입하는 것
