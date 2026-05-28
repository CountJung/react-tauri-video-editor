import { type InvokeArgs, convertFileSrc, invoke } from '@tauri-apps/api/core'
import { type EventCallback, type UnlistenFn, listen } from '@tauri-apps/api/event'

/**
 * Tauri IPC wrapper — @tauri-apps/api/core 직접 import 금지, 이 함수만 사용.
 * Tauri 환경 여부 자동 감지.
 */
export async function tauriInvoke<T>(command: string, args?: InvokeArgs): Promise<T> {
  return invoke<T>(command, args)
}

/**
 * Tauri 이벤트 구독 wrapper.
 * 컴포넌트 unmount 시 반드시 반환된 unlisten 함수를 호출할 것.
 */
export async function tauriListen<T>(
  event: string,
  handler: EventCallback<T>
): Promise<UnlistenFn> {
  return listen<T>(event, handler)
}

/** 로컬 파일 경로를 웹뷰에서 로드 가능한 URL로 변환 (asset:// 프로토콜) */
export { convertFileSrc }
