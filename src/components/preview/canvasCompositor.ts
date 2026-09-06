import { getDisplayableMediaSrc } from '@/lib/mediaSource'
import type { Asset, Clip, Track } from '@/store/timelineStore'

export interface ActiveLayer {
  track: Track
  clip: Clip
  asset?: Asset
}

export interface DrawRect {
  sx?: number
  sy?: number
  sw?: number
  sh?: number
  dx: number
  dy: number
  dw: number
  dh: number
}

export function getContainedCanvasDisplaySize(
  canvasWidth: number,
  canvasHeight: number,
  availableWidth: number,
  availableHeight: number,
  maxScale?: number | null
): { width: number; height: number } {
  const fitScale = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight)
  const scale = Math.min(fitScale, maxScale ?? fitScale)
  return {
    width: Math.max(1, Math.round(canvasWidth * scale)),
    height: Math.max(1, Math.round(canvasHeight * scale)),
  }
}

export function getMediaSourceSize(
  asset: Pick<Asset, 'width' | 'height'>,
  mediaSize: { width?: number; height?: number },
  clip: Pick<Clip, 'width' | 'height'>
): { width: number; height: number } {
  return {
    width: asset.width || mediaSize.width || clip.width,
    height: asset.height || mediaSize.height || clip.height,
  }
}

export function getClipLocalTime(clip: Clip, timelineTime: number): number {
  return clip.trimStart + (timelineTime - clip.start) * (clip.playbackRate ?? 1)
}

/** 타임라인 시각을 클립의 trim 구간 안으로 잘라낸 원본 미디어 시각 */
export function clampClipMediaTime(clip: Clip, timelineTime: number): number {
  const targetTime = getClipLocalTime(clip, timelineTime)
  return Math.max(clip.trimStart, Math.min(clip.trimEnd, targetTime))
}

export function isClipActive(clip: Clip, timelineTime: number): boolean {
  return timelineTime >= clip.start && timelineTime < clip.start + clip.duration
}

export function getClipFadeOpacity(clip: Clip, timelineTime: number): number {
  const localTime = timelineTime - clip.start
  const remainingTime = clip.duration - localTime
  const fadeIn = Math.max(0, clip.fadeInDuration ?? 0)
  const fadeOut = Math.max(0, clip.fadeOutDuration ?? 0)
  const fadeInOpacity = fadeIn > 0 ? Math.min(1, Math.max(0, localTime / fadeIn)) : 1
  const fadeOutOpacity = fadeOut > 0 ? Math.min(1, Math.max(0, remainingTime / fadeOut)) : 1
  return Math.min(fadeInOpacity, fadeOutOpacity)
}

function interpolateKeyframeValue(
  baseValue: number,
  timelineTime: number,
  clipStart: number,
  keyframes: Array<{ time: number; value: number }>
): number {
  const localTime = timelineTime - clipStart
  const points = [{ time: 0, value: baseValue }, ...keyframes].sort((a, b) => a.time - b.time)
  let previous = points[0]
  for (const point of points) {
    if (point.time <= localTime) previous = point
  }
  const next = points.find((point) => point.time > localTime)
  if (!previous || !next) return previous?.value ?? baseValue
  const span = next.time - previous.time
  if (span <= 0) return next.value
  const amount = (localTime - previous.time) / span
  return previous.value + (next.value - previous.value) * amount
}

export function resolveClipKeyframes(clip: Clip, timelineTime: number): Clip {
  if (!clip.keyframes.length) return clip
  const keyframes = clip.keyframes
  return {
    ...clip,
    x: interpolateKeyframeValue(
      clip.x,
      timelineTime,
      clip.start,
      keyframes.map((keyframe) => ({ time: keyframe.time, value: keyframe.x }))
    ),
    y: interpolateKeyframeValue(
      clip.y,
      timelineTime,
      clip.start,
      keyframes.map((keyframe) => ({ time: keyframe.time, value: keyframe.y }))
    ),
    width: interpolateKeyframeValue(
      clip.width,
      timelineTime,
      clip.start,
      keyframes.map((keyframe) => ({ time: keyframe.time, value: keyframe.width }))
    ),
    height: interpolateKeyframeValue(
      clip.height,
      timelineTime,
      clip.start,
      keyframes.map((keyframe) => ({ time: keyframe.time, value: keyframe.height }))
    ),
    opacity: interpolateKeyframeValue(
      clip.opacity,
      timelineTime,
      clip.start,
      keyframes.map((keyframe) => ({ time: keyframe.time, value: keyframe.opacity }))
    ),
  }
}

