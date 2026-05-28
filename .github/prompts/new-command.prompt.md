---
description: "Rust Tauri command 추가 스캐폴딩 — AppError, lib.rs 등록, HTTP bridge dispatch, DB 쿼리, 환경변수 패턴 포함"
name: "New Command"
argument-hint: "커맨드 이름과 기능 (예: my_item_list — 아이템 목록 조회)"
agent: "agent"
---

# 새 Rust Tauri Command 스캐폴딩

관련 스킬: [tauri-backend](../.github/skills/tauri-backend/SKILL.md), [rust-skills](../.github/skills/rust-skills/SKILL.md)

프로젝트 맵: [docs/project-map.md](../../docs/project-map.md)

---

## 규칙 (항상 준수)

1. **반환 타입**: 모든 command는 `Result<T, AppError>` 반환 (`common.rs`).
2. **모듈 위치**: `src-tauri/src/commands/<domain>.rs` — 기존 도메인 파일에 추가하거나 새 파일 생성.
3. **등록**: `commands/mod.rs` 모듈 선언 + `lib.rs` `invoke_handler!` 목록 추가.
4. **HTTP bridge**: `http_server.rs`의 `dispatch()` 또는 `dispatch_db()` match 암에 추가.
5. **camelCase 폴백**: HTTP bridge args는 `str_arg2(args, "camelKey", "snake_key")` 사용.
6. **환경변수 하드코딩 금지**: 주기·포트·URL은 `.env` → `std::env::var` 사용.
7. **DB 쿼리 로깅**: 실행 직전 `log::info!("[cmd_name] SQL: {} | params: {:?}", sql, params)`.
8. **완료 후 확인**: `cargo check` / `cargo clippy` 경고 0.

---

## 스캐폴딩 절차

### 1. command 함수 작성 (`src-tauri/src/commands/<domain>.rs`)

```rust
use super::common::AppError;
use crate::database::DbPool;
use serde::{Deserialize, Serialize};
use tauri::State;

/// 반환 DTO
#[derive(Debug, Serialize, Deserialize)]
pub struct MyItemDto {
    pub id: i64,
    pub name: String,
}

/// command 구현
#[tauri::command]
pub async fn my_item_list(
    db: State<'_, DbPool>,
    // 필요 시: mmc: State<'_, Arc<MmcClient>>,
) -> Result<Vec<MyItemDto>, AppError> {
    let pool = db.sub_schema(); // 또는 db.main_schema() (차트/대시보드)
    let sql = "SELECT id, name FROM MY_TABLE ORDER BY id";
    log::info!("[my_item_list] SQL: {}", sql);

    let rows = sqlx::query_as::<_, MyItemDto>(sql)
        .fetch_all(pool)
        .await
        .map_err(|e| AppError::database(e.to_string()))?;

    Ok(rows)
}
```

### 2. 모듈 등록 (`src-tauri/src/commands/mod.rs`)

기존 도메인 파일에 추가하거나 새 파일이면:
```rust
pub mod my_domain;  // 새 파일인 경우만
pub use my_domain::my_item_list;  // 재내보내기
```

### 3. `lib.rs` invoke_handler 등록

```rust
tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        // ... 기존 커맨드들
        commands::my_item_list,  // 추가
    ])
```

### 4. HTTP bridge 등록 (`src-tauri/src/http_server.rs`)

**DB 커맨드** → `dispatch_db()` match 암:
```rust
"my_item_list" => {
    let rows = commands::my_item_list(db.into()).await?;
    serde_json::to_value(rows).map_err(|e| AppError::internal(e.to_string()))
}
```

**camelCase 인자가 있는 경우**:
```rust
"my_item_get" => {
    let id = str_arg2(&args, "itemId", "item_id")
        .ok_or_else(|| AppError::invalid_argument("itemId required"))?
        .parse::<i64>()
        .map_err(|_| AppError::invalid_argument("itemId must be integer"))?;
    let row = commands::my_item_get(db.into(), id).await?;
    serde_json::to_value(row).map_err(|e| AppError::internal(e.to_string()))
}
```

### 5. 프론트엔드 호출

```ts
// src/routes/<domain>/<page>.tsx
import { tauriInvoke } from "../../lib/invoke";

const items = await tauriInvoke<MyItemDto[]>("my_item_list");
```

### 6. docs/project-map.md §3 커맨드 맵 업데이트

```md
| `my_domain.rs` | `my_item_list`, `my_item_get` | 내 도메인 |
```

---

## 체크리스트

- [ ] `Result<T, AppError>` 반환
- [ ] `commands/mod.rs` 모듈 선언
- [ ] `lib.rs` `invoke_handler!` 등록
- [ ] `http_server.rs` dispatch 암 추가
- [ ] camelCase 인자 → `str_arg2` 사용
- [ ] DB 쿼리 `log::info!` 로깅
- [ ] 환경변수 하드코딩 없음
- [ ] `cargo check` / `cargo clippy` 경고 0
- [ ] `docs/project-map.md` 커맨드 맵 업데이트
