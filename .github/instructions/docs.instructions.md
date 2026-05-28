---
applyTo: "docs/**,AGENTS.md,.github/**"
---

# 문서 동기화 지침

> **살아있는 문서** — 이 파일 자체도 규칙 변경 시 동기화한다.

---

## 살아있는 문서 체계

이 프로젝트의 모든 문서는 "살아있다" — 소스 변경 시 관련 문서를 **반드시 함께 업데이트**한다.

| 문서 | 내용 | 갱신 트리거 |
|---|---|---|
| `AGENTS.md` (루트) | 핵심 규칙, 스택 요약, 체크리스트 | 핵심 규칙 변경 |
| `docs/project-map.md` | 레이어 구조, 라우트 맵, 커맨드 맵, 환경변수 | 라우트/command/ENV 추가·변경 |
| `docs/Guide.md` | 설치·설정·배포 절차 | 빌드·배포 절차 변경 |
| `.github/copilot-instructions.md` | 코파일럿 핵심 지침 | 핵심 규칙 변경 |
| `.github/skills/*/SKILL.md` | 도메인별 상세 패턴 | 해당 도메인 패턴 변경 |
| `.github/instructions/*.md` | 파일 범위별 자동 지침 | 지침 내용 변경 |

## 문서 업데이트 규칙

1. Rust command 추가/변경 → `tauri-backend` SKILL.md + `docs/project-map.md`
2. 환경변수 추가 → `docs/project-map.md` 환경변수 맵
3. 라우트 추가/삭제 → `docs/project-map.md` 라우트 구조
4. Timeline/Track/Clip 구조 변경 → `timeline-editor` SKILL.md
5. FFmpeg 명령 패턴·진행률 이벤트 변경 → `ffmpeg-integration` SKILL.md
6. UI 레이아웃·상태 보존 패턴 변경 → `ui-conventions` SKILL.md
7. 핵심 규칙 변경 → `AGENTS.md` + `.github/copilot-instructions.md`
8. 빌드·배포 절차 변경 → `docs/Guide.md`

## MD 다이어그램 규칙

- Unicode 박스 문자(┌─│ 등)와 한글을 같은 고정폭 박스 안에 혼용 금지.
- 아키텍처 다이어그램은 **Mermaid** 또는 ASCII 전용(`+`, `-`, `|`) 박스 사용.
- 트리(`├─`, `└─`) 구조에서 한글 라벨은 허용.
