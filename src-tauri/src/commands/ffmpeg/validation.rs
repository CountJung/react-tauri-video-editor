use crate::commands::common::AppError;

use super::types::{
    AudioExportInfo, ClipExportInfo, OverlayExportInfo, ShapeExportInfo, TextExportInfo,
};

pub(super) fn validate_export_clips(clips: &[ClipExportInfo]) -> Result<(), AppError> {
    for (index, clip) in clips.iter().enumerate() {
        if clip.asset_path.trim().is_empty() {
            return Err(AppError::new(
                "INVALID_CLIP",
                format!("Clip #{index} has an empty asset path"),
            ));
        }
        if !clip.trim_start.is_finite()
            || !clip.trim_end.is_finite()
            || !clip.timeline_start.unwrap_or(0.0).is_finite()
            || !clip.timeline_duration.unwrap_or(0.0).is_finite()
            || clip.trim_start < 0.0
            || clip.trim_end <= clip.trim_start
            || clip.timeline_start.unwrap_or(0.0) < 0.0
            || clip
                .timeline_duration
                .unwrap_or(clip.trim_end - clip.trim_start)
                <= 0.0
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

pub(super) fn validate_overlay_clips(overlays: &[OverlayExportInfo]) -> Result<(), AppError> {
    for (index, overlay) in overlays.iter().enumerate() {
        if overlay.asset_path.trim().is_empty() {
            return Err(AppError::new(
                "INVALID_OVERLAY",
                format!("Overlay #{index} has an empty asset path"),
            ));
        }
        if !overlay.timeline_start.is_finite()
            || !overlay.timeline_duration.is_finite()
            || overlay.timeline_start < 0.0
            || overlay.timeline_duration <= 0.0
            || overlay.width <= 0.0
            || overlay.height <= 0.0
        {
            return Err(AppError::new(
                "INVALID_OVERLAY",
                format!("Overlay #{index} has invalid timing or bounds"),
            ));
        }
    }
    Ok(())
}

pub(super) fn validate_text_clips(texts: &[TextExportInfo]) -> Result<(), AppError> {
    for (index, text) in texts.iter().enumerate() {
        if text.text.trim().is_empty() {
            return Err(AppError::new(
                "INVALID_TEXT",
                format!("Text clip #{index} has empty text"),
            ));
        }
        if !text.timeline_start.is_finite()
            || !text.timeline_duration.is_finite()
            || !text.font_size.is_finite()
            || text.timeline_start < 0.0
            || text.timeline_duration <= 0.0
            || text.font_size <= 0.0
            || text.width <= 0.0
            || text.height <= 0.0
        {
            return Err(AppError::new(
                "INVALID_TEXT",
                format!("Text clip #{index} has invalid timing, bounds, or font size"),
            ));
        }
    }
    Ok(())
}

pub(super) fn validate_shape_clips(shapes: &[ShapeExportInfo]) -> Result<(), AppError> {
    for (index, shape) in shapes.iter().enumerate() {
        if !matches!(shape.shape_type.as_str(), "rect" | "circle" | "arrow") {
            return Err(AppError::new(
                "INVALID_SHAPE",
                format!(
                    "Shape clip #{index} has unsupported type {}",
                    shape.shape_type
                ),
            ));
        }
        if !shape.timeline_start.is_finite()
            || !shape.timeline_duration.is_finite()
            || !shape.width.is_finite()
            || !shape.height.is_finite()
            || shape.timeline_start < 0.0
            || shape.timeline_duration <= 0.0
            || shape.width <= 0.0
            || shape.height <= 0.0
        {
            return Err(AppError::new(
                "INVALID_SHAPE",
                format!("Shape clip #{index} has invalid timing or bounds"),
            ));
        }
    }
    Ok(())
}

pub(super) fn validate_audio_clips(audio_clips: &[AudioExportInfo]) -> Result<(), AppError> {
    for (index, clip) in audio_clips.iter().enumerate() {
        if clip.asset_path.trim().is_empty() {
            return Err(AppError::new(
                "INVALID_AUDIO",
                format!("Audio clip #{index} has an empty asset path"),
            ));
        }
        if !clip.trim_start.is_finite()
            || !clip.timeline_start.is_finite()
            || !clip.timeline_duration.is_finite()
            || clip.trim_start < 0.0
            || clip.timeline_start < 0.0
            || clip.timeline_duration <= 0.0
        {
            return Err(AppError::new(
                "INVALID_AUDIO",
                format!("Audio clip #{index} has invalid timing"),
            ));
        }
    }
    Ok(())
}