export function collectActiveLayers(
  tracks: Track[],
  assets: Asset[],
  timelineTime: number
): ActiveLayer[] {
  return tracks
    .filter((track) => track.type !== 'audio' && track.visible)
    .flatMap((track) =>
      track.clips
        .filter((clip) => isClipActive(clip, timelineTime))
        .map((clip) => ({
          track,
          clip: resolveClipKeyframes(clip, timelineTime),
          asset: clip.assetId ? assets.find((asset) => asset.id === clip.assetId) : undefined,
        }))
    )
    .filter((layer) => layer.clip.clipType !== 'media' || Boolean(layer.asset))
    .sort((a, b) => a.track.zIndex - b.track.zIndex)
}

export function getFitDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  clip: Pick<Clip, 'x' | 'y' | 'width' | 'height' | 'fitMode' | 'cropRect'>
): DrawRect {
  const mode = clip.fitMode ?? 'fit'
  const sourceAspect = sourceWidth / sourceHeight
  const targetAspect = clip.width / clip.height

  if (mode === 'stretch') return { dx: clip.x, dy: clip.y, dw: clip.width, dh: clip.height }

  if (mode === 'center') {
    return {
      dx: clip.x + (clip.width - sourceWidth) / 2,
      dy: clip.y + (clip.height - sourceHeight) / 2,
      dw: sourceWidth,
      dh: sourceHeight,
    }
  }

  if (mode === 'crop' && clip.cropRect) {
    return {
      sx: clip.cropRect.x,
      sy: clip.cropRect.y,
      sw: clip.cropRect.width,
      sh: clip.cropRect.height,
      dx: clip.x,
      dy: clip.y,
      dw: clip.width,
      dh: clip.height,
    }
  }

  if (mode === 'fill') {
    if (sourceAspect > targetAspect) {
      const sw = sourceHeight * targetAspect
      return {
        sx: (sourceWidth - sw) / 2,
        sy: 0,
        sw,
        sh: sourceHeight,
        dx: clip.x,
        dy: clip.y,
        dw: clip.width,
        dh: clip.height,
      }
    }
    const sh = sourceWidth / targetAspect
    return {
      sx: 0,
      sy: (sourceHeight - sh) / 2,
      sw: sourceWidth,
      sh,
      dx: clip.x,
      dy: clip.y,
      dw: clip.width,
      dh: clip.height,
    }
  }

  const scale = Math.min(clip.width / sourceWidth, clip.height / sourceHeight)
  const dw = sourceWidth * scale
  const dh = sourceHeight * scale
  return { dx: clip.x + (clip.width - dw) / 2, dy: clip.y + (clip.height - dh) / 2, dw, dh }
}

export function drawImageLike(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  clip: Clip
): void {
  const rect = getFitDrawRect(sourceWidth, sourceHeight, clip)
  if (
    rect.sx !== undefined &&
    rect.sy !== undefined &&
    rect.sw !== undefined &&
    rect.sh !== undefined
  ) {
    ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, rect.dx, rect.dy, rect.dw, rect.dh)
  } else {
    ctx.drawImage(image, rect.dx, rect.dy, rect.dw, rect.dh)
  }
}

