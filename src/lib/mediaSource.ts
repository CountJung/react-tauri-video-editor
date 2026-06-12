import { convertFileSrc } from './invoke'

export function isBrowserMediaUrl(path: string): boolean {
  return /^(blob:|data:|https?:)/i.test(path)
}

export function getDisplayableMediaSrc(path: string): string {
  return isBrowserMediaUrl(path) ? path : convertFileSrc(path)
}
