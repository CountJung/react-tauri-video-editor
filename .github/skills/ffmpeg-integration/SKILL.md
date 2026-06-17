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
- Sidecar 배포 검증은 `pnpm verify:ffmpeg-sidecars`로 현재 호스트의 파일명과 `-version` 실행을 확인한다. 릴리즈 전 전체 대상 파일 배치 검증은 `pnpm install-ffmpeg:all` 후 `pnpm verify:ffmpeg-sidecars:all`을 사용한다.
- ffbinaries 6.1은 native macOS arm64 빌드를 제공하지 않으므로 `aarch64-apple-darwin` sidecar 파일명에는 `osx-64` 호환 바이너리를 배치한다. Apple Silicon 릴리즈 CI에서 `pnpm verify:ffmpeg-sidecars`로 실제 실행 가능성을 확인해야 한다.

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

- `ffmpeg.rs`: Tauri command, FFmpeg sidecar 실행, filter graph assembly, 진행률 파싱.
- `ffmpeg/probe.rs`: export 직전 ffprobe 기반 base clip audio stream 감지.
- `ffmpeg/types.rs`: payload DTO와 내부 export plan 타입.
- `ffmpeg/tests.rs`: filter graph 문자열 계약 테스트.
- `ffmpeg/validation.rs`: export plan validation helper.
- `src/components/preview/exportPayload.ts`: ExportDialog payload builder와 출력 해상도/FPS 스케일링 helper.
- `src/components/preview/exportPayload.test.ts`: 대표 프로젝트 fixture로 Canvas Preview 활성 레이어 모델과 Export payload 모델의 레이어 순서/좌표/스타일 스케일 일치성을 검증.

### Export 요청 타입

```rust
#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTimelinePayload {
    pub project_meta: ExportProjectMeta,
    pub tracks: Vec<ExportTrack>,
    pub assets: Vec<ExportAsset>,
}

#[derive(serde::Deserialize)]
pub struct ClipExportInfo {
    pub asset_path: String,
    pub trim_start: f64,
    pub trim_end: f64,
    pub timeline_start: Option<f64>,
    pub timeline_duration: Option<f64>,
    // Phase 5 Canvas fit/crop metadata. Frontend sends these from ExportDialog.
    pub fit_mode: Option<String>, // fit | fill | stretch | center | crop
    pub crop_x: Option<f64>,
    pub crop_y: Option<f64>,
    pub crop_width: Option<f64>,
    pub crop_height: Option<f64>,
    pub canvas_width: Option<u32>,
    pub canvas_height: Option<u32>,
}

#[derive(serde::Serialize, Clone)]
pub struct FfmpegProgress {
    pub percent: f32,
    pub current_time: f32,
    pub total_time: f32,
}
```

`ffmpeg_export`는 현재 `payload: ExportTimelinePayload`를 우선 사용해 `projectMeta + tracks + assets` 전체 모델을 받는다. 레거시 호환을 위해 `clips: Option<Vec<ClipExportInfo>>`도 남겨 두되, 프론트엔드는 `tauriInvoke('ffmpeg_export', { outputPath, payload })` 형태로 호출한다.
ExportDialog는 출력 width/height/FPS 옵션을 제공하고, 선택한 값으로 `projectMeta.canvasWidth/canvasHeight/fps`를 override한다. 출력 해상도가 현재 캔버스와 다르면 프론트엔드에서 payload tracks의 clip bounds, text font/shadow/outline, shape stroke/corner radius를 비율에 맞게 스케일링한 뒤 Rust로 전달한다.
payload 기반 Export는 비디오 트랙 클립을 `start` 순으로 정렬하고, 클립 사이의 빈 구간은 `color=black` + `anullsrc` 세그먼트로 filter graph에 삽입한다. 겹침은 현재 timeline store의 충돌 방지 결과를 전제로 하며, Export 쪽에서는 시작 시간이 이전 세그먼트보다 빠른 클립을 추가 겹침 없이 순차 concat한다.
`visible=false` 트랙은 export plan 생성 단계에서 제외한다. 이 정책은 video/overlay/text/shape 트랙 모두에 동일하게 적용한다.
overlay 트랙의 이미지/비디오 클립은 base concat 결과 `[basev]` 위에 `overlay` 필터로 합성한다. 입력 순서는 base 비디오 클립 이후 overlay 클립이며, 이미지 overlay는 `-loop 1 -t {duration}`, 비디오 overlay는 `-ss {trimStart} -t {timelineDuration}`로 입력한다. 각 overlay는 `fitMode`/`cropRect`/bounds를 적용한 뒤 `format=rgba,colorchannelmixer=aa={opacity}`로 투명도를 반영하고, `enable='between(t,{start},{end})'`로 타임라인 구간에만 표시한다.
text 트랙은 별도 입력 없이 `drawtext` 필터를 base/overlay 결과 위에 burn-in한다. `textProps.text/fontFamily/fontSize/color/align/outline/shadow`와 clip bounds, track/clip opacity를 `drawtext=text=...:font=...:fontsize=...:fontcolor=...:alpha=...:x=...:y=...:enable=...`로 변환한다. overlay와 text는 `zIndex`/`start` 순으로 하나의 visual layer 체인에 적용해야 프리뷰 레이어 순서와 맞는다. `drawtext` 문자열은 filtergraph 특수문자(`:`, `,`, `'`, `%`, `[]`, `;`, `\`)를 escape한다.
shape 트랙은 `shapeProps.shapeType`에 따라 export한다. `rect`는 `drawbox` fill/stroke 체인으로 burn-in하고, `circle`/`arrow`는 투명 RGBA `color` source에 `geq` alpha mask를 만든 뒤 `overlay`한다. shape도 overlay/text와 같은 visual layer 체인에서 `zIndex`/`start` 순으로 적용한다. `cornerRadius`와 dash 스타일은 현재 export에서 사각형/실선으로 근사하며, 고정밀 rounded/dashed export가 필요하면 별도 TODO로 분리한다.
audio 트랙은 clip별 `-ss/-t -i` 입력을 추가하고, `asetpts=PTS-STARTPTS,adelay={startMs}:all=1,volume={gain}` 후 `amix=inputs=N:duration=first:normalize=0`으로 base audio와 믹싱한다. base video clip은 export 직전 ffprobe로 audio stream 여부를 감지해, stream이 있으면 `[input:a]asetpts=...`를 사용하고 없으면 같은 길이의 `anullsrc=channel_layout=stereo:sample_rate=48000`을 생성한다. 이 fallback 덕분에 오디오 없는 비디오/이미지성 입력도 export graph가 깨지지 않는다.

### Canvas fitMode Export 필터

- `fit`: `scale=...:force_original_aspect_ratio=decrease` 후 `pad`로 캔버스 중앙 정렬.
- `fill`: `scale=...:force_original_aspect_ratio=increase` 후 `crop`으로 캔버스 채움.
- `stretch`: 비율 무시 `scale={canvas_w}:{canvas_h}`.
- `center`: 원본보다 큰 경우만 축소하고 `pad`로 중앙 배치.
- `crop`: `crop_x/y/width/height`가 있으면 `crop` 후 캔버스 크기로 `scale`.

Export는 프리뷰 중이 아니라 Export 시점에만 FFmpeg를 호출해야 하며, 프론트엔드 `Clip.fitMode`/`cropRect`/캔버스 크기와 Rust `ClipExportInfo` 필드를 함께 갱신한다.

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

    const payload = { projectMeta, tracks, assets }
    await tauriInvoke('ffmpeg_export', { outputPath, payload })
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
