#!/usr/bin/env node
/**
 * Windows 개발 환경 초기 세팅 스크립트
 *
 * 실행 방법:
 *   node scripts/setup-windows.mjs
 *
 * 이 스크립트는 다음을 수행합니다:
 *   1. Rust 도구체인 확인
 *   2. pnpm 확인
 *   3. CARGO_TARGET_DIR 캐시 디렉터리 생성
 *   4. rust-analyzer 경로 설정 안내
 *   5. FFmpeg 바이너리 다운로드 (선택)
 */

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const isWindows = process.platform === "win32";
const homeDir = homedir();

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: "utf-8", ...opts }).trim();
  } catch {
    return null;
  }
}

function checkRequired(name, cmd) {
  const out = run(cmd);
  if (out) {
    console.log(`  ✅ ${name}: ${out.split("\n")[0]}`);
    return true;
  }
  console.error(`  ❌ ${name}: 설치되지 않음`);
  return false;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function patchRustAnalyzerTargetDir(settingsRaw, targetDir) {
  const escapedTargetDir = targetDir.replace(/\\/g, "\\\\");
  const extraEnvKeys = [
    "rust-analyzer.server.extraEnv",
    "rust-analyzer.cargo.extraEnv",
    "rust-analyzer.check.extraEnv",
  ];

  let patched = settingsRaw;
  for (const key of extraEnvKeys) {
    const keyPattern = escapeRegExp(key);
    const re = new RegExp(
      `("${keyPattern}"\\s*:\\s*\\{\\s*"CARGO_TARGET_DIR"\\s*:\\s*)"(?:[^"\\\\]|\\\\.)*"(\\s*\\})`,
      "g",
    );
    patched = patched.replace(re, `$1"${escapedTargetDir}"$2`);
  }

  return patched;
}

console.log("=== React + Tauri Video Editor — Windows 개발 환경 초기화 ===\n");

// 1. 필수 도구 확인
console.log("[1/4] 필수 도구 확인");
const hasRust = checkRequired("rustc", "rustc --version");
const hasCargo = checkRequired("cargo", "cargo --version");
const hasNode = checkRequired("node", "node --version");
const hasPnpm = checkRequired("pnpm", "pnpm --version");

if (!hasRust || !hasCargo) {
  console.error("\n  ❌ Rust 미설치. https://rustup.rs 에서 rustup을 설치하세요.");
  console.error("     설치 후 이 스크립트를 다시 실행하세요.");
  process.exit(1);
}

if (!hasPnpm) {
  console.error("\n  ❌ pnpm 미설치. 다음 명령으로 설치하세요:");
  console.error("     npm install -g pnpm");
  process.exit(1);
}

// 2. Windows MSVC 링커 확인
console.log("\n[2/4] Windows 빌드 도구 확인");
if (isWindows) {
  const msvcCheck = run("where cl.exe 2>nul");
  if (msvcCheck) {
    console.log("  ✅ MSVC cl.exe 발견:", msvcCheck.split("\n")[0]);
  } else {
    console.warn("  ⚠️  MSVC cl.exe 미발견.");
    console.warn(
      "     winget install Microsoft.VisualStudioBuildTools 로 설치 후",
    );
    console.warn(
      '     "Desktop development with C++" 워크로드를 선택하세요.',
    );
  }

  // Rust Windows MSVC 타겟 확인
  const targets = run("rustup target list --installed");
  if (targets && targets.includes("x86_64-pc-windows-msvc")) {
    console.log("  ✅ x86_64-pc-windows-msvc 타겟 설치됨");
  } else {
    console.log("  📦 x86_64-pc-windows-msvc 타겟 설치 중...");
    const result = spawnSync("rustup", ["target", "add", "x86_64-pc-windows-msvc"], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      console.error("  ❌ 타겟 설치 실패");
    } else {
      console.log("  ✅ 타겟 설치 완료");
    }
  }
} else {
  console.log("  ℹ️  Windows가 아닌 환경 — 건너뜀");
}

// 3. CARGO_TARGET_DIR 캐시 디렉터리 생성
console.log("\n[3/4] CARGO_TARGET_DIR 캐시 디렉터리 생성");
const cacheBase = path.join(homeDir, ".cache", "react-tauri-video-editor-target");
const cacheRA = path.join(cacheBase, "rust-analyzer");

if (!existsSync(cacheBase)) {
  mkdirSync(cacheBase, { recursive: true });
  console.log("  ✅ 생성:", cacheBase);
} else {
  console.log("  ✅ 이미 존재:", cacheBase);
}

if (!existsSync(cacheRA)) {
  mkdirSync(cacheRA, { recursive: true });
  console.log("  ✅ 생성:", cacheRA);
} else {
  console.log("  ✅ 이미 존재:", cacheRA);
}

// 4. rust-analyzer settings.json 경로 패치 안내
console.log("\n[4/4] rust-analyzer 설정 안내");
const settingsPath = ".vscode/settings.json";
if (existsSync(settingsPath)) {
  const settingsRaw = readFileSync(settingsPath, "utf-8");

  if (isWindows) {
    const winPath = path.join(cacheRA).replace(/\\/g, "\\\\");
    const patched = patchRustAnalyzerTargetDir(settingsRaw, winPath);

    if (patched !== settingsRaw) {
      writeFileSync(settingsPath, patched, "utf-8");
      console.log("  ✅ .vscode/settings.json의 rust-analyzer 경로를 자동으로 업데이트했습니다:");
      console.log("    ", winPath);
    } else {
      console.log("  ✅ rust-analyzer 경로 확인 완료");
    }
  } else if (settingsRaw.includes("/Users/") || settingsRaw.includes("${env:")) {
    console.log("  ℹ️  .vscode/settings.json의 rust-analyzer extraEnv 경로는");
    console.log("     Windows에서 setup:windows 실행 시 사용자 홈 절대 경로로 자동 치환됩니다.");
    console.log("     macOS: ~/.cache/react-tauri-video-editor-target/rust-analyzer");
    console.log("    Windows: %USERPROFILE%\\.cache\\react-tauri-video-editor-target\\rust-analyzer");
  } else {
    console.log("  ✅ rust-analyzer 경로 확인 완료");
  }
}

// 5. pnpm install
console.log("\n[완료] 의존성 설치를 시작합니다...");
const install = spawnSync("pnpm", ["install"], { stdio: "inherit", shell: isWindows });
if (install.status !== 0) {
  console.error("  ❌ pnpm install 실패");
  process.exit(1);
}

console.log(`
=== 설정 완료 ===

다음 단계:
  1. FFmpeg 바이너리 다운로드:  pnpm install-ffmpeg
  2. 개발 서버 시작:             pnpm dev
  3. 디버깅:                     VS Code에서 F5 → "Debug Tauri App (Windows)"

주의:
  - rust-analyzer.*.extraEnv의 CARGO_TARGET_DIR은 반드시
    실제 절대 경로여야 합니다 (\${env:...} 치환 불가).
    Windows 경로: ${cacheRA}
`);
