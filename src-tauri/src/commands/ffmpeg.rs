use crate::commands::common::{
    AppError, EVENT_FFMPEG_DONE, EVENT_FFMPEG_ERROR, EVENT_FFMPEG_PROGRESS, EVENT_THUMBNAIL_READY,
};
use tauri::Emitter;
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

mod probe;
mod types;
mod validation;

use probe::populate_clip_audio_flags;
use types::{
    AudioExportInfo, ClipExportInfo, ExportPlan, ExportTimelinePayload, OverlayExportInfo,
    ShapeExportInfo, TextExportInfo,
};
use validation::{
    validate_audio_clips, validate_export_clips, validate_overlay_clips, validate_shape_clips,
    validate_text_clips,
};

enum ExportSegment<'a> {
    Gap {
        duration: f64,
        canvas_width: u32,
        canvas_height: u32,
        fps: f64,
    },
    Clip {
        clip: &'a ClipExportInfo,
        input_index: usize,
    },
}

enum VisualLayer<'a> {
    Overlay {
        overlay_index: usize,
        overlay: &'a OverlayExportInfo,
    },
    Text(&'a TextExportInfo),
    Shape(&'a ShapeExportInfo),
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
    clips: Option<Vec<ClipExportInfo>>,
    payload: Option<ExportTimelinePayload>,
) -> Result<(), AppError> {
    let mut plan = match payload {
        Some(payload) => build_plan_from_payload(&payload)?,
        None => ExportPlan {
            clips: clips.unwrap_or_default(),
            overlays: Vec::new(),
            texts: Vec::new(),
            shapes: Vec::new(),
            audio_clips: Vec::new(),
        },
    };

    if plan.clips.is_empty() {
        return Err(AppError::new("NO_CLIPS", "No clips to export"));
    }

    validate_export_clips(&plan.clips)?;
    validate_overlay_clips(&plan.overlays)?;
    validate_text_clips(&plan.texts)?;
    validate_shape_clips(&plan.shapes)?;
    validate_audio_clips(&plan.audio_clips)?;
    populate_clip_audio_flags(&app, &mut plan).await?;

    let total_duration = calculate_export_duration(&plan);
    let args = build_concat_args(&plan, &output_path);

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

fn build_plan_from_payload(payload: &ExportTimelinePayload) -> Result<ExportPlan, AppError> {
    let mut clips = Vec::new();
    let mut overlays = Vec::new();
    let mut texts = Vec::new();
    let mut shapes = Vec::new();
    let mut audio_clips = Vec::new();

    for track in payload.tracks.iter().filter(|track| track.visible) {
        let mut sorted_clips: Vec<_> = track.clips.iter().collect();
        sorted_clips.sort_by(|a, b| a.start.total_cmp(&b.start));

        for clip in sorted_clips {
            if track.track_type == "text" {
                let Some(text_props) = clip.text_props.as_ref() else {
                    continue;
                };
                if text_props.text.trim().is_empty() {
                    continue;
                }
                texts.push(TextExportInfo {
                    text: text_props.text.clone(),
                    font_family: text_props.font_family.clone(),
                    font_size: text_props.font_size,
                    color: text_props.color.clone(),
                    align: text_props.align.clone(),
                    timeline_start: clip.start,
                    timeline_duration: clip.duration,
                    x: clip.x.unwrap_or(0.0),
                    y: clip.y.unwrap_or(0.0),
                    width: clip
                        .width
                        .unwrap_or(payload.project_meta.canvas_width as f64),
                    height: clip
                        .height
                        .unwrap_or(payload.project_meta.canvas_height as f64),
                    opacity: (clip.opacity.unwrap_or(1.0) * track.opacity.unwrap_or(1.0))
                        .clamp(0.0, 1.0),
                    shadow_color: text_props
                        .shadow
                        .as_ref()
                        .map(|shadow| shadow.color.clone()),
                    shadow_x: text_props.shadow.as_ref().map(|shadow| shadow.offset_x),
                    shadow_y: text_props.shadow.as_ref().map(|shadow| shadow.offset_y),
                    outline_width: text_props.outline.as_ref().map(|outline| outline.width),
                    outline_color: text_props
                        .outline
                        .as_ref()
                        .map(|outline| outline.color.clone()),
                    z_index: track.z_index.unwrap_or(0),
                });
                continue;
            }

            if track.track_type == "shape" {
                let Some(shape_props) = clip.shape_props.as_ref() else {
                    continue;
                };
                shapes.push(ShapeExportInfo {
                    shape_type: shape_props.shape_type.clone(),
                    fill: shape_props.fill.clone(),
                    stroke: shape_props.stroke.clone(),
                    stroke_width: shape_props.stroke_width,
                    corner_radius: shape_props.corner_radius,
                    timeline_start: clip.start,
                    timeline_duration: clip.duration,
                    x: clip.x.unwrap_or(0.0),
                    y: clip.y.unwrap_or(0.0),
                    width: clip
                        .width
                        .unwrap_or(payload.project_meta.canvas_width as f64),
                    height: clip
                        .height
                        .unwrap_or(payload.project_meta.canvas_height as f64),
                    opacity: (clip.opacity.unwrap_or(1.0) * track.opacity.unwrap_or(1.0))
                        .clamp(0.0, 1.0),
                    fps: payload.project_meta.fps.max(1.0),
                    z_index: track.z_index.unwrap_or(0),
                });
                continue;
            }

            let asset = payload
                .assets
                .iter()
                .find(|asset| asset.id == clip.asset_id)
                .ok_or_else(|| {
                    AppError::new(
                        "EXPORT_ASSET_NOT_FOUND",
                        format!("Asset not found for clip assetId {}", clip.asset_id),
                    )
                })?;

            if track.track_type == "video" && asset.asset_type == "video" {
                clips.push(ClipExportInfo {
                    asset_path: asset.path.clone(),
                    trim_start: clip.trim_start,
                    trim_end: clip.trim_end,
                    fit_mode: clip.fit_mode.clone(),
                    crop_x: clip.crop_rect.as_ref().map(|crop| crop.x),
                    crop_y: clip.crop_rect.as_ref().map(|crop| crop.y),
                    crop_width: clip.crop_rect.as_ref().map(|crop| crop.width),
                    crop_height: clip.crop_rect.as_ref().map(|crop| crop.height),
                    canvas_width: Some(payload.project_meta.canvas_width),
                    canvas_height: Some(payload.project_meta.canvas_height),
                    timeline_start: Some(clip.start),
                    timeline_duration: Some(clip.duration),
                    fps: Some(payload.project_meta.fps),
                    has_audio: None,
                });
            } else if track.track_type == "audio" && asset.asset_type == "audio" {
                audio_clips.push(AudioExportInfo {
                    asset_path: asset.path.clone(),
                    trim_start: clip.trim_start,
                    timeline_start: clip.start,
                    timeline_duration: clip.duration,
                    gain: (clip.opacity.unwrap_or(1.0) * track.opacity.unwrap_or(1.0))
                        .clamp(0.0, 4.0),
                });
            } else if track.track_type == "overlay"
                && (asset.asset_type == "video" || asset.asset_type == "image")
            {
                overlays.push(OverlayExportInfo {
                    asset_path: asset.path.clone(),
                    asset_type: asset.asset_type.clone(),
                    trim_start: clip.trim_start,
                    timeline_start: clip.start,
                    timeline_duration: clip.duration,
                    x: clip.x.unwrap_or(0.0),
                    y: clip.y.unwrap_or(0.0),
                    width: clip
                        .width
                        .unwrap_or(payload.project_meta.canvas_width as f64),
                    height: clip
                        .height
                        .unwrap_or(payload.project_meta.canvas_height as f64),
                    opacity: (clip.opacity.unwrap_or(1.0) * track.opacity.unwrap_or(1.0))
                        .clamp(0.0, 1.0),
                    fit_mode: clip.fit_mode.clone(),
                    crop_x: clip.crop_rect.as_ref().map(|crop| crop.x),
                    crop_y: clip.crop_rect.as_ref().map(|crop| crop.y),
                    crop_width: clip.crop_rect.as_ref().map(|crop| crop.width),
                    crop_height: clip.crop_rect.as_ref().map(|crop| crop.height),
                    z_index: track.z_index.unwrap_or(0),
                });
            }
        }
    }
    overlays.sort_by(|a, b| {
        a.z_index
            .cmp(&b.z_index)
            .then_with(|| a.timeline_start.total_cmp(&b.timeline_start))
    });
    texts.sort_by(|a, b| {
        a.z_index
            .cmp(&b.z_index)
            .then_with(|| a.timeline_start.total_cmp(&b.timeline_start))
    });
    shapes.sort_by(|a, b| {
        a.z_index
            .cmp(&b.z_index)
            .then_with(|| a.timeline_start.total_cmp(&b.timeline_start))
    });
    Ok(ExportPlan {
        clips,
        overlays,
        texts,
        shapes,
        audio_clips,
    })
}

fn calculate_export_duration(plan: &ExportPlan) -> f64 {
    if plan.clips.iter().all(|clip| clip.timeline_start.is_none())
        && plan.overlays.is_empty()
        && plan.texts.is_empty()
        && plan.shapes.is_empty()
    {
        return plan
            .clips
            .iter()
            .map(|clip| clip.trim_end - clip.trim_start)
            .sum();
    }

    let base_duration = plan.clips.iter().fold(0.0, |duration, clip| {
        let start = clip.timeline_start.unwrap_or(duration);
        let clip_duration = clip
            .timeline_duration
            .unwrap_or(clip.trim_end - clip.trim_start);
        duration.max(start + clip_duration)
    });
    let overlay_duration = plan
        .overlays
        .iter()
        .fold(base_duration, |duration, overlay| {
            duration.max(overlay.timeline_start + overlay.timeline_duration)
        });
    let text_duration = plan.texts.iter().fold(overlay_duration, |duration, text| {
        duration.max(text.timeline_start + text.timeline_duration)
    });
    let shape_duration = plan.shapes.iter().fold(text_duration, |duration, shape| {
        duration.max(shape.timeline_start + shape.timeline_duration)
    });
    plan.audio_clips
        .iter()
        .fold(shape_duration, |duration, clip| {
            duration.max(clip.timeline_start + clip.timeline_duration)
        })
}

fn build_concat_args(plan: &ExportPlan, output_path: &str) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();
    let mut ordered_clips: Vec<&ClipExportInfo> = plan.clips.iter().collect();
    ordered_clips.sort_by(|a, b| {
        a.timeline_start
            .unwrap_or(0.0)
            .total_cmp(&b.timeline_start.unwrap_or(0.0))
    });

    for clip in &ordered_clips {
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

    for overlay in &plan.overlays {
        if overlay.asset_type == "image" {
            args.extend([
                "-loop".into(),
                "1".into(),
                "-t".into(),
                format!("{:.3}", overlay.timeline_duration),
                "-i".into(),
                overlay.asset_path.clone(),
            ]);
        } else {
            args.extend([
                "-ss".into(),
                format!("{:.3}", overlay.trim_start),
                "-t".into(),
                format!("{:.3}", overlay.timeline_duration),
                "-i".into(),
                overlay.asset_path.clone(),
            ]);
        }
    }

    for audio_clip in &plan.audio_clips {
        args.extend([
            "-ss".into(),
            format!("{:.3}", audio_clip.trim_start),
            "-t".into(),
            format!("{:.3}", audio_clip.timeline_duration),
            "-i".into(),
            audio_clip.asset_path.clone(),
        ]);
    }

    // 각 클립을 동일 캔버스 크기로 정규화한 뒤 concat한다.
    let segments = build_export_segments(&ordered_clips);
    let n = segments.len();
    let mut filter_parts: Vec<String> = Vec::new();
    let mut concat_inputs = String::new();
    for (segment_index, segment) in segments.iter().enumerate() {
        match segment {
            ExportSegment::Gap {
                duration,
                canvas_width,
                canvas_height,
                fps,
            } => {
                filter_parts.push(format!(
                    "color=c=black:s={canvas_width}x{canvas_height}:r={fps:.3}:d={duration:.3},setsar=1[v{segment_index}]"
                ));
                filter_parts.push(format!(
                    "anullsrc=channel_layout=stereo:sample_rate=48000:d={duration:.3}[a{segment_index}]"
                ));
            }
            ExportSegment::Clip { clip, input_index } => {
                let canvas_w = clip.canvas_width.unwrap_or(1920);
                let canvas_h = clip.canvas_height.unwrap_or(1080);
                let duration = clip
                    .timeline_duration
                    .unwrap_or(clip.trim_end - clip.trim_start);
                let video_filter = build_fit_filter(clip, canvas_w, canvas_h);
                filter_parts.push(format!(
                    "[{input_index}:v]{video_filter},setsar=1,setpts=PTS-STARTPTS[v{segment_index}]"
                ));
                if clip.has_audio.unwrap_or(false) {
                    filter_parts.push(format!(
                        "[{input_index}:a]asetpts=PTS-STARTPTS[a{segment_index}]"
                    ));
                } else {
                    filter_parts.push(format!(
                        "anullsrc=channel_layout=stereo:sample_rate=48000:d={duration:.3}[a{segment_index}]"
                    ));
                }
            }
        }
        concat_inputs.push_str(&format!("[v{segment_index}][a{segment_index}]"));
    }
    filter_parts.push(format!("{concat_inputs}concat=n={n}:v=1:a=1[basev][basea]"));
    let final_video_label =
        append_visual_filters(&mut filter_parts, "basev", plan, ordered_clips.len());
    let final_audio_label = append_audio_mix_filters(
        &mut filter_parts,
        "basea",
        plan,
        ordered_clips.len() + plan.overlays.len(),
    );
    let filter = filter_parts.join(";");

    args.extend([
        "-filter_complex".into(),
        filter,
        "-map".into(),
        format!("[{final_video_label}]"),
        "-map".into(),
        format!("[{final_audio_label}]"),
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

fn build_export_segments<'a>(ordered_clips: &[&'a ClipExportInfo]) -> Vec<ExportSegment<'a>> {
    let mut segments = Vec::new();
    let mut cursor = 0.0;
    for (input_index, clip) in ordered_clips.iter().enumerate() {
        let start = clip.timeline_start.unwrap_or(cursor);
        let clip_duration = clip
            .timeline_duration
            .unwrap_or(clip.trim_end - clip.trim_start);
        if start > cursor {
            segments.push(ExportSegment::Gap {
                duration: start - cursor,
                canvas_width: clip.canvas_width.unwrap_or(1920),
                canvas_height: clip.canvas_height.unwrap_or(1080),
                fps: clip.fps.unwrap_or(30.0).max(1.0),
            });
        }
        segments.push(ExportSegment::Clip { clip, input_index });
        cursor = cursor.max(start + clip_duration);
    }
    segments
}

fn append_audio_mix_filters(
    filter_parts: &mut Vec<String>,
    base_audio_label: &str,
    plan: &ExportPlan,
    input_start_index: usize,
) -> String {
    if plan.audio_clips.is_empty() {
        return base_audio_label.to_string();
    }

    let mut mix_inputs = format!("[{base_audio_label}]");
    for (audio_index, clip) in plan.audio_clips.iter().enumerate() {
        let input_index = input_start_index + audio_index;
        let label = format!("aud{audio_index}");
        let delay_ms = (clip.timeline_start * 1000.0).round().max(0.0);
        filter_parts.push(format!(
            "[{input_index}:a]asetpts=PTS-STARTPTS,adelay={delay_ms:.0}:all=1,volume={:.3}[{label}]",
            clip.gain
        ));
        mix_inputs.push_str(&format!("[{label}]"));
    }

    let output_label = "aout".to_string();
    filter_parts.push(format!(
        "{mix_inputs}amix=inputs={}:duration=first:normalize=0[{output_label}]",
        plan.audio_clips.len() + 1
    ));
    output_label
}

fn append_visual_filters(
    filter_parts: &mut Vec<String>,
    base_label: &str,
    plan: &ExportPlan,
    input_start_index: usize,
) -> String {
    let mut current_label = base_label.to_string();
    let mut layers: Vec<VisualLayer<'_>> = plan
        .overlays
        .iter()
        .enumerate()
        .map(|(overlay_index, overlay)| VisualLayer::Overlay {
            overlay_index,
            overlay,
        })
        .chain(plan.texts.iter().map(VisualLayer::Text))
        .chain(plan.shapes.iter().map(VisualLayer::Shape))
        .collect();
    layers.sort_by(|a, b| {
        visual_layer_z_index(a)
            .cmp(&visual_layer_z_index(b))
            .then_with(|| visual_layer_start(a).total_cmp(&visual_layer_start(b)))
    });

    for (layer_index, layer) in layers.iter().enumerate() {
        let output_label = format!("v_visual{layer_index}");
        match layer {
            VisualLayer::Overlay {
                overlay_index,
                overlay,
            } => {
                let input_index = input_start_index + overlay_index;
                let overlay_label = format!("ov{overlay_index}");
                let width = overlay.width.max(1.0).round() as u32;
                let height = overlay.height.max(1.0).round() as u32;
                let filter = build_fit_filter_parts(
                    overlay.fit_mode.as_deref(),
                    overlay.crop_x,
                    overlay.crop_y,
                    overlay.crop_width,
                    overlay.crop_height,
                    width,
                    height,
                );
                filter_parts.push(format!(
                    "[{input_index}:v]{filter},format=rgba,colorchannelmixer=aa={:.3},setpts=PTS-STARTPTS+{:.3}/TB[{overlay_label}]",
                    overlay.opacity, overlay.timeline_start
                ));
                filter_parts.push(format!(
                    "[{current_label}][{overlay_label}]overlay=x={:.0}:y={:.0}:enable='between(t,{:.3},{:.3})':eof_action=pass:shortest=0[{output_label}]",
                    overlay.x,
                    overlay.y,
                    overlay.timeline_start,
                    overlay.timeline_start + overlay.timeline_duration
                ));
            }
            VisualLayer::Text(text) => {
                filter_parts.push(format!(
                    "[{current_label}]{}[{output_label}]",
                    build_drawtext_filter(text)
                ));
            }
            VisualLayer::Shape(shape) => {
                append_shape_filter(filter_parts, &current_label, &output_label, shape);
            }
        }
        current_label = output_label;
    }
    current_label
}

fn visual_layer_z_index(layer: &VisualLayer<'_>) -> i32 {
    match layer {
        VisualLayer::Overlay { overlay, .. } => overlay.z_index,
        VisualLayer::Text(text) => text.z_index,
        VisualLayer::Shape(shape) => shape.z_index,
    }
}

fn visual_layer_start(layer: &VisualLayer<'_>) -> f64 {
    match layer {
        VisualLayer::Overlay { overlay, .. } => overlay.timeline_start,
        VisualLayer::Text(text) => text.timeline_start,
        VisualLayer::Shape(shape) => shape.timeline_start,
    }
}

fn append_shape_filter(
    filter_parts: &mut Vec<String>,
    current_label: &str,
    output_label: &str,
    shape: &ShapeExportInfo,
) {
    match shape.shape_type.as_str() {
        "rect" => append_rect_shape_filter(filter_parts, current_label, output_label, shape),
        "circle" => append_masked_shape_filter(
            filter_parts,
            current_label,
            output_label,
            shape,
            build_circle_geq_filter(shape),
        ),
        "arrow" => append_masked_shape_filter(
            filter_parts,
            current_label,
            output_label,
            shape,
            build_arrow_geq_filter(shape),
        ),
        _ => filter_parts.push(format!("[{current_label}]null[{output_label}]")),
    }
}

fn append_rect_shape_filter(
    filter_parts: &mut Vec<String>,
    current_label: &str,
    output_label: &str,
    shape: &ShapeExportInfo,
) {
    let _corner_radius = shape.corner_radius.unwrap_or(0.0);
    let mut filters = Vec::new();
    let x = shape.x.round();
    let y = shape.y.round();
    let w = shape.width.max(1.0).round();
    let h = shape.height.max(1.0).round();
    let enable = shape_enable_expr(shape);

    if !is_transparent_color(&shape.fill) {
        filters.push(format!(
            "drawbox=x={x:.0}:y={y:.0}:w={w:.0}:h={h:.0}:color={}:t=fill:enable='{enable}'",
            color_with_opacity(&shape.fill, shape.opacity)
        ));
    }
    if !is_transparent_color(&shape.stroke) && shape.stroke_width > 0.0 {
        filters.push(format!(
            "drawbox=x={x:.0}:y={y:.0}:w={w:.0}:h={h:.0}:color={}:t={:.0}:enable='{enable}'",
            color_with_opacity(&shape.stroke, shape.opacity),
            shape.stroke_width.max(1.0)
        ));
    }

    if filters.is_empty() {
        filter_parts.push(format!("[{current_label}]null[{output_label}]"));
    } else {
        filter_parts.push(format!(
            "[{current_label}]{}[{output_label}]",
            filters.join(",")
        ));
    }
}

fn append_masked_shape_filter(
    filter_parts: &mut Vec<String>,
    current_label: &str,
    output_label: &str,
    shape: &ShapeExportInfo,
    mask_filter: Option<String>,
) {
    let Some(mask_filter) = mask_filter else {
        filter_parts.push(format!("[{current_label}]null[{output_label}]"));
        return;
    };

    let source_label = format!("shape_{output_label}");
    let source_w = shape.width.max(1.0).round();
    let source_h = shape.height.max(1.0).round();
    filter_parts.push(format!(
        "color=c=black@0.0:s={source_w:.0}x{source_h:.0}:r={:.3}:d={:.3},format=rgba,{mask_filter},setpts=PTS-STARTPTS+{:.3}/TB[{source_label}]",
        shape.fps.max(1.0),
        shape.timeline_duration,
        shape.timeline_start
    ));
    filter_parts.push(format!(
        "[{current_label}][{source_label}]overlay=x={:.0}:y={:.0}:enable='{}':eof_action=pass:shortest=0[{output_label}]",
        shape.x,
        shape.y,
        shape_enable_expr(shape)
    ));
}

fn build_circle_geq_filter(shape: &ShapeExportInfo) -> Option<String> {
    let fill_visible = !is_transparent_color(&shape.fill);
    let stroke_visible = !is_transparent_color(&shape.stroke) && shape.stroke_width > 0.0;
    if !fill_visible && !stroke_visible {
        return None;
    }

    let rx = (shape.width / 2.0).max(1.0);
    let ry = (shape.height / 2.0).max(1.0);
    let cx = rx;
    let cy = ry;
    let outer = ellipse_condition(cx, cy, rx, ry);
    let stroke_width = shape.stroke_width.max(0.0);
    let inner_rx = (rx - stroke_width).max(0.0);
    let inner_ry = (ry - stroke_width).max(0.0);
    let inner = if stroke_visible && inner_rx > 0.0 && inner_ry > 0.0 {
        Some(ellipse_condition(cx, cy, inner_rx, inner_ry))
    } else {
        None
    };

    let fill_rgb = parse_rgb(&shape.fill);
    let stroke_rgb = parse_rgb(&shape.stroke);
    let alpha = (shape.opacity.clamp(0.0, 1.0) * 255.0).round();
    let (r, g, b, a) = if fill_visible && stroke_visible {
        let inner_cond = inner.unwrap_or_else(|| "0".to_string());
        (
            ffmpeg_if(
                &inner_cond,
                fill_rgb.0,
                ffmpeg_if(&outer, stroke_rgb.0, "0"),
            ),
            ffmpeg_if(
                &inner_cond,
                fill_rgb.1,
                ffmpeg_if(&outer, stroke_rgb.1, "0"),
            ),
            ffmpeg_if(
                &inner_cond,
                fill_rgb.2,
                ffmpeg_if(&outer, stroke_rgb.2, "0"),
            ),
            ffmpeg_if(&outer, format!("{alpha:.0}"), "0"),
        )
    } else if fill_visible {
        (
            ffmpeg_if(&outer, fill_rgb.0, "0"),
            ffmpeg_if(&outer, fill_rgb.1, "0"),
            ffmpeg_if(&outer, fill_rgb.2, "0"),
            ffmpeg_if(&outer, format!("{alpha:.0}"), "0"),
        )
    } else {
        let ring = inner
            .map(|inner_cond| format!("{outer}*not({inner_cond})"))
            .unwrap_or_else(|| outer.clone());
        (
            ffmpeg_if(&ring, stroke_rgb.0, "0"),
            ffmpeg_if(&ring, stroke_rgb.1, "0"),
            ffmpeg_if(&ring, stroke_rgb.2, "0"),
            ffmpeg_if(&ring, format!("{alpha:.0}"), "0"),
        )
    };

    Some(format!("geq=r='{r}':g='{g}':b='{b}':a='{a}'"))
}

fn build_arrow_geq_filter(shape: &ShapeExportInfo) -> Option<String> {
    let color = if !is_transparent_color(&shape.stroke) {
        &shape.stroke
    } else if !is_transparent_color(&shape.fill) {
        &shape.fill
    } else {
        return None;
    };
    let (r, g, b) = parse_rgb(color);
    let alpha = (shape.opacity.clamp(0.0, 1.0) * 255.0).round();
    let width = shape.width.max(1.0);
    let height = shape.height.max(1.0);
    let thickness = shape.stroke_width.max(2.0).min(height);
    let half_thickness = thickness / 2.0;
    let cy = height / 2.0;
    let head = height.min(width).max(thickness * 3.0).min(width);
    let body_w = (width - head).max(0.0);
    let shaft = format!("between(X\\,0\\,{body_w:.3})*lte(abs(Y-{cy:.3})\\,{half_thickness:.3})");
    let head = format!(
        "gte(X\\,{body_w:.3})*lte(abs(Y-{cy:.3})\\,({height:.3}/2)*({width:.3}-X)/{head:.3})"
    );
    let arrow = format!("gt({shaft}+{head}\\,0)");

    Some(format!(
        "geq=r='{}':g='{}':b='{}':a='{}'",
        ffmpeg_if(&arrow, r, "0"),
        ffmpeg_if(&arrow, g, "0"),
        ffmpeg_if(&arrow, b, "0"),
        ffmpeg_if(&arrow, format!("{alpha:.0}"), "0")
    ))
}

fn ellipse_condition(cx: f64, cy: f64, rx: f64, ry: f64) -> String {
    format!("lte(pow((X-{cx:.3})/{rx:.3}\\,2)+pow((Y-{cy:.3})/{ry:.3}\\,2)\\,1)")
}

fn shape_enable_expr(shape: &ShapeExportInfo) -> String {
    format!(
        "between(t,{:.3},{:.3})",
        shape.timeline_start,
        shape.timeline_start + shape.timeline_duration
    )
}

fn build_drawtext_filter(text: &TextExportInfo) -> String {
    let x_expr = match text.align.as_str() {
        "left" => format!("{:.0}", text.x),
        "right" => format!("{:.0}-text_w", text.x + text.width),
        _ => format!("{:.0}+({:.0}-text_w)/2", text.x, text.width),
    };
    let y_expr = format!("{:.0}+({:.0}-text_h)/2", text.y, text.height);
    let mut parts = vec![
        format!("text='{}'", escape_drawtext_value(&text.text)),
        format!("font='{}'", escape_drawtext_value(&text.font_family)),
        format!("fontsize={:.0}", text.font_size.max(1.0)),
        format!("fontcolor={}", sanitize_ffmpeg_color(&text.color)),
        format!("alpha={:.3}", text.opacity),
        format!("x='{x_expr}'"),
        format!("y='{y_expr}'"),
        format!(
            "enable='between(t,{:.3},{:.3})'",
            text.timeline_start,
            text.timeline_start + text.timeline_duration
        ),
    ];

    if let (Some(width), Some(color)) = (text.outline_width, text.outline_color.as_ref()) {
        if width > 0.0 {
            parts.push(format!("borderw={:.0}", width));
            parts.push(format!("bordercolor={}", sanitize_ffmpeg_color(color)));
        }
    }
    if let Some(color) = text.shadow_color.as_ref() {
        parts.push(format!("shadowcolor={}", sanitize_ffmpeg_color(color)));
        parts.push(format!("shadowx={:.0}", text.shadow_x.unwrap_or(0.0)));
        parts.push(format!("shadowy={:.0}", text.shadow_y.unwrap_or(0.0)));
    }

    format!("drawtext={}", parts.join(":"))
}

fn escape_drawtext_value(value: &str) -> String {
    value
        .chars()
        .flat_map(|ch| match ch {
            '\\' => "\\\\".chars().collect::<Vec<_>>(),
            '\'' => "\\'".chars().collect::<Vec<_>>(),
            ':' => "\\:".chars().collect::<Vec<_>>(),
            ',' => "\\,".chars().collect::<Vec<_>>(),
            '[' => "\\[".chars().collect::<Vec<_>>(),
            ']' => "\\]".chars().collect::<Vec<_>>(),
            ';' => "\\;".chars().collect::<Vec<_>>(),
            '%' => "\\%".chars().collect::<Vec<_>>(),
            _ => vec![ch],
        })
        .collect()
}

fn ffmpeg_if(
    condition: &str,
    truthy: impl std::fmt::Display,
    falsy: impl std::fmt::Display,
) -> String {
    format!("if({condition}\\,{truthy}\\,{falsy})")
}

fn is_transparent_color(color: &str) -> bool {
    color.trim().eq_ignore_ascii_case("transparent")
}

fn color_with_opacity(color: &str, opacity: f64) -> String {
    format!(
        "{}@{:.3}",
        sanitize_ffmpeg_color(color),
        opacity.clamp(0.0, 1.0)
    )
}

fn parse_rgb(color: &str) -> (u8, u8, u8) {
    let trimmed = color.trim();
    let hex = trimmed
        .strip_prefix('#')
        .or_else(|| trimmed.strip_prefix("0x"))
        .or_else(|| trimmed.strip_prefix("0X"));
    if let Some(hex) = hex {
        if hex.len() == 6 {
            let r = u8::from_str_radix(&hex[0..2], 16);
            let g = u8::from_str_radix(&hex[2..4], 16);
            let b = u8::from_str_radix(&hex[4..6], 16);
            if let (Ok(r), Ok(g), Ok(b)) = (r, g, b) {
                return (r, g, b);
            }
        }
    }
    (255, 255, 255)
}

fn sanitize_ffmpeg_color(color: &str) -> String {
    let trimmed = color.trim();
    if let Some(hex) = trimmed.strip_prefix('#') {
        if hex.len() == 6 && hex.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return format!("0x{hex}");
        }
    }
    if trimmed
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || ch == '_' || ch == '@' || ch == '.')
    {
        return trimmed.to_string();
    }
    "white".to_string()
}

