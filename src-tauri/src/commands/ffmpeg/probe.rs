use crate::commands::common::AppError;
use tauri_plugin_shell::ShellExt;

use super::types::ExportPlan;

pub(super) async fn populate_clip_audio_flags(
    app: &tauri::AppHandle,
    plan: &mut ExportPlan,
) -> Result<(), AppError> {
    for clip in &mut plan.clips {
        if clip.has_audio.is_none() {
            clip.has_audio = Some(probe_has_audio(app, &clip.asset_path).await?);
        }
    }
    Ok(())
}

async fn probe_has_audio(app: &tauri::AppHandle, asset_path: &str) -> Result<bool, AppError> {
    let output = app
        .shell()
        .sidecar("ffprobe")
        .map_err(|e| AppError::new("FFPROBE_NOT_FOUND", e.to_string()))?
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=codec_type",
            "-of",
            "csv=p=0",
            asset_path,
        ])
        .output()
        .await
        .map_err(|e| AppError::new("PROBE_FAILED", e.to_string()))?;

    if !output.status.success() {
        return Err(AppError::with_details(
            "PROBE_FAILED",
            format!("ffprobe audio stream detection failed: {asset_path}"),
            String::from_utf8_lossy(&output.stderr).to_string(),
        ));
    }

    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
}
