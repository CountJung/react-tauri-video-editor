---
description: "TanStack Router 파일 기반 라우트 스캐폴딩 — 얇은 route file, lazy component, ResizableDialog, Tauri IPC wrapper 패턴"
name: "New Route"
argument-hint: "라우트 경로 및 기능 (예: /settings/shortcuts — 단축키 설정 화면)"
agent: "agent"
---

# 새 라우트 스캐폴딩

관련 스킬: [ui-conventions](../skills/ui-conventions/SKILL.md), [react-best-practices](../skills/react-best-practices/SKILL.md)

프로젝트 맵: [PROJECT_MAP.md](../../PROJECT_MAP.md)

---

## 규칙

1. 작업 전 `PROJECT_MAP.md`, `.github/copilot-instructions.md`, `.github/instructions/ui.instructions.md`를 확인한다.
2. 라우트 파일은 `src/routes/<path>.tsx`에 둔다.
3. 라우트 파일은 가능한 얇게 유지하고, 실제 화면 본문은 `src/components/<domain>/<Page>.tsx`로 분리해 `React.lazy`로 로드한다.
4. 라우트 선언은 `createFileRoute('<path>')({ component })` 패턴을 사용한다.
5. `src/routeTree.gen.ts`는 수동 편집하지 않는다.
6. IPC가 필요하면 `tauriInvoke` / `tauriListen` (`src/lib/invoke.ts`)만 사용한다.
7. 팝업은 `ResizableDialog`를 사용하고 `window.confirm()`은 쓰지 않는다.
8. 저장되는 UI 상태는 `src/lib/storageKeys.ts` 상수와 `useStickyState`를 사용한다.
9. Timeline/asset/project 상태 변경은 각 Zustand store 액션을 통해 처리한다.
10. 구조 변경 후 `PROJECT_MAP.md`, 관련 skill/docs, `TODO.md`를 함께 검토한다.

---

## 라우트 파일 예시

```tsx
// src/routes/example.tsx
import Box from '@mui/material/Box'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

export const Route = createFileRoute('/example')({
  component: ExampleRoutePage,
})

const LazyExamplePage = lazy(() =>
  import('@/components/example/ExamplePage').then((module) => ({
    default: module.ExamplePage,
  }))
)

function ExampleRoutePage() {
  return (
    <Suspense fallback={<Box sx={{ flex: 1, bgcolor: 'background.default' }} />}>
      <LazyExamplePage />
    </Suspense>
  )
}
```

## 화면 컴포넌트 예시

```tsx
// src/components/example/ExamplePage.tsx
import { tauriInvoke } from '@/lib/invoke'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useState } from 'react'

interface ExampleDto {
  name: string
}

export function ExamplePage() {
  const [rows, setRows] = useState<ExampleDto[]>([])
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      setError(null)
      setRows(await tauriInvoke<ExampleDto[]>('example_list'))
    } catch (error) {
      setError(error instanceof Error ? error.message : '데이터를 불러오지 못했습니다.')
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  return (
    <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
      <Typography variant="h6">Example</Typography>
      {error ? <Typography color="error">{error}</Typography> : null}
      {rows.map((row) => (
        <Typography key={row.name}>{row.name}</Typography>
      ))}
    </Box>
  )
}
```

---

## 완료 체크리스트

- [ ] 라우트 파일이 얇고 본문 컴포넌트가 lazy-load됨
- [ ] `src/routeTree.gen.ts` 수동 편집 없음
- [ ] IPC wrapper만 사용
- [ ] 팝업은 `ResizableDialog` 사용
- [ ] `PROJECT_MAP.md` 갱신
- [ ] 관련 `.github/skills/**` / docs 검토
- [ ] `pnpm typecheck` / Biome 검증 통과
