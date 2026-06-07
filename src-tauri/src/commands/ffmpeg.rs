use crate::commands::common::{
    AppError, EVENT_FFMPEG_DONE, EVENT_FFMPEG_ERROR, EVENT_FFMPEG_PROGRESS, EVENT_THUMBNAIL_READY,
};
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

#[derive(Debug, serde::Deserialize)]
pub struct ClipExportInfo {
    pub asset_path: String,
    pub trim_start: f64,
    pub trim_end: f64,
    pub fit_mode: Option<String>,
    pub crop_x: Option<f64>,
    pub crop_y: Option<f64>,
    pub crop_width: Option<f64>,
    pub crop_height: Option<f64>,
    pub canvas_width: Option<u32>,
    pub canvas_height: Option<u32>,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct FfmpegProgress {
    pub percent: f32,
    pub current_time: f32,
    pub total_time: f32,
}

/// 타임라인 클립들을 하나의 영상으로 Export
#[tauri::command]
pub async fn ffmpeg_export(
    app: tauri::AppHandle,
    output_path: String,
    clips: Vec<ClipExportInfo>,
) -> Result<(), AppError> {
    if clips.is_empty() {
        return Err(AppError::new("NO_CLIPS", "No clips to export"));
    }

    validate_export_clips(&clips)?;

    let total_duration: f64 = clips.iter().map(|c| c.trim_end - c.trim_start).sum();
    let args = build_concat_args(&clips, &output_path);

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args(&args)
        .spawn()
        .map_err(|e| AppError::new("FFMPEG_SPAWN", e.to_string()))?;

    while let Some(event) = rx.recv().await {
        match event {
            CommandEvent::Stderr(line) => {
                if let Some(progress) = parse_ffmpeg_progress(&line, total_duration) {
                    app.emit(EVENT_FFMPEG_PROGRESS, progress).ok();
                }
            }
            CommandEvent::Terminated(payload) => {
                if payload.code != Some(0) {
                    app.emit(EVENT_FFMPEG_ERROR, "Export failed").ok();
                    return Err(AppError::new("FFMPEG_FAILED", "FFmpeg export failed"));
                }
                app.emit(EVENT_FFMPEG_DONE, ()).ok();
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

/// 영상 특정 시점에서 썸네일 생성
#[tauri::command]
pub async fn generate_thumbnail(
    app: tauri::AppHandle,
    asset_path: String,
    time_sec: f64,
    output_path: String,
) -> Result<String, AppError> {
    // 출력 디렉터리가 없으면 생성
    if let Some(parent) = std::path::Path::new(&output_path).parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| AppError::new("MKDIR_FAILED", e.to_string()))?;
    }

    let output = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args([
            "-ss",
            &format!("{time_sec:.3}"),
            "-i",
            &asset_path,
            "-vframes",
            "1",
            "-vf",
            "scale=160:-1",
            "-q:v",
            "3",
            "-y",
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| AppError::new("THUMBNAIL_FAILED", e.to_string()))?;

    if !output.status.success() {
        return Err(AppError::with_details(
            "THUMBNAIL_FAILED",
            "FFmpeg thumbnail generation failed",
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    app.emit(EVENT_THUMBNAIL_READY, &output_path).ok();
    Ok(output_path)
}

// ---- 내부 유틸 ----------------------------------------------------------

fn validate_export_clips(clips: &[ClipExportInfo]) -> Result<(), AppError> {
    for (index, clip) in clips.iter().enumerate() {
        if clip.asset_path.trim().is_empty() {
            return Err(AppError::new(
                "INVALID_CLIP",
                format!("Clip #{index} has an empty asset path"),
            ));
        }
        if !clip.trim_start.is_finite()
            || !clip.trim_end.is_finite()
            || clip.trim_start < 0.0
            || clip.trim_end <= clip.trim_start
        {
            return Err(AppError::new(
                "INVALID_CLIP",
                format!(
                    "Clip #{index} has an invalid trim range: {:.3}..{:.3}",
                    clip.trim_start, clip.trim_end
                ),
            ));
        }
    }
    Ok(())
}

fn build_concat_args(clips: &[ClipExportInfo], output_path: &str) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    for clip in clips {
        let clip_duration = (clip.trim_end - clip.trim_start).max(0.0);
        args.extend([
            "-ss".into(),
            format!("{:.3}", clip.trim_start),
            "-t".into(),
            format!("{clip_duration:.3}"),
            "-i".into(),
            clip.asset_path.clone(),
        ]);
    }

    // 각 클립을 동일 캔버스 크기로 정규화한 뒤 concat한다.
    let n = clips.len();
    let mut filter_parts: Vec<String> = Vec::new();
    let mut concat_inputs = String::new();
    for (i, clip) in clips.iter().enumerate() {
        let canvas_w = clip.canvas_width.unwrap_or(1920);
        let canvas_h = clip.canvas_height.unwrap_or(1080);
        let video_filter = build_fit_filter(clip, canvas_w, canvas_h);
        filter_parts.push(format!("[{i}:v]{video_filter},setsar=1[v{i}]"));
        filter_parts.push(format!("[{i}:a]anull[a{i}]"));
        concat_inputs.push_str(&format!("[v{i}][a{i}]"));
    }
    filter_parts.push(format!("{concat_inputs}concat=n={n}:v=1:a=1[v][a]"));
    let filter = filter_parts.join(";");

    args.extend([
        "-filter_complex".into(),
        filter,
        "-map".into(),
        "[v]".into(),
        "-map".into(),
        "[a]".into(),
        "-c:v".into(),
        "libx264".into(),
        "-crf".into(),
        "23".into(),
        "-c:a".into(),
        "aac".into(),
        "-y".into(),
        output_path.to_string(),
    ]);

    args
}

fn build_fit_filter(clip: &ClipExportInfo, canvas_w: u32, canvas_h: u32) -> String {
    match clip.fit_mode.as_deref().unwrap_or("fit") {
        "fill" => format!(
            "scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=increase,crop={canvas_w}:{canvas_h}"
        ),
        "stretch" => format!("scale={canvas_w}:{canvas_h}"),
        "center" => format!(
            "scale='min(iw,{canvas_w})':'min(ih,{canvas_h})':force_original_aspect_ratio=decrease,pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2"
        ),
        "crop" => {
            if let (Some(x), Some(y), Some(w), Some(h)) = (
                clip.crop_x,
                clip.crop_y,
                clip.crop_width,
                clip.crop_height,
            ) {
                format!("crop={w:.0}:{h:.0}:{x:.0}:{y:.0},scale={canvas_w}:{canvas_h}")
            } else {
                format!(
                    "scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=decrease,pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2"
                )
            }
        }
        _ => format!(
            "scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=decrease,pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2"
        ),
    }
}

fn parse_ffmpeg_progress(line: &[u8], total_duration: f64) -> Option<FfmpegProgress> {
    let s = std::str::from_utf8(line).ok()?;
    let time_pos = s.find("time=")?;
    let time_value = s[time_pos + 5..].split_whitespace().next()?;
    let current = parse_time_str(time_value)?;
    let percent = if total_duration > 0.0 {
        (current / total_duration * 100.0).min(100.0) as f32
    } else {
        0.0
    };
    Some(FfmpegProgress {
        percent,
        current_time: current as f32,
        total_time: total_duration as f32,
    })
}

fn parse_time_str(s: &str) -> Option<f64> {
    let parts: Vec<&str> = s.splitn(3, ':').collect();
    if parts.len() != 3 {
        return None;
    }
    let h: f64 = parts[0].trim().parse().ok()?;
    let m: f64 = parts[1].trim().parse().ok()?;
    let sec: f64 = parts[2].trim().parse().ok()?;
    Some(h * 3600.0 + m * 60.0 + sec)
}
