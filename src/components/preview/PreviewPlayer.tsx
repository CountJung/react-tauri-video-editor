import { STORAGE_KEYS } from '@/lib/storageKeys'
import { useStickyState } from '@/lib/useStickyState'
import { withHistory } from '@/lib/withHistory'
import { useAssetStore } from '@/store/assetStore'
import type { Clip, ShapeType } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useToolStore } from '@/store/toolStore'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResizableDialog } from '../common/ResizableDialog'
import {
  type ActiveLayer,
  clampClipMediaTime,
  collectActiveLayers,
  drawImageLike,
  drawShapeClip,
  drawTextClip,
  getAssetUrl,
  getClipFadeOpacity,
  getContainedCanvasDisplaySize,
  getMediaSourceSize,
  hitTestLayers,
  withClipTransform,
} from './canvasCompositor'
import {
  type ActiveAudioSource,
  collectActiveAudioSources,
  getAudioElementVolume,
  getAudioSourceGain,
  getMediaElementKey,
  makeAudioSyncKey,
} from './previewAudio'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function drawSelection(ctx: CanvasRenderingContext2D, clip: Clip): void {
  ctx.save()
  ctx.strokeStyle = '#64b5f6'
  ctx.lineWidth = 2
  ctx.setLineDash([10, 6])
  ctx.strokeRect(clip.x, clip.y, clip.width, clip.height)
  ctx.setLineDash([])
  ctx.fillStyle = '#64b5f6'
  const size = 12
  const points = [
    [clip.x, clip.y],
    [clip.x + clip.width / 2, clip.y],
    [clip.x + clip.width, clip.y],
    [clip.x, clip.y + clip.height / 2],
    [clip.x + clip.width, clip.y + clip.height / 2],
    [clip.x, clip.y + clip.height],
    [clip.x + clip.width / 2, clip.y + clip.height],
    [clip.x + clip.width, clip.y + clip.height],
  ]
  for (const [x, y] of points) ctx.fillRect(x - size / 2, y - size / 2, size, size)
  ctx.beginPath()
  ctx.arc(clip.x + clip.width / 2, clip.y - 38, 7, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLE_SIZE = 18
const MIN_OBJECT_SIZE = 16
const FALLBACK_TEXT_PROPS = {
  text: '',
  fontFamily: 'sans-serif',
  fontSize: 72,
  color: '#ffffff',
  bold: false,
  italic: false,
  align: 'center' as const,
}

type PreviewZoom = 'fit' | '25' | '50' | '75' | '100' | '150'

const PREVIEW_ZOOM_OPTIONS: Array<{ value: PreviewZoom; label: string }> = [
  { value: 'fit', label: '맞춤' },
  { value: '25', label: '25%' },
  { value: '50', label: '50%' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
  { value: '150', label: '150%' },
]

const PLAYING_SEEK_DRIFT_SECONDS = 0.75
const PAUSED_SEEK_EPSILON_SECONDS = 0.08
/** 프리뷰 마스터 볼륨 기본값 (0~1) */
const DEFAULT_MASTER_VOLUME = 1

function findTrackId(
  tracks: ReturnType<typeof useTimelineStore.getState>['tracks'],
  type: string
): string | null {
  return tracks.find((track) => track.type === type)?.id ?? null
}

function makeVideoSyncKey(clip: Clip): string {
  return [clip.id, clip.start, clip.duration, clip.trimStart, clip.trimEnd, clip.playbackRate].join(
    ':'
  )
}

function getResizeHandle(clip: Clip, x: number, y: number): ResizeHandle | null {
  const half = HANDLE_SIZE / 2
  const handles: Array<{ handle: ResizeHandle; x: number; y: number }> = [
    { handle: 'nw', x: clip.x, y: clip.y },
    { handle: 'n', x: clip.x + clip.width / 2, y: clip.y },
    { handle: 'ne', x: clip.x + clip.width, y: clip.y },
    { handle: 'e', x: clip.x + clip.width, y: clip.y + clip.height / 2 },
    { handle: 'se', x: clip.x + clip.width, y: clip.y + clip.height },
    { handle: 's', x: clip.x + clip.width / 2, y: clip.y + clip.height },
    { handle: 'sw', x: clip.x, y: clip.y + clip.height },
    { handle: 'w', x: clip.x, y: clip.y + clip.height / 2 },
  ]
  return handles.find((p) => Math.abs(x - p.x) <= half && Math.abs(y - p.y) <= half)?.handle ?? null
}

function isRotationHandle(clip: Clip, x: number, y: number): boolean {
  const rx = clip.x + clip.width / 2
  const ry = clip.y - 38
  return Math.hypot(x - rx, y - ry) <= 18
}

function resizeClipRect(clip: Clip, handle: ResizeHandle, dx: number, dy: number) {
  let { x, y, width, height } = clip
  if (handle.includes('w')) {
    x += dx
    width -= dx
  }
  if (handle.includes('e')) width += dx
  if (handle.includes('n')) {
    y += dy
    height -= dy
  }
  if (handle.includes('s')) height += dy
  if (width < MIN_OBJECT_SIZE) {
    if (handle.includes('w')) x -= MIN_OBJECT_SIZE - width
    width = MIN_OBJECT_SIZE
  }
  if (height < MIN_OBJECT_SIZE) {
    if (handle.includes('n')) y -= MIN_OBJECT_SIZE - height
    height = MIN_OBJECT_SIZE
  }
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  }
}

function releaseVideoElement(video: HTMLVideoElement): void {
  video.pause()
  video.onloadeddata = null
  video.onseeked = null
  video.onerror = null
  video.removeAttribute('src')
  video.load()
}

function releaseImageElement(image: HTMLImageElement): void {
  image.onload = null
  image.onerror = null
  image.removeAttribute('src')
}

function releaseAudioElement(audio: HTMLAudioElement): void {
  audio.pause()
  audio.onerror = null
  audio.removeAttribute('src')
  audio.load()
}

/** Phase 5 — Canvas 기반 합성 프리뷰 플레이어 */
export function PreviewPlayer() {
  const assets = useAssetStore((s) => s.assets)
  const tracks = useTimelineStore((s) => s.tracks)
  const duration = useTimelineStore((s) => s.duration)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const storeCurrentTime = useTimelineStore((s) => s.currentTime)
  const canvasWidth = useTimelineStore((s) => s.canvasWidth)
  const canvasHeight = useTimelineStore((s) => s.canvasHeight)
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const activeTool = useToolStore((s) => s.activeTool)
  const cropEditing = useToolStore((s) => s.cropEditing)
  const {
    setPlaying,
    setCurrentTime,
    selectClip,
    updateClipCanvas,
    normalizeMediaClipBounds,
    addTextClip,
    addShapeClip,
    splitClip,
  } = useTimelineStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewViewportRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number | null>(null)
  const playRafRef = useRef<number | null>(null)
  const playLastTsRef = useRef<number | null>(null)
  const currentTimeRef = useRef(storeCurrentTime)
  const durationRef = useRef(duration)
  const isPlayingRef = useRef(isPlaying)
  const activeToolRef = useRef(activeTool)
  const cropEditingRef = useRef(cropEditing)
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const videoSyncKeyRef = useRef<Map<string, string>>(new Map())
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  /** 오디오 element는 clip 단위로 소유한다 (동일 에셋을 여러 구간에 배치할 수 있음) */
  const audioCacheRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const audioSyncKeyRef = useRef<Map<string, string>>(new Map())
  const dragRef = useRef<{
    mode: 'move' | 'resize' | 'rotate'
    clipId: string
    startX: number
    startY: number
    clip: Clip
    handle?: ResizeHandle
    historyLabel: string
    historyPushed: boolean
  } | null>(null)
  const draftShapeRef = useRef<{ shapeType: ShapeType; startX: number; startY: number } | null>(
    null
  )
  const draftCropRef = useRef<{
    clip: Clip
    assetWidth: number
    assetHeight: number
    startX: number
    startY: number
  } | null>(null)

  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [isSliderDragging, setIsSliderDragging] = useState(false)
  const [textDialog, setTextDialog] = useState<{ clipId: string; text: string } | null>(null)
  const [previewZoom, setPreviewZoom] = useStickyState<PreviewZoom>(
    'fit',
    STORAGE_KEYS.PREVIEW_CANVAS_ZOOM
  )
  const [masterVolume, setMasterVolume] = useStickyState<number>(
    DEFAULT_MASTER_VOLUME,
    STORAGE_KEYS.PREVIEW_VOLUME
  )
  const [isMuted, setIsMuted] = useStickyState<boolean>(false, STORAGE_KEYS.PREVIEW_MUTED)
  const masterVolumeRef = useRef(masterVolume)
  const isMutedRef = useRef(isMuted)

  useEffect(() => {
    masterVolumeRef.current = masterVolume
  }, [masterVolume])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])
  const previewMaxScale = previewZoom === 'fit' ? null : Number(previewZoom) / 100
  const [fitCanvasSize, setFitCanvasSize] = useState({ width: canvasWidth, height: canvasHeight })

  useEffect(() => {
    normalizeMediaClipBounds()
  }, [normalizeMediaClipBounds])

  useEffect(() => {
    currentTimeRef.current = storeCurrentTime
  }, [storeCurrentTime])
  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  useEffect(() => {
    isPlayingRef.current = isPlaying
  }, [isPlaying])

  useEffect(() => {
    activeToolRef.current = activeTool
  }, [activeTool])

  useEffect(() => {
    cropEditingRef.current = cropEditing
  }, [cropEditing])

  useEffect(() => {
    const viewport = previewViewportRef.current
    if (!viewport) return

    const updateSize = () => {
      const style = window.getComputedStyle(viewport)
      const paddingX = Number.parseFloat(style.paddingLeft) + Number.parseFloat(style.paddingRight)
      const paddingY = Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom)
      const availableWidth = Math.max(1, viewport.clientWidth - paddingX)
      const availableHeight = Math.max(1, viewport.clientHeight - paddingY)
      setFitCanvasSize(
        getContainedCanvasDisplaySize(
          canvasWidth,
          canvasHeight,
          availableWidth,
          availableHeight,
          previewMaxScale
        )
      )
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(viewport)
    return () => observer.disconnect()
  }, [canvasWidth, canvasHeight, previewMaxScale])

  const activeLayers = useMemo(
    () => collectActiveLayers(tracks, assets, storeCurrentTime),
    [tracks, assets, storeCurrentTime]
  )

  const activeAudioSources = useMemo(
    () => collectActiveAudioSources(tracks, assets, storeCurrentTime),
    [tracks, assets, storeCurrentTime]
  )
  const activeAudioSourcesRef = useRef<ActiveAudioSource[]>(activeAudioSources)

  useEffect(() => {
    activeAudioSourcesRef.current = activeAudioSources
  }, [activeAudioSources])

  const selectedClip = useMemo(
    () => tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) ?? null,
    [tracks, selectedClipId]
  )
  const activeLayersRef = useRef<ActiveLayer[]>(activeLayers)
  const selectedClipRef = useRef<Clip | null>(selectedClip)

  useEffect(() => {
    activeLayersRef.current = activeLayers
  }, [activeLayers])

  useEffect(() => {
    selectedClipRef.current = selectedClip
  }, [selectedClip])

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    for (const layer of activeLayersRef.current) {
      const { clip, track, asset } = layer

      withClipTransform(
        ctx,
        clip,
        track.opacity * getClipFadeOpacity(clip, currentTimeRef.current),
        () => {
          if (clip.clipType === 'text') drawTextClip(ctx, clip)
          else if (clip.clipType === 'shape') drawShapeClip(ctx, clip)
          else if (asset?.type === 'video') {
            const video = videoCacheRef.current.get(getMediaElementKey(clip))
            if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              const source = getMediaSourceSize(
                asset,
                { width: video.videoWidth, height: video.videoHeight },
                clip
              )
              drawImageLike(ctx, video, source.width, source.height, clip)
            }
          } else if (asset?.type === 'image') {
            const img = imageCacheRef.current.get(asset.id)
            if (img?.complete) {
              const source = getMediaSourceSize(
                asset,
                { width: img.naturalWidth, height: img.naturalHeight },
                clip
              )
              drawImageLike(ctx, img, source.width, source.height, clip)
            }
          }
        }
      )
    }

    const shouldDrawSelection = activeToolRef.current === 'crop' && cropEditingRef.current
    if (selectedClipRef.current && shouldDrawSelection) drawSelection(ctx, selectedClipRef.current)
  }, [])

  const scheduleDrawFrame = useCallback(
    (invalidation?: unknown) => {
      void invalidation
      if (isPlayingRef.current) return
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        drawFrame()
      })
    },
    [drawFrame]
  )

  const syncMediaElements = useCallback(
    (
      layers: ActiveLayer[],
      timelineTime: number,
      options: {
        forceSeek: boolean
        playing: boolean
        /** embedded 오디오를 들려줘야 하는 클립 (video 트랙 비디오 클립) */
        audibleClipIds: Set<string>
        /** embedded 오디오에 적용할 element volume */
        audioVolume: number
      }
    ) => {
      const activeVideoKeys = new Set<string>()

      for (const layer of layers) {
        const asset = layer.asset
        if (!asset) continue
        const url = getAssetUrl(asset)

        if (asset.type === 'image') {
          const cachedImage = imageCacheRef.current.get(asset.id)
          if (cachedImage?.dataset.sourceUrl !== url) {
            if (cachedImage) releaseImageElement(cachedImage)
            const img = new Image()
            img.onload = scheduleDrawFrame
            img.onerror = scheduleDrawFrame
            img.dataset.sourceUrl = url
            img.src = url
            imageCacheRef.current.set(asset.id, img)
          }
          continue
        }

        if (asset.type === 'video') {
          const key = getMediaElementKey(layer.clip)
          activeVideoKeys.add(key)
          let video = videoCacheRef.current.get(key)
          if (video?.dataset.sourceUrl !== url) {
            if (video) releaseVideoElement(video)
            videoCacheRef.current.delete(key)
            videoSyncKeyRef.current.delete(key)
            video = undefined
          }
          if (!video) {
            video = document.createElement('video')
            video.playsInline = true
            video.preload = 'auto'
            video.onloadeddata = scheduleDrawFrame
            video.onseeked = scheduleDrawFrame
            video.onerror = scheduleDrawFrame
            video.dataset.sourceUrl = url
            video.src = url
            videoCacheRef.current.set(key, video)
          }
          const targetTime = clampClipMediaTime(layer.clip, timelineTime)
          video.playbackRate = layer.clip.playbackRate ?? 1
          // overlay 트랙 비디오는 Export가 소리를 합성하지 않으므로 프리뷰에서도 음소거한다.
          const audible = options.audibleClipIds.has(key)
          video.muted = !audible
          video.volume = audible ? options.audioVolume : 0
          const syncKey = makeVideoSyncKey(layer.clip)
          const previousSyncKey = videoSyncKeyRef.current.get(key)
          const drift = Math.abs(video.currentTime - targetTime)
          const shouldSeek =
            options.forceSeek ||
            previousSyncKey !== syncKey ||
            drift > (options.playing ? PLAYING_SEEK_DRIFT_SECONDS : PAUSED_SEEK_EPSILON_SECONDS)

          if (Number.isFinite(targetTime) && shouldSeek) {
            video.currentTime = targetTime
          }
          videoSyncKeyRef.current.set(key, syncKey)

          if (options.playing) {
            if (video.paused) void video.play().catch(() => {})
          } else {
            video.pause()
          }
        }
      }

      for (const [key, video] of videoCacheRef.current) {
        if (!activeVideoKeys.has(key)) video.pause()
      }
    },
    [scheduleDrawFrame]
  )

  const syncAudioElements = useCallback(
    (
      sources: ActiveAudioSource[],
      timelineTime: number,
      options: { forceSeek: boolean; playing: boolean; masterVolume: number; muted: boolean }
    ) => {
      const activeKeys = new Set<string>()

      for (const source of sources) {
        // 비디오에 포함된 오디오는 video element가 그대로 재생하므로 여기서 다루지 않는다.
        if (source.kind !== 'audio') continue

        const key = getMediaElementKey(source.clip)
        activeKeys.add(key)
        const url = getAssetUrl(source.asset)

        let audio = audioCacheRef.current.get(key)
        if (audio && audio.dataset.sourceUrl !== url) {
          releaseAudioElement(audio)
          audioCacheRef.current.delete(key)
          audioSyncKeyRef.current.delete(key)
          audio = undefined
        }
        if (!audio) {
          audio = new Audio()
          audio.preload = 'auto'
          audio.dataset.sourceUrl = url
          audio.src = url
          audioCacheRef.current.set(key, audio)
        }

        audio.playbackRate = source.clip.playbackRate ?? 1
        audio.volume = getAudioElementVolume(
          getAudioSourceGain(source),
          options.masterVolume,
          options.muted
        )

        const targetTime = clampClipMediaTime(source.clip, timelineTime)
        const syncKey = makeAudioSyncKey(source.clip)
        const previousSyncKey = audioSyncKeyRef.current.get(key)
        const drift = Math.abs(audio.currentTime - targetTime)
        const shouldSeek =
          options.forceSeek ||
          previousSyncKey !== syncKey ||
          drift > (options.playing ? PLAYING_SEEK_DRIFT_SECONDS : PAUSED_SEEK_EPSILON_SECONDS)

        if (Number.isFinite(targetTime) && shouldSeek) {
          audio.currentTime = targetTime
        }
        audioSyncKeyRef.current.set(key, syncKey)

        if (options.playing) {
          if (audio.paused) void audio.play().catch(() => {})
        } else {
          audio.pause()
        }
      }

      for (const [key, audio] of audioCacheRef.current) {
        if (!activeKeys.has(key)) audio.pause()
      }
    },
    []
  )

  /** video 트랙 비디오 클립의 embedded 오디오만 소리를 낸다 */
  const audibleClipIdsRef = useRef<Set<string>>(new Set())
  const audibleClipIds = useMemo(
    () =>
      new Set(
        activeAudioSources
          .filter((source) => source.kind === 'embedded')
          .map((source) => getMediaElementKey(source.clip))
      ),
    [activeAudioSources]
  )

  useEffect(() => {
    audibleClipIdsRef.current = audibleClipIds
  }, [audibleClipIds])

  useEffect(() => {
    if (isPlaying) return
    syncMediaElements(activeLayers, storeCurrentTime, {
      forceSeek: true,
      playing: false,
      audibleClipIds,
      audioVolume: getAudioElementVolume(1, masterVolume, isMuted),
    })
    syncAudioElements(activeAudioSources, storeCurrentTime, {
      forceSeek: true,
      playing: false,
      masterVolume,
      muted: isMuted,
    })
  }, [
    activeAudioSources,
    activeLayers,
    audibleClipIds,
    isMuted,
    isPlaying,
    masterVolume,
    storeCurrentTime,
    syncAudioElements,
    syncMediaElements,
  ])

  useEffect(() => {
    if (!isPlaying) return
    let syncRaf: number | null = null
    const sync = () => {
      syncMediaElements(activeLayersRef.current, currentTimeRef.current, {
        forceSeek: false,
        playing: true,
        audibleClipIds: audibleClipIdsRef.current,
        audioVolume: getAudioElementVolume(1, masterVolumeRef.current, isMutedRef.current),
      })
      syncAudioElements(activeAudioSourcesRef.current, currentTimeRef.current, {
        forceSeek: false,
        playing: true,
        masterVolume: masterVolumeRef.current,
        muted: isMutedRef.current,
      })
      syncRaf = requestAnimationFrame(sync)
    }
    sync()
    return () => {
      if (syncRaf !== null) cancelAnimationFrame(syncRaf)
    }
  }, [isPlaying, syncAudioElements, syncMediaElements])

  // video/audio element는 clip 소유이므로 클립이 사라지거나 그 에셋이 제거되면 해제한다.
  // 이미지는 재생 위치가 없어 asset 단위로 공유하므로 에셋 기준으로만 해제한다.
  useEffect(() => {
    const liveAssetIds = new Set(assets.map((asset) => asset.id))
    const liveClipKeys = new Set(
      tracks
        .flatMap((track) => track.clips)
        .filter((clip) => !clip.assetId || liveAssetIds.has(clip.assetId))
        .map((clip) => getMediaElementKey(clip))
    )

    for (const [key, video] of videoCacheRef.current) {
      if (!liveClipKeys.has(key)) {
        releaseVideoElement(video)
        videoCacheRef.current.delete(key)
        videoSyncKeyRef.current.delete(key)
      }
    }

    for (const [key, audio] of audioCacheRef.current) {
      if (!liveClipKeys.has(key)) {
        releaseAudioElement(audio)
        audioCacheRef.current.delete(key)
        audioSyncKeyRef.current.delete(key)
      }
    }

    for (const [assetId, image] of imageCacheRef.current) {
      if (!liveAssetIds.has(assetId)) {
        releaseImageElement(image)
        imageCacheRef.current.delete(assetId)
      }
    }
  }, [assets, tracks])

  /**
   * canvas의 backing store 크기(그리기 좌표계)를 프로젝트 캔버스 크기에 맞춘다.
   *
   * JSX에서 `width`/`height`를 넘기지 않는다: 이 canvas는 MUI `Box component="canvas"`라
   * width/height가 시스템 스타일 prop으로 흡수되어 HTML 속성으로 전달되지 않는다.
   * 그 경우 backing store가 기본값 300x150으로 남아 프로젝트 좌표로 그린 레이어가
   * 화면 밖으로 나간다. 속성은 여기서 직접 설정한다.
   */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (canvas.width === canvasWidth && canvas.height === canvasHeight) return
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    scheduleDrawFrame()
  }, [canvasWidth, canvasHeight, scheduleDrawFrame])

  useEffect(() => {
    if (isPlaying) return
    scheduleDrawFrame({ activeLayers, canvasHeight, canvasWidth, cropEditing, selectedClip })
  }, [
    activeLayers,
    canvasHeight,
    canvasWidth,
    cropEditing,
    isPlaying,
    scheduleDrawFrame,
    selectedClip,
  ])

  useEffect(() => {
    if (!isPlaying) return
    let canceled = false
    const drawLoop = () => {
      rafRef.current = null
      drawFrame()
      if (!canceled) rafRef.current = requestAnimationFrame(drawLoop)
    }
    rafRef.current = requestAnimationFrame(drawLoop)
    return () => {
      canceled = true
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [drawFrame, isPlaying])

  useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (playRafRef.current !== null) cancelAnimationFrame(playRafRef.current)
      rafRef.current = null
      playRafRef.current = null

      for (const video of videoCacheRef.current.values()) {
        releaseVideoElement(video)
      }
      for (const image of imageCacheRef.current.values()) {
        releaseImageElement(image)
      }
      for (const audio of audioCacheRef.current.values()) {
        releaseAudioElement(audio)
      }
      videoCacheRef.current.clear()
      videoSyncKeyRef.current.clear()
      imageCacheRef.current.clear()
      audioCacheRef.current.clear()
      audioSyncKeyRef.current.clear()
    },
    []
  )

  useEffect(() => {
    if (!isPlaying) {
      if (playRafRef.current !== null) cancelAnimationFrame(playRafRef.current)
      playRafRef.current = null
      playLastTsRef.current = null
      return
    }
    const tick = (ts: number) => {
      if (playLastTsRef.current !== null) {
        const delta = (ts - playLastTsRef.current) / 1000
        const next = Math.min(currentTimeRef.current + delta, durationRef.current)
        currentTimeRef.current = next
        setLocalCurrentTime(next)
        setCurrentTime(next)
        if (next >= durationRef.current) {
          setPlaying(false)
          return
        }
      }
      playLastTsRef.current = ts
      playRafRef.current = requestAnimationFrame(tick)
    }
    playRafRef.current = requestAnimationFrame(tick)
    return () => {
      if (playRafRef.current !== null) cancelAnimationFrame(playRafRef.current)
      playRafRef.current = null
      playLastTsRef.current = null
    }
  }, [isPlaying, setCurrentTime, setPlaying])

  useEffect(() => {
    if (!isSliderDragging) setLocalCurrentTime(storeCurrentTime)
  }, [storeCurrentTime, isSliderDragging])

  const canvasPoint = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvasWidth,
        y: ((event.clientY - rect.top) / rect.height) * canvasHeight,
      }
    },
    [canvasWidth, canvasHeight]
  )

  const handleCanvasDoubleClick = useCallback(
    (event: React.MouseEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event)
      const hit = hitTestLayers(activeLayers, point.x, point.y)
      if (!hit || hit.clipType !== 'text') return
      selectClip(hit.id)
      setTextDialog({
        clipId: hit.id,
        text: hit.textProps?.text ?? '',
      })
    },
    [activeLayers, canvasPoint, selectClip]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event)
      const hit = hitTestLayers(activeLayers, point.x, point.y)
      const state = useTimelineStore.getState()

      if (activeTool === 'text') {
        const trackId = findTrackId(state.tracks, 'text')
        if (!trackId) return
        withHistory('텍스트 클립 추가', () =>
          addTextClip(
            trackId,
            state.currentTime,
            5,
            { text: '텍스트를 입력하세요' },
            { x: Math.round(point.x - 300), y: Math.round(point.y - 60), width: 600, height: 120 }
          )
        )
        const clipId = useTimelineStore.getState().selectedClipId
        if (clipId) setTextDialog({ clipId, text: '텍스트를 입력하세요' })
        return
      }

      if (activeTool === 'rect' || activeTool === 'circle' || activeTool === 'arrow') {
        draftShapeRef.current = { shapeType: activeTool, startX: point.x, startY: point.y }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      if (activeTool === 'razor') {
        if (!hit) return
        withHistory('클립 분할', () => splitClip(hit.id, state.currentTime))
        selectClip(hit.id)
        return
      }

      if (activeTool === 'crop' && cropEditing) {
        if (!hit || hit.clipType !== 'media') return
        const layer = activeLayers.find((candidate) => candidate.clip.id === hit.id)
        const asset = layer?.asset
        if (!asset || asset.type === 'audio') return
        selectClip(hit.id)
        draftCropRef.current = {
          clip: hit,
          assetWidth: asset.width || hit.width,
          assetHeight: asset.height || hit.height,
          startX: point.x,
          startY: point.y,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
        return
      }

      selectClip(hit?.id ?? null)
      if (activeTool !== 'select') return
      if (hit) {
        const selectedHandle =
          selectedClipId === hit.id ? getResizeHandle(hit, point.x, point.y) : null
        const mode =
          selectedClipId === hit.id && isRotationHandle(hit, point.x, point.y)
            ? 'rotate'
            : selectedHandle
              ? 'resize'
              : 'move'
        const historyLabel =
          mode === 'move'
            ? '캔버스 오브젝트 이동'
            : mode === 'resize'
              ? '캔버스 오브젝트 크기 변경'
              : '캔버스 오브젝트 회전'
        dragRef.current = {
          mode,
          clipId: hit.id,
          startX: point.x,
          startY: point.y,
          clip: hit,
          handle: selectedHandle ?? undefined,
          historyLabel,
          historyPushed: false,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    },
    [
      activeLayers,
      activeTool,
      addTextClip,
      canvasPoint,
      cropEditing,
      selectClip,
      selectedClipId,
      splitClip,
    ]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event)

      if (dragRef.current) {
        const drag = dragRef.current
        if (!drag.historyPushed && Math.hypot(point.x - drag.startX, point.y - drag.startY) >= 1) {
          withHistory(drag.historyLabel, () => undefined)
          drag.historyPushed = true
        }
        if (drag.mode === 'move') {
          updateClipCanvas(drag.clipId, {
            x: Math.round(drag.clip.x + point.x - drag.startX),
            y: Math.round(drag.clip.y + point.y - drag.startY),
          })
        } else if (drag.mode === 'resize' && drag.handle) {
          updateClipCanvas(
            drag.clipId,
            resizeClipRect(drag.clip, drag.handle, point.x - drag.startX, point.y - drag.startY)
          )
        } else if (drag.mode === 'rotate') {
          const cx = drag.clip.x + drag.clip.width / 2
          const cy = drag.clip.y + drag.clip.height / 2
          const radians = Math.atan2(point.y - cy, point.x - cx) + Math.PI / 2
          updateClipCanvas(drag.clipId, { rotation: Math.round((radians * 180) / Math.PI) })
        }
      }
    },
    [canvasPoint, updateClipCanvas]
  )

  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event)
      const state = useTimelineStore.getState()

      if (draftShapeRef.current) {
        const draft = draftShapeRef.current
        draftShapeRef.current = null
        const x = Math.min(draft.startX, point.x)
        const y = Math.min(draft.startY, point.y)
        const width = Math.abs(point.x - draft.startX)
        const height = Math.abs(point.y - draft.startY)
        const trackId = findTrackId(state.tracks, 'shape')
        if (trackId && width >= MIN_OBJECT_SIZE && height >= MIN_OBJECT_SIZE) {
          withHistory('도형 클립 추가', () =>
            addShapeClip(
              trackId,
              state.currentTime,
              5,
              draft.shapeType,
              Math.round(x),
              Math.round(y),
              Math.round(width),
              Math.round(height)
            )
          )
        }
      }

      if (draftCropRef.current) {
        const draft = draftCropRef.current
        draftCropRef.current = null
        const cropX = Math.max(0, Math.min(draft.startX, point.x) - draft.clip.x)
        const cropY = Math.max(0, Math.min(draft.startY, point.y) - draft.clip.y)
        const cropW = Math.min(draft.clip.width - cropX, Math.abs(point.x - draft.startX))
        const cropH = Math.min(draft.clip.height - cropY, Math.abs(point.y - draft.startY))
        if (cropW >= MIN_OBJECT_SIZE && cropH >= MIN_OBJECT_SIZE) {
          withHistory('클립 자르기', () =>
            updateClipCanvas(draft.clip.id, {
              fitMode: 'crop',
              cropRect: {
                x: Math.round((cropX / draft.clip.width) * draft.assetWidth),
                y: Math.round((cropY / draft.clip.height) * draft.assetHeight),
                width: Math.round((cropW / draft.clip.width) * draft.assetWidth),
                height: Math.round((cropH / draft.clip.height) * draft.assetHeight),
              },
            })
          )
        }
      }

      dragRef.current = null
      if (event.currentTarget.hasPointerCapture(event.pointerId))
        event.currentTarget.releasePointerCapture(event.pointerId)
    },
    [addShapeClip, canvasPoint, updateClipCanvas]
  )

  const handleSliderChange = useCallback((_: Event, value: number | number[]) => {
    const time = Array.isArray(value) ? value[0] : value
    setIsSliderDragging(true)
    setLocalCurrentTime(time)
  }, [])

  const handleSliderChangeCommitted = useCallback(
    (_: Event | React.SyntheticEvent, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value
      setIsSliderDragging(false)
      setLocalCurrentTime(time)
      setCurrentTime(time)
    },
    [setCurrentTime]
  )

  const totalDuration = duration || 1
  const canPlay = duration > 0
  const activeAssetName = activeLayers.find((layer) => layer.asset)?.asset?.name

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: '#000',
        position: 'relative',
      }}
    >
      <Box
        ref={previewViewportRef}
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
          position: 'relative',
          p: 1,
        }}
      >
        <Box
          sx={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'visible',
            minWidth: 0,
            minHeight: 0,
          }}
        >
          {activeLayers.length === 0 && (
            <Box
              sx={{
                color: 'text.disabled',
                fontSize: 14,
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
              }}
            >
              Preview
            </Box>
          )}
          <Box
            component="canvas"
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onDoubleClick={handleCanvasDoubleClick}
            sx={{
              display: 'block',
              width: fitCanvasSize.width,
              height: fitCanvasSize.height,
              maxWidth: '100%',
              maxHeight: '100%',
              aspectRatio: `${canvasWidth} / ${canvasHeight}`,
              outline: '1px solid rgba(255,255,255,0.16)',
              cursor: dragRef.current ? 'grabbing' : 'default',
            }}
          />
        </Box>

        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1,
            py: 0.5,
            bgcolor: 'rgba(18,18,18,0.82)',
            border: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 1,
            backdropFilter: 'blur(6px)',
          }}
        >
          <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: 11 }}>
            {canvasWidth}×{canvasHeight}
          </Typography>
          <TextField
            size="small"
            select
            value={previewZoom}
            onChange={(event) => setPreviewZoom(event.target.value as PreviewZoom)}
            inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
            sx={{
              minWidth: 74,
              '& .MuiOutlinedInput-root': { fontSize: 12, bgcolor: 'background.paper' },
            }}
          >
            {PREVIEW_ZOOM_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          px: 1,
          pt: 0.5,
          pb: 0.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Slider
          size="small"
          min={0}
          max={totalDuration}
          step={0.01}
          value={isSliderDragging ? localCurrentTime : storeCurrentTime}
          onChange={handleSliderChange}
          onChangeCommitted={handleSliderChangeCommitted}
          sx={{ py: 0.5, color: 'primary.main' }}
          disabled={!canPlay}
        />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setPlaying(!isPlaying)} disabled={!canPlay}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
            {formatTime(isSliderDragging ? localCurrentTime : storeCurrentTime)} /{' '}
            {formatTime(totalDuration)}
          </Typography>
          <IconButton
            size="small"
            onClick={() => setIsMuted((current) => !current)}
            title={isMuted ? '음소거 해제' : '음소거'}
            aria-label={isMuted ? '음소거 해제' : '음소거'}
          >
            {isMuted || masterVolume === 0 ? (
              <VolumeOffIcon fontSize="small" />
            ) : (
              <VolumeUpIcon fontSize="small" />
            )}
          </IconButton>
          <Slider
            size="small"
            min={0}
            max={1}
            step={0.01}
            value={isMuted ? 0 : masterVolume}
            onChange={(_event, value) => {
              const next = Array.isArray(value) ? (value[0] ?? 0) : value
              setMasterVolume(next)
              if (next > 0 && isMuted) setIsMuted(false)
            }}
            aria-label="프리뷰 볼륨"
            sx={{ width: 72, color: 'primary.main' }}
          />
          {activeAssetName && (
            <Typography
              variant="caption"
              sx={{
                ml: 'auto',
                color: 'text.disabled',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 120,
              }}
              title={activeAssetName}
            >
              {activeAssetName}
            </Typography>
          )}
        </Box>
      </Box>

      <ResizableDialog
        open={Boolean(textDialog)}
        onClose={() => setTextDialog(null)}
        dialogTitle="텍스트 편집"
        defaultWidth={420}
        defaultHeight={220}
        minWidth={320}
        minHeight={180}
        storageKey="preview-text-editor-dialog"
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          <TextField
            label="텍스트"
            multiline
            minRows={3}
            value={textDialog?.text ?? ''}
            onChange={(event) =>
              setTextDialog((current) =>
                current ? { ...current, text: event.target.value } : current
              )
            }
            fullWidth
            autoFocus
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            <Button size="small" variant="outlined" onClick={() => setTextDialog(null)}>
              취소
            </Button>
            <Button
              size="small"
              variant="contained"
              onClick={() => {
                if (textDialog) {
                  withHistory('텍스트 내용 변경', () =>
                    updateClipCanvas(textDialog.clipId, {
                      textProps: {
                        ...(useTimelineStore
                          .getState()
                          .tracks.flatMap((track) => track.clips)
                          .find((clip) => clip.id === textDialog.clipId)?.textProps ??
                          FALLBACK_TEXT_PROPS),
                        text: textDialog.text,
                      },
                    })
                  )
                }
                setTextDialog(null)
              }}
            >
              적용
            </Button>
          </Box>
        </Box>
      </ResizableDialog>
    </Box>
  )
}
