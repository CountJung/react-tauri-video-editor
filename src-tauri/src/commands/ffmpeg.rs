use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use crate::commands::common::{AppError, EVENT_FFMPEG_DONE, EVENT_FFMPEG_ERROR, EVENT_FFMPEG_PROGRESS, EVENT_THUMBNAIL_READY};

#[derive(Debug, serde::Deserialize)]
pub struct ClipExportInfo {
    pub asset_path: String,
    pub trim_start: f64,
    pub trim_end: f64,
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
    app.shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::new("FFMPEG_NOT_FOUND", e.to_string()))?
        .args([
            "-ss", &format!("{time_sec:.3}"),
            "-i", &asset_path,
            "-vframes", "1",
            "-vf", "scale=160:-1",
            "-q:v", "3",
            "-y",
            &output_path,
        ])
        .output()
        .await
        .map_err(|e| AppError::new("THUMBNAIL_FAILED", e.to_string()))?;

    app.emit(EVENT_THUMBNAIL_READY, &output_path).ok();
    Ok(output_path)
}

// ---- 내부 유틸 ----------------------------------------------------------

fn build_concat_args(clips: &[ClipExportInfo], output_path: &str) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    for clip in clips {
        args.extend([
            "-ss".into(),
            format!("{:.3}", clip.trim_start),
            "-i".into(),
            clip.asset_path.clone(),
        ]);
    }

    // filter_complex concat
    let n = clips.len();
    let filter = (0..n)
        .map(|i| format!("[{i}:v][{i}:a]"))
        .collect::<String>()
        + &format!("concat=n={n}:v=1:a=1[v][a]");

    args.extend([
        "-filter_complex".into(),
        filter,
        "-map".into(), "[v]".into(),
        "-map".into(), "[a]".into(),
        "-c:v".into(), "libx264".into(),
        "-crf".into(), "23".into(),
        "-c:a".into(), "aac".into(),
        "-y".into(),
        output_path.to_string(),
    ]);

    args
}

fn parse_ffmpeg_progress(line: &[u8], total_duration: f64) -> Option<FfmpegProgress> {
    let s = std::str::from_utf8(line).ok()?;
    let time_pos = s.find("time=")?;
    let time_str = s.get(time_pos + 5..time_pos + 16)?; // "HH:MM:SS.mm"
    let current = parse_time_str(time_str)?;
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