fn build_fit_filter(clip: &ClipExportInfo, canvas_w: u32, canvas_h: u32) -> String {
    build_fit_filter_parts(
        clip.fit_mode.as_deref(),
        clip.crop_x,
        clip.crop_y,
        clip.crop_width,
        clip.crop_height,
        canvas_w,
        canvas_h,
    )
}

fn build_fit_filter_parts(
    fit_mode: Option<&str>,
    crop_x: Option<f64>,
    crop_y: Option<f64>,
    crop_width: Option<f64>,
    crop_height: Option<f64>,
    canvas_w: u32,
    canvas_h: u32,
) -> String {
    match fit_mode.unwrap_or("fit") {
        "fill" => format!(
            "scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=increase,crop={canvas_w}:{canvas_h}"
        ),
        "stretch" => format!("scale={canvas_w}:{canvas_h}"),
        "center" => format!(
            "scale='min(iw,{canvas_w})':'min(ih,{canvas_h})':force_original_aspect_ratio=decrease,pad={canvas_w}:{canvas_h}:(ow-iw)/2:(oh-ih)/2"
        ),
        "crop" => {
            if let (Some(x), Some(y), Some(w), Some(h)) =
                (crop_x, crop_y, crop_width, crop_height)
            {
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

#[cfg(test)]
mod tests;
