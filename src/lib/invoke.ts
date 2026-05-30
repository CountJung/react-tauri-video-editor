import { type InvokeArgs, convertFileSrc, invoke } from '@tauri-apps/api/core'
import { type EventCallback, type UnlistenFn, listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

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

/**
 * 창 닫기 요청 이벤트 구독 wrapper.
 * `event.preventDefault()`를 호출하면 창이 닫히지 않는다.
 */
export async function tauriOnCloseRequested(
  handler: (event: { preventDefault: () => void }) => void
): Promise<UnlistenFn> {
  return getCurrentWindow().onCloseRequested(handler)
}

/** 현재 Tauri 창을 닫는다 */
export async function tauriCloseWindow(): Promise<void> {
  await getCurrentWindow().close()
}

/** 로컬 파일 경로를 웹뷰에서 로드 가능한 URL로 변환 (asset:// 프로토콜) */
export { convertFileSrc }
