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

---

## State 분류 규칙

| 데이터 종류 | 훅 |
|---|---|
| DB 결과, 필터, 선택값, 페이지네이션 | `useStickyState` (SPA 생애 동안 유지) |
| 로딩/에러/다이얼로그 상태 | `useState` |
| 렌더에 불필요한 mutable 값 | `useRef` |

---

## 에러 처리

```tsx
// ✅ tauriInvoke 에러는 AppError 객체 — String() 사용 금지
} catch (e) {
  showSnack(toAppError(e).message, "error");  // ✅
  // showSnack(String(e), "error");           // ❌ "[object Object]" 출력
}
```

---

## 성능 원칙

- 컴포넌트 외부에서 변하지 않는 상수/배열/객체는 **컴포넌트 밖**에 정의
- 무거운 컴포넌트(Monaco Editor 등)는 **동적 import** 고려
- 긴 목록 → DataGrid 사용 (가상화 내장), 직접 `map` 렌더 삼가
- 이벤트 핸들러에서 직접 `setState` 호출 (useEffect를 통한 연쇄 setState 지양)
