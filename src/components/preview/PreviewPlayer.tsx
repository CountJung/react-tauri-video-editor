import { convertFileSrc } from '@/lib/invoke'
import { useAssetStore } from '@/store/assetStore'
import { useTimelineStore } from '@/store/timelineStore'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'
import type WaveSurferType from 'wavesurfer.js'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** 미디어 프리뷰 플레이어 (Phase 1) */
export function PreviewPlayer() {
  const { assets, selectedAssetId } = useAssetStore()
  const { isPlaying, setPlaying, setCurrentTime } = useTimelineStore()
  const asset = assets.find((a) => a.id === selectedAssetId) ?? null

  const videoRef = useRef<HTMLVideoElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const wavesurferRef = useRef<WaveSurferType | null>(null)
  const isSyncingRef = useRef(false)
  // asset?.id를 추적해 thumbnailPath 변경 시 재로드 방지
  const prevAssetIdRef = useRef<string | undefined>(undefined)

  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [isSliderDragging, setIsSliderDragging] = useState(false)

  // 에셋 ID 변경 시에만 소스 재로드 (thumbnailPath 변경 무시)
  useEffect(() => {
    if (asset?.id === prevAssetIdRef.current) return
    prevAssetIdRef.current = asset?.id

    setLocalCurrentTime(0)
    setLocalDuration(asset?.duration ?? 0)
    setPlaying(false)

    if (!asset) return

    if (asset.type === 'video') {
      wavesurferRef.current?.destroy()
      wavesurferRef.current = null
      const video = videoRef.current
      if (video) {
        video.src = convertFileSrc(asset.path)
        video.load()
      }
    } else if (asset.type === 'audio') {
      // WaveSurfer 초기화 (동적 import로 번들 크기 최적화)
      ;(async () => {
        const WaveSurfer = (await import('wavesurfer.js')).default
        if (!waveformRef.current) return
        wavesurferRef.current?.destroy()
        const ws = WaveSurfer.create({
          container: waveformRef.current,
          waveColor: '#4fc3f7',
          progressColor: '#0288d1',
          url: convertFileSrc(asset.path),
          height: 80,
          interact: true,
        })
        ws.on('ready', (duration) => {
          setLocalDuration(duration)
        })
        ws.on('timeupdate', (currentTime) => {
          if (!isSyncingRef.current) {
            setLocalCurrentTime(currentTime)
            setCurrentTime(currentTime)
          }
        })
        ws.on('finish', () => {
          setPlaying(false)
          setLocalCurrentTime(0)
          setCurrentTime(0)
        })
        wavesurferRef.current = ws
      })()
    }
  }, [asset, setPlaying, setCurrentTime])

  // isPlaying 변경 → 비디오/오디오 재생·정지 동기화
  useEffect(() => {
    if (!asset) return

    if (asset.type === 'video') {
      const video = videoRef.current
      if (!video) return
      if (isPlaying) {
        video.play().catch(() => setPlaying(false))
      } else {
        video.pause()
      }
    } else if (asset.type === 'audio') {
      const ws = wavesurferRef.current
      if (!ws) return
      if (isPlaying) {
        ws.play()
      } else {
        ws.pause()
      }
    }
  }, [isPlaying, asset, setPlaying])

  // 언마운트 시 WaveSurfer 정리
  useEffect(() => {
    return () => {
      wavesurferRef.current?.destroy()
    }
  }, [])

  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || isSyncingRef.current) return
    setLocalCurrentTime(video.currentTime)
    setCurrentTime(video.currentTime)
  }, [setCurrentTime])

  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    setLocalDuration(video.duration)
  }, [])

  const handleVideoEnded = useCallback(() => {
    setPlaying(false)
    setLocalCurrentTime(0)
    setCurrentTime(0)
    if (videoRef.current) videoRef.current.currentTime = 0
  }, [setPlaying, setCurrentTime])

  const handleSliderChange = useCallback((_: Event, value: number | number[]) => {
    const time = Array.isArray(value) ? value[0] : value
    setIsSliderDragging(true)
    setLocalCurrentTime(time)
  }, [])

  const handleSliderChangeCommitted = useCallback(
    (_: Event | React.SyntheticEvent, value: number | number[]) => {
      const time = Array.isArray(value) ? value[0] : value
      isSyncingRef.current = true
      setIsSliderDragging(false)
      setLocalCurrentTime(time)
      setCurrentTime(time)

      if (asset?.type === 'video' && videoRef.current) {
        videoRef.current.currentTime = time
      } else if (asset?.type === 'audio' && wavesurferRef.current) {
        const dur = wavesurferRef.current.getDuration()
        wavesurferRef.current.seekTo(dur > 0 ? time / dur : 0)
      }

      setTimeout(() => {
        isSyncingRef.current = false
      }, 100)
    },
    [asset?.type, setCurrentTime]
  )

  const canPlay = !!asset && asset.type !== 'image'
  const displayTime = isSliderDragging ? localCurrentTime : localCurrentTime

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
      {/* 미디어 영역 */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {!asset ? (
          <Box sx={{ color: 'text.disabled', fontSize: 14 }}>Preview</Box>
        ) : asset.type === 'video' ? (
          // biome-ignore lint/a11y/useMediaCaption: 비디오 에디터 프리뷰 — 자막 불필요
          <video
            ref={videoRef}
            style={{ maxWidth: '100%', maxHeight: '100%' }}
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onEnded={handleVideoEnded}
          />
        ) : asset.type === 'audio' ? (
          <Box sx={{ width: '100%', px: 2 }}>
            <div ref={waveformRef} />
          </Box>
        ) : (
          <Box
            component="img"
            src={convertFileSrc(asset.path)}
            alt={asset.name}
            sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        )}
      </Box>

      {/* 컨트롤 바 */}
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
        {/* 시크 슬라이더 */}
        {canPlay && (
          <Slider
            size="small"
            min={0}
            max={localDuration || 1}
            step={0.01}
            value={displayTime}
            onChange={handleSliderChange}
            onChangeCommitted={handleSliderChangeCommitted}
            sx={{ py: 0.5, color: 'primary.main' }}
          />
        )}

        {/* 재생 컨트롤 + 시간 표시 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setPlaying(!isPlaying)} disabled={!canPlay}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
            {formatTime(displayTime)} / {formatTime(localDuration)}
          </Typography>
          {asset && (
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
              title={asset.name}
            >
              {asset.name}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
