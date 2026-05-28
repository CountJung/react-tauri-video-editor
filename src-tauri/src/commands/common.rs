/// 공통 에러 타입 및 이벤트 상수

#[derive(Debug, serde::Serialize, Clone)]
pub struct AppError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl AppError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            details: None,
        }
    }

    pub fn with_details(code: &str, message: impl Into<String>, details: impl Into<String>) -> Self {
        Self {
            code: code.to_string(),
            message: message.into(),
            details: Some(details.into()),
        }
    }
}

// Tauri 이벤트 이름 상수
pub const EVENT_FFMPEG_PROGRESS: &str = "ffmpeg-progress";
pub const EVENT_FFMPEG_DONE: &str = "ffmpeg-done";
pub const EVENT_FFMPEG_ERROR: &str = "ffmpeg-error";
pub const EVENT_THUMBNAIL_READY: &str = "thumbnail-ready";
