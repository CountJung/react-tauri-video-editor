---
description: "Rust Tauri command 추가 스캐폴딩 — AppError, command module, invoke_handler, capability/security 검토"
name: "New Command"
argument-hint: "커맨드 이름과 기능 (예: asset_validate — 미디어 파일 유효성 검사)"
agent: "agent"
---

# 새 Rust Tauri Command 스캐폴딩

관련 스킬: [tauri-backend](../skills/tauri-backend/SKILL.md), [rust-skills](../skills/rust-skills/SKILL.md)

프로젝트 맵: [PROJECT_MAP.md](../../PROJECT_MAP.md)

---

## 규칙

1. 작업 전 `PROJECT_MAP.md`, `.github/copilot-instructions.md`, `.github/instructions/backend.instructions.md`, `.github/skills/tauri-backend/SKILL.md`를 확인한다.
2. 모든 command는 `Result<T, AppError>`를 반환한다.
3. command는 `src-tauri/src/commands/<domain>.rs`에 추가한다.
4. 새 domain 파일을 만들면 `src-tauri/src/commands/mod.rs`에 `pub mod <domain>;`를 추가한다.
5. `src-tauri/src/lib.rs`의 `tauri::generate_handler!` 목록에 등록한다.
6. 프론트엔드는 `tauriInvoke` / `tauriListen` wrapper만 사용한다.
7. 경로 입력은 정규화·존재 여부·확장자·권한 범위를 검증한다.
8. FFmpeg/ffprobe는 sidecar API와 구조화된 args만 사용한다. shell 문자열 조합 금지.
9. 새 플러그인 권한이나 파일 접근이 필요하면 `src-tauri/capabilities/default.json`을 최소 권한으로 갱신한다.
10. 설정값은 하드코딩하지 말고 OS env 또는 `src-tauri/build.rs` allowlist 기반 공개 빌드 설정을 사용한다.

---

## command 예시

```rust
// src-tauri/src/commands/example.rs
use crate::commands::common::AppError;

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExampleDto {
    pub name: String,
}

#[tauri::command]
pub async fn example_list() -> Result<Vec<ExampleDto>, AppError> {
    Ok(vec![ExampleDto {
        name: "example".to_string(),
    }])
}
```

## 모듈 등록

```rust
// src-tauri/src/commands/mod.rs
pub mod example;
```

## invoke handler 등록

```rust
// src-tauri/src/lib.rs
.invoke_handler(tauri::generate_handler![
    commands::example::example_list,
])
```

## 프론트엔드 호출

```ts
import { tauriInvoke } from '@/lib/invoke'

const rows = await tauriInvoke<ExampleDto[]>('example_list')
```

---

## 완료 체크리스트

- [ ] `Result<T, AppError>` 반환
- [ ] `commands/mod.rs`와 `lib.rs` 등록 완료
- [ ] frontend는 `tauriInvoke` wrapper만 사용
- [ ] 경로/권한/security 검토 완료
- [ ] capability 변경 시 최소 권한 유지
- [ ] `PROJECT_MAP.md` 및 관련 skill/docs 갱신
- [ ] `cargo fmt --check`
- [ ] `cargo check`
- [ ] `cargo clippy -- -D warnings`