export function drawTextClip(ctx: CanvasRenderingContext2D, clip: Clip): void {
  if (!clip.textProps) return
  const props = clip.textProps
  const fontStyle = [
    props.italic ? 'italic' : '',
    props.bold ? '700' : '',
    `${props.fontSize}px`,
    props.fontFamily,
  ]
    .filter(Boolean)
    .join(' ')
  ctx.font = fontStyle
  ctx.textAlign = props.align
  ctx.textBaseline = 'middle'
  ctx.fillStyle = props.color

  if (props.shadow) {
    ctx.shadowBlur = props.shadow.blur
    ctx.shadowColor = props.shadow.color
    ctx.shadowOffsetX = props.shadow.offsetX
    ctx.shadowOffsetY = props.shadow.offsetY
  }

  const x =
    props.align === 'left'
      ? clip.x
      : props.align === 'right'
        ? clip.x + clip.width
        : clip.x + clip.width / 2
  const y = clip.y + clip.height / 2

  if (props.outline && props.outline.width > 0) {
    ctx.lineWidth = props.outline.width
    ctx.strokeStyle = props.outline.color
    ctx.strokeText(props.text, x, y, clip.width)
  }
  ctx.fillText(props.text, x, y, clip.width)
}

export function drawShapeClip(ctx: CanvasRenderingContext2D, clip: Clip): void {
  const props = clip.shapeProps
  if (!props) return
  ctx.fillStyle = props.fill
  ctx.strokeStyle = props.stroke
  ctx.lineWidth = props.strokeWidth
  ctx.setLineDash(props.dash ?? [])
  ctx.beginPath()

  if (props.shapeType === 'circle') {
    ctx.ellipse(
      clip.x + clip.width / 2,
      clip.y + clip.height / 2,
      Math.abs(clip.width / 2),
      Math.abs(clip.height / 2),
      0,
      0,
      Math.PI * 2
    )
  } else if (props.shapeType === 'arrow') {
    const startX = clip.x
    const startY = clip.y + clip.height / 2
    const endX = clip.x + clip.width
    const endY = clip.y + clip.height / 2
    const head = Math.min(40, Math.max(12, props.strokeWidth * 5))
    ctx.moveTo(startX, startY)
    ctx.lineTo(endX, endY)
    ctx.moveTo(endX - head, endY - head / 2)
    ctx.lineTo(endX, endY)
    ctx.lineTo(endX - head, endY + head / 2)
  } else {
    const radius = Math.max(0, Math.min(props.cornerRadius ?? 0, clip.width / 2, clip.height / 2))
    if (radius > 0) ctx.roundRect(clip.x, clip.y, clip.width, clip.height, radius)
    else ctx.rect(clip.x, clip.y, clip.width, clip.height)
  }

  if (props.fill !== 'transparent' && props.shapeType !== 'arrow') ctx.fill()
  if (props.stroke !== 'transparent' && props.strokeWidth > 0) ctx.stroke()
  ctx.setLineDash([])
}

export function withClipTransform(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  trackOpacity: number,
  draw: () => void
): void {
  ctx.save()
  ctx.globalAlpha = Math.max(0, Math.min(1, clip.opacity * trackOpacity))
  const cx = clip.x + clip.width / 2
  const cy = clip.y + clip.height / 2
  ctx.translate(cx, cy)
  ctx.rotate((clip.rotation * Math.PI) / 180)
  ctx.translate(-cx, -cy)
  ctx.beginPath()
  ctx.rect(clip.x, clip.y, clip.width, clip.height)
  ctx.clip()
  draw()
  ctx.restore()
}

export function hitTestClip(clip: Clip, x: number, y: number): boolean {
  const cx = clip.x + clip.width / 2
  const cy = clip.y + clip.height / 2
  const angle = (-clip.rotation * Math.PI) / 180
  const dx = x - cx
  const dy = y - cy
  const localX = cx + dx * Math.cos(angle) - dy * Math.sin(angle)
  const localY = cy + dx * Math.sin(angle) + dy * Math.cos(angle)
  return (
    localX >= clip.x &&
    localX <= clip.x + clip.width &&
    localY >= clip.y &&
    localY <= clip.y + clip.height
  )
}

export function hitTestLayers(layers: ActiveLayer[], x: number, y: number): Clip | null {
  for (let i = layers.length - 1; i >= 0; i -= 1) {
    const clip = layers[i]?.clip
    if (clip && hitTestClip(clip, x, y)) return clip
  }
  return null
}

export function getAssetUrl(asset: Asset): string {
  return getDisplayableMediaSrc(asset.path)
}
