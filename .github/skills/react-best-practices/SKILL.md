---
name: react-best-practices
description: React + Tauri 프로젝트 성능 최적화 핵심 규칙. 리렌더 최적화, useMemo/useCallback, 비동기 패턴, localStorage, 에러. Keywords: React, useMemo, useCallback, useEffect, useState, memo, performance, re-render, async, tauriInvoke
---
# React Best Practices (Tauri 프로젝트 맞춤)

> 이 프로젝트는 **React 19 + Tauri 2.0** (SSR/Server Components 없음). Next.js 전용 규칙은 적용 불가.

---

## 리렌더 최적화

```tsx
// ✅ 파생 값은 useMemo (비싼 계산 또는 참조 동일성 필요 시)
const filteredItems = useMemo(() => items.filter(i => i.active), [items]);

// ✅ 콜백은 useCallback (자식 컴포넌트에 전달하거나 deps 안정화 필요 시)
const handleDelete = useCallback(async (id: string) => {
  await tauriInvoke("item_delete", { id });
  await loadItems();
}, [loadItems]);

// ❌ 단순 primitive 계산에 useMemo 금지
const count = useMemo(() => items.length, [items]); // 불필요
const count = items.length; // ✅
```

---

## 비동기 호출 패턴

```tsx
// ✅ 독립 호출은 병렬 (Promise.all)
const [a, b] = await Promise.all([
  tauriInvoke<TypeA>("cmd_a"),
  tauriInvoke<TypeB>("cmd_b"),
]);

// ❌ 순차 async (waterfall)
const a = await tauriInvoke<TypeA>("cmd_a");
const b = await tauriInvoke<TypeB>("cmd_b");
```

---

## useEffect 규칙

```tsx
// ✅ 의존성 최소화 — 함수는 useCallback으로 안정화
const loadData = useCallback(async () => {
  const rows = await tauriInvoke<Row[]>("list_rows");
  setRows(rows);
}, []);

useEffect(() => { void loadData(); }, [loadData]);

// ✅ cleanup 필수 (타이머·구독)
useEffect(() => {
  const id = setInterval(() => void loadData(), 5000);
  return () => clearInterval(id);
}, [loadData]);
```

### 미디어/RAF cleanup

- PreviewPlayer의 video/image cache는 asset 삭제, 프로젝트 로드, 컴포넌트 unmount 시 `src`와 이벤트 핸들러를 해제하고 map을 비운다.
- 브라우저 fallback에서 생성한 `blob:` URL은 AssetStore에서 asset이 제거되거나 교체될 때 `URL.revokeObjectURL()`로 해제한다.
- Canvas redraw는 재생 중에만 RAF loop를 유지한다. 정지 상태에서는 timeline/asset/selection/canvas 입력이 바뀌거나 media load/seek가 끝났을 때 한 프레임만 예약한다.
- 새 media cache를 추가할 때는 asset id만 보지 말고 source URL 변경도 감지해 오래된 element를 release한다.

---

## State 분류 규칙

| 데이터 종류 | 훅 |
|---|---|
| 작은 UI 설정, 패널 크기, zoom, 선택값 | `useStickyState` (localStorage 유지) |
| 로딩/에러/다이얼로그 상태 | `useState` |
| 렌더에 불필요한 mutable 값 | `useRef` |

---

## 에러 처리

```tsx
// ✅ tauriInvoke 에러는 AppError 객체 — String() 사용 금지
} catch (e) {
  setErrorMessage(toAppError(e).message);  // ✅
  // setErrorMessage(String(e));           // ❌ "[object Object]" 출력
}
```

---

## 성능 원칙

- 컴포넌트 외부에서 변하지 않는 상수/배열/객체는 **컴포넌트 밖**에 정의
- 무거운 route body/dialog/editor panel/settings/media tool은 **동적 import** 고려
- `pnpm build:vite`에서 500kB+ chunk 경고가 발생하면 `$project-structure-review-agent` 기준으로 구조를 검토하고, route body/dialog/editor panel/settings/media tool을 `React.lazy` 또는 동적 `import()`로 먼저 분리한다.
- 경고 제거만을 위해 `build.chunkSizeWarningLimit`를 올리는 것은 마지막 수단이다. Tauri 데스크톱 번들에서 허용 가능한 크기라는 판단과 기록이 있을 때만 사용한다.
- 긴 목록 → 페이지네이션, 가상화, 또는 행 단위 memoization을 검토하고 무제한 `map` 렌더를 피한다
- 이벤트 핸들러에서 직접 `setState` 호출 (useEffect를 통한 연쇄 setState 지양)
