---
name: ffmpeg-integration
description: FFmpeg sidecar 실행, 영상 Export, 썸네일 생성, 진행률 이벤트, FFmpeg 명령 패턴. Keywords: ffmpeg, export, thumbnail, progress, sidecar, concat, trim, encode, ffprobe
---
# FFmpeg Integration Skill

## 핵심 원칙

- FFmpeg는 **Export 시에만** 호출 — 편집 중 실시간 FFmpeg 처리 금지.
- 모든 FFmpeg 실행은 `src-tauri/src/commands/ffmpeg.rs`에서 관리.
- 진행률은 `ffmpeg-progress` 이벤트로 프론트에 실시간 전달.
- 장시간 작업은 blocking 금지 — 비동기 spawn + 이벤트 스트림.

---

## Export 파이프라인

```
[Timeline State]
  ↓ Export 버튼 클릭
[build_ffmpeg_args(clips)]
  ↓
[FFmpeg sidecar spawn]
  ↓ stderr → parse_ffmpeg_progress → "ffmpeg-progress" emit
  ↓ terminated → "ffmpeg-done" emit
[출력 파일 저장 완료]
```

---

## FFmpeg 명령 패턴

### 단일 클립 자르기

```bash
ffmpeg -ss {trimStart} -i {input} -t {duration} -c:v copy -c:a copy {output}
```

### 다중 클립 concat (filter_complex)

```bash
ffmpeg \
  -i clip1.mp4 -i clip2.mp4 -i clip3.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" \
  -c:v libx264 -crf 23 -c:a aac \
  output.mp4
```

### Export 전략 (2단계)

1. **1단계**: 각 클립을 개별 temp 파일로 Trim (`-ss -t -c copy`)
2. **2단계**: temp 파일들을 concat (`concat demuxer` 또는 `filter_complex`)

```bash
# concat demuxer (재인코딩 없음 — 동일 코덱일 때 빠름)
# concat_list.txt:
file '/tmp/clip1.mp4'
file '/tmp/clip2.mp4'

ffmpeg -f concat -safe 0 -i concat_list.txt -c copy output.mp4
```

---

## Rust 구현 (`src-tauri/src/commands/ffmpeg.rs`)

### Export 요청 타입

```rust
#[derive(serde::Deserialize)]
pub struct ClipExportInfo {
    pub asset_path: String,
    pub trim_start: f64,
    pub trim_end: f64,
}

#[derive(serde::Serialize, Clone)]
pub struct FfmpegProgress {
    pub percent: f32,
    pub current_time: f32,
    pub total_time: f32,
}
```

### 진행률 파싱

```rust
fn parse_ffmpeg_progress(line: &[u8], total_duration: f64) -> Option<FfmpegProgress> {
    let s = std::str::from_utf8(line).ok()?;
    // FFmpeg stderr 예: "frame=  120 fps= 30 q=28.0 size=  1024kB time=00:00:04.00 ..."
    let time_pos = s.find("time=")?;
    let time_str = &s[time_pos + 5..time_pos + 5 + 11]; // "HH:MM:SS.ms"
    let current = parse_time(time_str)?;
    let percent = (current / total_duration * 100.0).min(100.0) as f32;
    Some(FfmpegProgress { percent, current_time: current as f32, total_time: total_duration as f32 })
}

fn parse_time(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.split(':').collect();
    if parts.len() != 3 { return None; }
    let h: f64 = parts[0].parse().ok()?;
    let m: f64 = parts[1].parse().ok()?;
    let s: f64 = parts[2].parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}
```

---

## 썸네일 생성

### Rust Command

```rust
#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    asset_path: String,
    time_sec: f64,        // 썸네일 추출 시점 (초)
    output_path: String,
) -> Result<String, AppError> {
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args([
            "-ss", &format!("{:.3}", time_sec),
            "-i", &asset_path,
            "-vframes", "1",
            "-vf", "scale=160:-1",   // 썸네일 너비 160px
            "-q:v", "3",
            "-y",                    // 덮어쓰기
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| AppError::new("THUMBNAIL_FAILED", e.to_string()))?;
    app.emit(EVENT_THUMBNAIL_READY, &output_path).ok();
    Ok(output_path)
}
```

