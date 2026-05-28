use std::path::Path;
use crate::commands::common::AppError;

const VIDEO_EXTS: &[&str] = &["mp4", "mov", "avi", "mkv", "webm"];
const AUDIO_EXTS: &[&str] = &["mp3", "wav", "aac", "flac", "ogg", "m4a"];
const IMAGE_EXTS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp", "bmp"];

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct AssetMeta {
    pub id: String,
    pub name: String,
    pub path: String,
    pub asset_type: String,
    pub duration: f64,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

fn asset_type_from_ext(ext: &str) -> Option<&'static str> {
    let ext = ext.to_lowercase();
    if VIDEO_EXTS.contains(&ext.as_str()) {
        Some("video")
    } else if AUDIO_EXTS.contains(&ext.as_str()) {
        Some("audio")
    } else if IMAGE_EXTS.contains(&ext.as_str()) {
        Some("image")
    } else {
        None
    }
}

/// 파일 경로를 받아 에셋 메타데이터 반환 (ffprobe 없이 기본값 사용)
#[tauri::command]
pub async fn asset_import(path: String) -> Result<AssetMeta, AppError> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err(AppError::new("FILE_NOT_FOUND", format!("File not found: {path}")));
    }

    let ext = p
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    let asset_type = asset_type_from_ext(ext)
        .ok_or_else(|| AppError::new("UNSUPPORTED_FORMAT", format!("Unsupported format: .{ext}")))?;

    let name = p
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(AssetMeta {
        id: uuid_v4(),
        name,
        path,
        asset_type: asset_type.to_string(),
        duration: 0.0, // ffprobe로 추후 갱신
        width: None,
        height: None,
    })
}

/// ffprobe로 미디어 메타데이터 추출
#[tauri::command]
pub async fn asset_probe(
    app: tauri::AppHandle,
    path: String,
) -> Result<AssetMeta, AppError> {
    use tauri_plugin_shell::ShellExt;

    let output = app
        .shell()
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

    let streams = json["streams"].as_array();
    let video = streams
        .and_then(|s| s.iter().find(|s| s["codec_type"] == "video"));

    let width = video.and_then(|s| s["width"].as_u64()).map(|v| v as u32);
    let height = video.and_then(|s| s["height"].as_u64()).map(|v| v as u32);

    let p = Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("");
    let asset_type = asset_type_from_ext(ext).unwrap_or("video");
    let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();

    Ok(AssetMeta {
        id: uuid_v4(),
        name,
        path,
        asset_type: asset_type.to_string(),
        duration,
        width,
        height,
    })
}

fn uuid_v4() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .subsec_nanos();
    format!("{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}", t, t >> 8, t & 0xfff, t >> 4, t as u64)
}
