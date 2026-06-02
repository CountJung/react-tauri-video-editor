import { useAssetStore } from '@/store/assetStore'
import type { Clip } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  collectActiveLayers,
  drawImageLike,
  drawShapeClip,
  drawTextClip,
  getAssetUrl,
  getClipLocalTime,
  hitTestLayers,
  withClipTransform,
} from './canvasCompositor'

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
  const { setPlaying, setCurrentTime, selectClip, updateClipCanvas } = useTimelineStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const playRafRef = useRef<number | null>(null)
  const playLastTsRef = useRef<number | null>(null)
  const currentTimeRef = useRef(storeCurrentTime)
  const durationRef = useRef(duration)
  const videoCacheRef = useRef<Map<string, HTMLVideoElement>>(new Map())
  const imageCacheRef = useRef<Map<string, HTMLImageElement>>(new Map())
  const dragRef = useRef<{
    clipId: string
    startX: number
    startY: number
    clipX: number
    clipY: number
  } | null>(null)

  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [isSliderDragging, setIsSliderDragging] = useState(false)

  useEffect(() => {
    currentTimeRef.current = storeCurrentTime
  }, [storeCurrentTime])
  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  const activeLayers = useMemo(
    () => collectActiveLayers(tracks, assets, storeCurrentTime),
    [tracks, assets, storeCurrentTime]
  )

  const selectedClip = useMemo(
    () => tracks.flatMap((track) => track.clips).find((clip) => clip.id === selectedClipId) ?? null,
    [tracks, selectedClipId]
  )

  useEffect(() => {
    for (const layer of activeLayers) {
      const asset = layer.asset
      if (!asset) continue
      const url = getAssetUrl(asset)
      if (asset.type === 'image' && !imageCacheRef.current.has(asset.id)) {
        const img = new Image()
        img.src = url
        imageCacheRef.current.set(asset.id, img)
      }
      if (asset.type === 'video') {
        let video = videoCacheRef.current.get(asset.id)
        if (!video) {
          video = document.createElement('video')
          video.muted = true
          video.playsInline = true
          video.preload = 'auto'
          video.src = url
          videoCacheRef.current.set(asset.id, video)
        }
        const targetTime = getClipLocalTime(layer.clip, storeCurrentTime)
        if (Number.isFinite(targetTime) && Math.abs(video.currentTime - targetTime) > 0.08) {
          video.currentTime = Math.max(
            layer.clip.trimStart,
            Math.min(layer.clip.trimEnd, targetTime)
          )
        }
        if (isPlaying) void video.play().catch(() => {})
        else video.pause()
      }
    }
  }, [activeLayers, isPlaying, storeCurrentTime])

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      for (const layer of activeLayers) {
        const { clip, track, asset } = layer
        withClipTransform(ctx, clip, track.opacity, () => {
          if (clip.clipType === 'text') drawTextClip(ctx, clip)
          else if (clip.clipType === 'shape') drawShapeClip(ctx, clip)
          else if (asset?.type === 'image') {
            const img = imageCacheRef.current.get(asset.id)
            if (img?.complete)
              drawImageLike(
                ctx,
                img,
                img.naturalWidth || asset.width || clip.width,
                img.naturalHeight || asset.height || clip.height,
                clip
              )
          } else if (asset?.type === 'video') {
            const video = videoCacheRef.current.get(asset.id)
            if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
              drawImageLike(
                ctx,
                video,
                video.videoWidth || asset.width || clip.width,
                video.videoHeight || asset.height || clip.height,
                clip
              )
            }
          }
        })
      }

      if (selectedClip) drawSelection(ctx, selectedClip)
      rafRef.current = requestAnimationFrame(draw)
    }
    rafRef.current = requestAnimationFrame(draw)
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [activeLayers, selectedClip])

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
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = event.currentTarget
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * canvasWidth,
        y: ((event.clientY - rect.top) / rect.height) * canvasHeight,
      }
    },
    [canvasWidth, canvasHeight]
  )

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      const point = canvasPoint(event)
      const hit = hitTestLayers(activeLayers, point.x, point.y)
      selectClip(hit?.id ?? null)
      if (hit) {
        dragRef.current = {
          clipId: hit.id,
          startX: point.x,
          startY: point.y,
          clipX: hit.x,
          clipY: hit.y,
        }
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    },
    [activeLayers, canvasPoint, selectClip]
  )

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!dragRef.current) return
      const point = canvasPoint(event)
      const drag = dragRef.current
      updateClipCanvas(drag.clipId, {
        x: Math.round(drag.clipX + point.x - drag.startX),
        y: Math.round(drag.clipY + point.y - drag.startY),
      })
    },
    [canvasPoint, updateClipCanvas]
  )

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId)
  }, [])

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
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
          position: 'relative',
        }}
      >
        <Box
          sx={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            maxWidth: '100%',
            maxHeight: '100%',
            position: 'relative',
            overflow: 'hidden',
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
            width={canvasWidth}
            height={canvasHeight}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            sx={{
              display: 'block',
              width: '100%',
              height: '100%',
              cursor: dragRef.current ? 'grabbing' : 'default',
            }}
          />
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
    </Box>
  )
}
