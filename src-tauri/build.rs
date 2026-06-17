use std::{collections::HashMap, env, fs, path::Path};

const BUILD_TIME_ENV_KEYS: &[&str] = &["APP_TEMP_DIR"];

fn parse_dotenv(path: &Path) -> HashMap<String, String> {
    let Ok(contents) = fs::read_to_string(path) else {
        return HashMap::new();
    };

    contents
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }

            let line = line.strip_prefix("export ").unwrap_or(line);
            let (key, value) = line.split_once('=')?;
            let key = key.trim();
            if key.is_empty() {
                return None;
            }

            let value = value
                .trim()
                .trim_matches(|c| c == '"' || c == '\'')
                .to_string();
            Some((key.to_string(), value))
        })
        .collect()
}

fn inject_build_time_env() {
    let dotenv_path = Path::new("../.env");
    println!("cargo:rerun-if-changed={}", dotenv_path.display());

    let dotenv = parse_dotenv(dotenv_path);
    for key in BUILD_TIME_ENV_KEYS {
        println!("cargo:rerun-if-env-changed={key}");
        let value = env::var(key).ok().or_else(|| dotenv.get(*key).cloned());
        if let Some(value) = value {
            println!("cargo:rustc-env={key}={value}");
        }
    }
}

fn main() {
    inject_build_time_env();
    tauri_build::build()
}