### 일괄 썸네일 생성 (에셋 임포트 시)

```rust
#[tauri::command]
pub async fn generate_thumbnails_batch(
    app: tauri::AppHandle,
    asset_paths: Vec<String>,
    output_dir: String,
) -> Result<(), AppError> {
    for path in asset_paths {
        let stem = std::path::Path::new(&path)
            .file_stem().unwrap_or_default().to_string_lossy();
        let output = format!("{}/{}.jpg", output_dir, stem);
        // 영상 중간 지점(duration/2) 추출 — ffprobe로 duration 먼저 조회
        let _ = generate_thumbnail(app.clone(), path, 1.0, output).await;
    }
    Ok(())
}
```

---

## ffprobe — 미디어 메타데이터 추출

```rust
#[derive(serde::Deserialize, serde::Serialize)]
pub struct AssetMeta {
    pub duration: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub codec_name: Option<String>,
}

#[tauri::command]
pub async fn asset_probe(
    app: tauri::AppHandle,
    path: String,
) -> Result<AssetMeta, AppError> {
    use tauri_plugin_shell::ShellExt;
    let output = app.shell()
        .sidecar("ffprobe")
        .map_err(|e| AppError::new("FFPROBE_NOT_FOUND", e.to_string()))?
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_streams",
            "-show_format",
            &path,
        ])
        .output()
        .await
        .map_err(|e| AppError::new("PROBE_FAILED", e.to_string()))?;

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| AppError::new("PROBE_PARSE", e.to_string()))?;

    let duration = json["format"]["duration"]
        .as_str()
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);

    let video_stream = json["streams"].as_array()
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "video"));

    Ok(AssetMeta {
        duration,
        width: video_stream.and_then(|s| s["width"].as_u64()).map(|v| v as u32),
        height: video_stream.and_then(|s| s["height"].as_u64()).map(|v| v as u32),
        codec_name: video_stream.and_then(|s| s["codec_name"].as_str()).map(String::from),
    })
}
```

---

## 프론트엔드 — Export 훅

```ts
// src/hooks/useExport.ts
import { tauriInvoke, tauriListen } from '@/lib/invoke'
import { useTimelineStore } from '@/store/timelineStore'

export function useExport() {
  const [progress, setProgress] = useState(0)
  const [isExporting, setIsExporting] = useState(false)

  async function startExport(outputPath: string) {
    const { tracks } = useTimelineStore.getState()
    const clips = buildExportClips(tracks)

    setIsExporting(true)
    setProgress(0)

    const unlistenProgress = await tauriListen<{ percent: number }>('ffmpeg-progress', e => {
      setProgress(e.payload.percent)
    })
    const unlistenDone = await tauriListen('ffmpeg-done', () => {
      setIsExporting(false)
      setProgress(100)
      unlistenProgress()
      unlistenDone()
    })

    await tauriInvoke('ffmpeg_export', { outputPath, clips })
  }

  return { startExport, progress, isExporting }
}
```

---

## FFmpeg 바이너리 준비 (개발 환경)

```
src-tauri/
  binaries/
    ffmpeg-x86_64-pc-windows-msvc.exe   # Windows
    ffprobe-x86_64-pc-windows-msvc.exe
    ffmpeg-x86_64-apple-darwin          # macOS Intel
    ffprobe-x86_64-apple-darwin
    ffmpeg-aarch64-apple-darwin         # macOS Apple Silicon
    ffprobe-aarch64-apple-darwin
```

- 파일명 규칙: `{name}-{target_triple}{.exe}`
- Tauri가 현재 플랫폼에 맞는 바이너리 자동 선택.
- `.gitignore`에 바이너리 추가, CI에서 다운로드 스크립트 실행.
