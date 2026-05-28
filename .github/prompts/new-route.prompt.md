---
description: "TanStack Router 파일 기반 라우트 스캐폴딩 — IPC 호출·ResizableDialog·useStickyState·DataGrid 패턴 포함"
name: "New Route"
argument-hint: "라우트 경로 및 기능 (예: /mmc/config — MMC 설정 관리 페이지)"
agent: "agent"
---

# 새 라우트 스캐폴딩

관련 스킬: [ui-conventions](../.github/skills/ui-conventions/SKILL.md), [ui-table-patterns](../.github/skills/ui-table-patterns/SKILL.md), [react-best-practices](../.github/skills/react-best-practices/SKILL.md)

프로젝트 맵: [docs/project-map.md](../../docs/project-map.md)

---

## 규칙 (항상 준수)

1. **파일 위치**: `src/routes/<path>.tsx` — URL이 자동으로 파일 경로에서 생성됨.
2. **라우트 선언**: `createFileRoute("<path>")({ component: PageName })` 패턴 필수.
3. **IPC**: `tauriInvoke` / `tauriListen` (`src/lib/invoke.ts`) 만 사용. `@tauri-apps/api/core` 직접 import 금지.
4. **다이얼로그**: `ResizableDialog` 사용 (`src/components/ResizableDialog.tsx`). MUI `Dialog` 직접 사용 금지.
5. **confirm**: `window.confirm()` 금지 — confirmDialog state + `ResizableDialog` 패턴 사용.
6. **storageKey**: `src/lib/storageKeys.ts`에 상수 추가 후 참조.
7. **DataGrid**: `useDataGridColumnState` + `CustomColumnsPanel` + `DataGridPagination` 조합.
8. **에러**: `toAppError()` + `showSnack()` 패턴.
9. **breadcrumb**: `beforeLoad: () => ({ breadcrumb: "페이지 이름" })` 추가.
10. `src/routeTree.gen.ts` 수동 편집 금지 — `pnpm dev:vite` 실행 시 자동 재생성.

---

## 스캐폴딩 절차

### 1. 라우트 파일 생성

```tsx
// src/routes/<domain>/<name>.tsx
import { Container, Typography } from "@mui/material";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSnack } from "../../context/SnackbarContext";
import { tauriInvoke } from "../../lib/invoke";
import { toAppError } from "../../lib/errors";
// DataGrid를 사용하는 경우:
// import { DataGrid, type GridColDef } from "@mui/x-data-grid";
// import { CustomColumnsPanel } from "../../components/CustomColumnsPanel";
// import { DataGridPagination } from "../../components/DataGridPagination";
// import { useDataGridColumnState } from "../../hooks/useDataGridColumnState";
// import { useStickyState } from "../../hooks/useStickyState";
// import { MY_TABLE_STORAGE_KEY } from "../../lib/storageKeys";

export const Route = createFileRoute("/<path>")({
  beforeLoad: () => ({ breadcrumb: "페이지 이름" }),
  component: MyPage,
});

// ── 타입 ──────────────────────────────────────────────────────

type MyDto = {
  id: number;
  name: string;
};

// ── 상수 (DataGrid 컬럼은 모듈 레벨에 선언) ─────────────────

// const COLUMNS: GridColDef[] = [
//   { field: "id", headerName: "ID", width: 80 },
//   { field: "name", headerName: "Name", width: 200 },
// ];

// ── 컴포넌트 ─────────────────────────────────────────────────

function MyPage() {
  const { showSnack } = useSnack();
  const [rows, setRows] = useState<MyDto[]>([]);
  const [loading, setLoading] = useState(false);

  // DataGrid 컬럼 상태 (필요 시)
  // const { apiRef, orderedColumns, onColumnWidthChange, reorderColumns, orderKey, fontSize, setFontSize } =
  //   useDataGridColumnState(MY_TABLE_STORAGE_KEY, COLUMNS);
  // const ColumnsPanel = useMemo(
  //   () => () => <CustomColumnsPanel reorderColumns={reorderColumns} />,
  //   [reorderColumns],
  // );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tauriInvoke<MyDto[]>("my_command");
      setRows(data);
    } catch (e) {
      showSnack(toAppError(e).message, "error");
    } finally {
      setLoading(false);
    }
  }, [showSnack]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  return (
    <Container maxWidth="xl" sx={{ py: 2 }}>
      <Typography variant="h6" gutterBottom>
        페이지 제목
      </Typography>
      {/* 콘텐츠 */}
    </Container>
  );
}
```

### 2. storageKey 추가 (DataGrid 사용 시)

`src/lib/storageKeys.ts`에 추가:
```ts
export const MY_TABLE_STORAGE_KEY = "my-table";
```

### 3. docs/project-map.md §2 라우트 테이블 업데이트

```md
| `/domain/name` | `domain/name.tsx` | ui-table-patterns |
```

### 4. `pnpm dev:vite` 실행 → `src/routeTree.gen.ts` 자동 재생성 확인

---

## 체크리스트

- [ ] `createFileRoute` 경로가 실제 파일 경로와 일치
- [ ] `beforeLoad` breadcrumb 설정
- [ ] `tauriInvoke` 만 사용 (직접 import 없음)
- [ ] DataGrid 사용 시: `key={orderKey}` + `CustomColumnsPanel` + `DataGridPagination`
- [ ] storageKey 상수가 `storageKeys.ts`에 추가됨
- [ ] `docs/project-map.md` 라우트 테이블 업데이트
- [ ] TS/Biome 에러 0
