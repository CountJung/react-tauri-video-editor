# 작업 템플릿

> 파일명 권장: `tasks/TASK-<번호>-<짧은-slug>.md`. 체크박스는 실제 확인 후에만 완료한다.

## 1. 메타데이터

- 작업 ID:
- 제목:
- 담당자/에이전트:
- 상태: `대기 | 진행 중 | 차단 | 검토 | 완료`
- 관련 issue/PR:
- 대상 branch:
- 작성/갱신일:

## 2. 배경과 목표

### 문제

<!-- 현재 사용자 문제와 재현 가능한 증상을 적는다. -->

### 완료 결과

<!-- 사용자가 관찰할 수 있는 결과를 1~3문장으로 적는다. -->

### 비목표

-

## 3. 시작 기준선

```text
git branch --show-current:
git status --short:
git remote -v:
```

### 기존 사용자 변경

- 없음 / 다음 파일은 작업 전부터 변경됨:
  -

> 기존 변경을 덮어쓰거나 되돌리지 않는다.

## 4. 조사 지도

- 먼저 읽을 문서: `AGENTS.md`, `PROJECT_MAP.md`, `ARCHITECTURE.md`, `HARNESS_MAP.md`
- 관련 진입점:
  -
- 관련 상태 소유자(store/component/Rust module):
  -
- 적용할 `.github/instructions`/skill:
  -
- 건드리지 않을 생성물/경계:
  - `src/routeTree.gen.ts` 수동 편집 금지
  - `dist/`, `src-tauri/target/`, `src-tauri/gen/schemas/`, `._*`

## 5. 요구사항과 수용 기준

- [ ] 기능/문서 요구사항 1
- [ ] 오류/빈 상태/브라우저-vs-Tauri 경계 처리
- [ ] state owner와 IPC/AppError 계약 유지
- [ ] cleanup(unlisten/RAF/timer/blob/media resource) 확인
- [ ] 관련 문서와 `TODO.md` 상태 동기화
- [ ] 기존 동작 회귀 없음

## 6. 구현 계획

1.
2.
3.

### 계약 영향표

| 계약 | 영향 | 함께 바꿀 곳/검증 |
|---|---|---|
| Track/Clip/Asset/Project schema | 없음/있음 | serializer, Canvas, export DTO |
| Tauri command/payload | 없음/있음 | `invoke.ts` caller, `lib.rs`, AppError |
| Tauri event | 없음/있음 | emit/listen/unlisten |
| sidecar/config | 없음/있음 | downloader, verifier, `tauri.conf.json`, workflow |
| route/structure | 없음/있음 | route generation, `PROJECT_MAP.md` |

## 7. 검증 계획과 결과

외장 볼륨에서는 먼저:

```bash
export CARGO_TARGET_DIR="$HOME/.cache/react-tauri-video-editor-target"
pnpm verify:cargo-target
```

| 명령/수동 시나리오 | 필요 여부 | 결과/증거 |
|---|---:|---|
| `pnpm lint` | 예 | 미실행 |
| `pnpm typecheck` | 예 | 미실행 |
| `pnpm test -- --run` | 예 | 미실행 |
| `pnpm build:vite` | 예 | 미실행 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | Rust 변경 시 | 미실행/해당 없음 |
| `cargo check --manifest-path src-tauri/Cargo.toml` | Rust 변경 시 | 미실행/해당 없음 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust 변경 시 | 미실행/해당 없음 |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | Rust 변경 시 | 미실행/해당 없음 |
| `pnpm verify:ffmpeg-sidecars` | FFmpeg/Tauri bundle 시 | 미실행/해당 없음 |
| 브라우저 UI smoke (`127.0.0.1:1420`) | UI 변경 시 | 미실행/해당 없음 |
| Tauri/실제 export smoke | native/FFmpeg 변경 시 | 미실행/해당 없음 |

### 테스트 fixture/재현 절차

1.
2.
3.

## 8. 위험과 롤백

- 회귀 위험:
- 데이터/프로젝트 파일 호환성:
- 플랫폼 차이(macOS/Windows/Linux):
- 롤백 단위:

## 9. 완료/인계

- 변경 파일:
  -
- 남은 차단/후속 작업:
  - 없음 /
- 실행하지 못한 검증과 이유:
  - 없음 /
- commit/push 여부:
  - 수행하지 않음 / 사용자 요청에 따라 수행
