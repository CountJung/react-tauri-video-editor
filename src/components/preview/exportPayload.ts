import type { ProjectMeta } from '@/store/projectStore'
import type { Asset } from '@/store/timelineStore'
import type { Clip, Track } from '@/store/timelineStore'

export interface ExportTimelinePayload {
  projectMeta: ProjectMeta
  tracks: Track[]
  assets: Asset[]
}

export interface ExportSettings {
  width: number
  height: number
  fps: number
}

export function scaleClipForExport(
  clip: Clip,
  scaleX: number,
  scaleY: number,
  scale: number
): Clip {
  return {
    ...clip,
    x: clip.x * scaleX,
    y: clip.y * scaleY,
    width: clip.width * scaleX,
    height: clip.height * scaleY,
    textProps: clip.textProps
      ? {
          ...clip.textProps,
          fontSize: clip.textProps.fontSize * scale,
          shadow: clip.textProps.shadow
            ? {
                ...clip.textProps.shadow,
                blur: clip.textProps.shadow.blur * scale,
                offsetX: clip.textProps.shadow.offsetX * scaleX,
                offsetY: clip.textProps.shadow.offsetY * scaleY,
              }
            : undefined,
          outline: clip.textProps.outline
            ? {
                ...clip.textProps.outline,
                width: clip.textProps.outline.width * scale,
              }
            : undefined,
        }
      : undefined,
    shapeProps: clip.shapeProps
      ? {
          ...clip.shapeProps,
          strokeWidth: clip.shapeProps.strokeWidth * scale,
          cornerRadius:
            clip.shapeProps.cornerRadius !== undefined
              ? clip.shapeProps.cornerRadius * scale
              : undefined,
        }
      : undefined,
  }
}

export function buildExportTimelinePayload(params: {
  projectMeta: ProjectMeta
  tracks: Track[]
  assets: Asset[]
  canvasWidth: number
  canvasHeight: number
  settings: ExportSettings
}): ExportTimelinePayload {
  const scaleX = params.settings.width / params.canvasWidth
  const scaleY = params.settings.height / params.canvasHeight
  const scale = Math.min(scaleX, scaleY)
  return {
    projectMeta: {
      ...params.projectMeta,
      canvasWidth: params.settings.width,
      canvasHeight: params.settings.height,
      fps: params.settings.fps,
    },
    tracks: params.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => scaleClipForExport(clip, scaleX, scaleY, scale)),
    })),
    assets: params.assets,
  }
}
