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
    pub timeline_start: Option<f64>,
    pub timeline_duration: Option<f64>,
    pub fps: Option<f64>,
    pub has_audio: Option<bool>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTimelinePayload {
    pub project_meta: ExportProjectMeta,
    pub tracks: Vec<ExportTrack>,
    pub assets: Vec<ExportAsset>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProjectMeta {
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub fps: f64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportAsset {
    pub id: String,
    #[serde(rename = "type")]
    pub asset_type: String,
    pub path: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTrack {
    #[serde(rename = "type")]
    pub track_type: String,
    pub clips: Vec<ExportClip>,
    pub visible: bool,
    pub opacity: Option<f64>,
    pub z_index: Option<i32>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportCropRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportClip {
    pub asset_id: String,
    pub start: f64,
    pub duration: f64,
    pub trim_start: f64,
    pub trim_end: f64,
    pub playback_rate: Option<f64>,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub width: Option<f64>,
    pub height: Option<f64>,
    pub opacity: Option<f64>,
    pub fit_mode: Option<String>,
    pub crop_rect: Option<ExportCropRect>,
    pub text_props: Option<ExportTextProps>,
    pub shape_props: Option<ExportShapeProps>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTextProps {
    pub text: String,
    pub font_family: String,
    pub font_size: f64,
    pub color: String,
    pub align: String,
    pub shadow: Option<ExportTextShadow>,
    pub outline: Option<ExportTextOutline>,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTextShadow {
    pub color: String,
    pub offset_x: f64,
    pub offset_y: f64,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportTextOutline {
    pub width: f64,
    pub color: String,
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportShapeProps {
    pub shape_type: String,
    pub fill: String,
    pub stroke: String,
    pub stroke_width: f64,
    pub corner_radius: Option<f64>,
}

pub(super) struct ExportPlan {
    pub(super) clips: Vec<ClipExportInfo>,
    pub(super) overlays: Vec<OverlayExportInfo>,
    pub(super) texts: Vec<TextExportInfo>,
    pub(super) shapes: Vec<ShapeExportInfo>,
    pub(super) audio_clips: Vec<AudioExportInfo>,
}

pub(super) struct OverlayExportInfo {
    pub(super) asset_path: String,
    pub(super) asset_type: String,
    pub(super) trim_start: f64,
    pub(super) timeline_start: f64,
    pub(super) timeline_duration: f64,
    pub(super) x: f64,
    pub(super) y: f64,
    pub(super) width: f64,
    pub(super) height: f64,
    pub(super) opacity: f64,
    pub(super) fit_mode: Option<String>,
    pub(super) crop_x: Option<f64>,
    pub(super) crop_y: Option<f64>,
    pub(super) crop_width: Option<f64>,
    pub(super) crop_height: Option<f64>,
    pub(super) z_index: i32,
}

pub(super) struct TextExportInfo {
    pub(super) text: String,
    pub(super) font_family: String,
    pub(super) font_size: f64,
    pub(super) color: String,
    pub(super) align: String,
    pub(super) timeline_start: f64,
    pub(super) timeline_duration: f64,
    pub(super) x: f64,
    pub(super) y: f64,
    pub(super) width: f64,
    pub(super) height: f64,
    pub(super) opacity: f64,
    pub(super) shadow_color: Option<String>,
    pub(super) shadow_x: Option<f64>,
    pub(super) shadow_y: Option<f64>,
    pub(super) outline_width: Option<f64>,
    pub(super) outline_color: Option<String>,
    pub(super) z_index: i32,
}

pub(super) struct ShapeExportInfo {
    pub(super) shape_type: String,
    pub(super) fill: String,
    pub(super) stroke: String,
    pub(super) stroke_width: f64,
    pub(super) corner_radius: Option<f64>,
    pub(super) timeline_start: f64,
    pub(super) timeline_duration: f64,
    pub(super) x: f64,
    pub(super) y: f64,
    pub(super) width: f64,
    pub(super) height: f64,
    pub(super) opacity: f64,
    pub(super) fps: f64,
    pub(super) z_index: i32,
}

pub(super) struct AudioExportInfo {
    pub(super) asset_path: String,
    pub(super) trim_start: f64,
    pub(super) timeline_start: f64,
    pub(super) timeline_duration: f64,
    pub(super) gain: f64,
}
