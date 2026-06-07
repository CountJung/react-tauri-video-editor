use crate::commands::common::AppError;
use std::path::Path;

/// 프로젝트 파일 저장 — `.vedproj` (JSON)
///
/// `path`: 저장할 절대 경로
/// `json`: 프론트엔드에서 직렬화한 프로젝트 JSON 문자열
#[tauri::command]
pub fn project_save(path: String, json: String) -> Result<(), AppError> {
    let p = Path::new(&path);

    // 상위 디렉토리 없으면 생성
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent).map_err(|e| {
                AppError::with_details(
                    "PROJECT_SAVE_DIR_ERROR",
                    "프로젝트 디렉토리 생성 실패",
                    e.to_string(),
                )
            })?;
        }
    }

    if let Err(e) = serde_json::from_str::<serde_json::Value>(&json) {
        return Err(AppError::with_details(
            "PROJECT_INVALID_JSON",
            "프로젝트 JSON 형식이 올바르지 않습니다",
            e.to_string(),
        ));
    }

    let tmp_path = p.with_extension("vedproj.tmp");
    std::fs::write(&tmp_path, json.as_bytes()).map_err(|e| {
        AppError::with_details(
            "PROJECT_SAVE_ERROR",
            format!("프로젝트 임시 파일 저장 실패: {}", tmp_path.display()),
            e.to_string(),
        )
    })?;

    std::fs::rename(&tmp_path, p).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_path);
        AppError::with_details(
            "PROJECT_SAVE_ERROR",
            format!("프로젝트 저장 실패: {}", p.display()),
            e.to_string(),
        )
    })
}

/// 프로젝트 파일 불러오기
///
/// `path`: 읽을 `.vedproj` 파일 절대 경로
/// 반환: JSON 문자열 (프론트엔드에서 파싱)
#[tauri::command]
pub fn project_load(path: String) -> Result<String, AppError> {
    let p = Path::new(&path);

    if !p.exists() {
        return Err(AppError::new(
            "PROJECT_NOT_FOUND",
            format!("프로젝트 파일을 찾을 수 없습니다: {}", p.display()),
        ));
    }

    std::fs::read_to_string(p).map_err(|e| {
        AppError::with_details(
            "PROJECT_LOAD_ERROR",
            format!("프로젝트 불러오기 실패: {}", p.display()),
            e.to_string(),
        )
    })
}
