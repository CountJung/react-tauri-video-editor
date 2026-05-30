import { convertFileSrc } from '@/lib/invoke'
import { useAssetStore } from '@/store/assetStore'
import type { Asset, Clip, Track } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/** 특정 시간에 활성화된 클립 + 에셋 반환 */
function findActiveClip(
  tracks: Track[],
  assets: Asset[],
  currentTime: number,
  trackType: Track['type']
): { clip: Clip; asset: Asset } | null {
  for (const track of tracks) {
    if (track.type !== trackType) continue
    for (const clip of track.clips) {
      if (currentTime >= clip.start && currentTime < clip.start + clip.duration) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (asset) return { clip, asset }
      }
    }
  }
  return null
}

/**
 * 타임라인 합성 프리뷰 플레이어
 *
 * - 비디오 트랙: currentTime에 활성화된 클립의 영상/이미지를 표시
 * - 오버레이 트랙: currentTime에 활성화된 이미지 클립을 비디오 위에 오버레이
 * - 이미지 클립: 해당 구간에서 정지 이미지 표시, 재생 시 타이머로 시간 진행
 */
export function PreviewPlayer() {
  const assets = useAssetStore((s) => s.assets)
  const tracks = useTimelineStore((s) => s.tracks)
  const duration = useTimelineStore((s) => s.duration)
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const storeCurrentTime = useTimelineStore((s) => s.currentTime)
  const canvasWidth = useTimelineStore((s) => s.canvasWidth)
  const canvasHeight = useTimelineStore((s) => s.canvasHeight)
  const { setPlaying, setCurrentTime } = useTimelineStore()

  const videoRef = useRef<HTMLVideoElement>(null)
  const isSyncingRef = useRef(false)
  const lastVideoTimeRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const rafLastTimestampRef = useRef<number | null>(null)
  // RAF에서 최신 값을 읽기 위한 ref (스테일 클로저 방지)
  const currentTimeRef = useRef(storeCurrentTime)
  const durationRef = useRef(duration)

  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [isSliderDragging, setIsSliderDragging] = useState(false)

  // RAF/callback에서 최신 값을 읽을 수 있도록 ref 동기화
  useEffect(() => {
    currentTimeRef.current = storeCurrentTime
  }, [storeCurrentTime])
  useEffect(() => {
    durationRef.current = duration
  }, [duration])

  // 현재 시간에 활성화된 비디오 트랙 콘텐츠 (video or image)
  const activeVideoContent = useMemo(
    () => findActiveClip(tracks, assets, storeCurrentTime, 'video'),
    [tracks, assets, storeCurrentTime]
  )

  // 현재 시간에 활성화된 오버레이 클립 목록
  const activeOverlays = useMemo(() => {
    const result: Array<{ clip: Clip; asset: Asset }> = []
    for (const track of tracks) {
      if (track.type !== 'overlay') continue
      for (const clip of track.clips) {
        if (storeCurrentTime >= clip.start && storeCurrentTime < clip.start + clip.duration) {
          const asset = assets.find((a) => a.id === clip.assetId)
          if (asset?.type === 'image') result.push({ clip, asset })
        }
      }
    }
    return result
  }, [tracks, assets, storeCurrentTime])

  const activeAsset = activeVideoContent?.asset ?? null
  const activeClip = activeVideoContent?.clip ?? null

  // 활성 비디오 에셋 변경 시 video 소스 교체
  const prevAssetIdRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    if (activeAsset?.id === prevAssetIdRef.current) return
    prevAssetIdRef.current = activeAsset?.id

    if (activeAsset?.type === 'video' && videoRef.current) {
      videoRef.current.src = convertFileSrc(activeAsset.path)
      videoRef.current.load()
    }
  }, [activeAsset])

  // isPlaying + activeAsset 변경 → 재생/정지 제어
  useEffect(() => {
    if (!activeAsset) return

    if (activeAsset.type === 'video') {
      const video = videoRef.current
      if (!video) return
      if (isPlaying) {
        video.play().catch(() => setPlaying(false))
      } else {
        video.pause()
      }
    } else if (activeAsset.type === 'image') {
      // 이미지 재생: RAF로 타임라인 시간 진행
      if (isPlaying) {
        rafLastTimestampRef.current = null
        const advance = (ts: number) => {
          if (rafLastTimestampRef.current !== null) {
            const delta = (ts - rafLastTimestampRef.current) / 1000
            const next = Math.min(currentTimeRef.current + delta, durationRef.current)
            currentTimeRef.current = next
            setLocalCurrentTime(next)
            setCurrentTime(next)
            if (next >= durationRef.current) {
              setPlaying(false)
              return
            }
          }
          rafLastTimestampRef.current = ts
          rafRef.current = requestAnimationFrame(advance)
        }
        rafRef.current = requestAnimationFrame(advance)
      } else {
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current)
          rafRef.current = null
        }
      }
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isPlaying, activeAsset, setPlaying, setCurrentTime])

  // video timeupdate → 타임라인 currentTime 갱신 (clip offset 보정)
  const handleVideoTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (!video || isSyncingRef.current || !activeClip) return
    // video.currentTime은 clip 내부 시간 (trimStart 기준)
    const timelineTime = activeClip.start + (video.currentTime - activeClip.trimStart)
    lastVideoTimeRef.current = video.currentTime
    setLocalCurrentTime(timelineTime)
    setCurrentTime(timelineTime)
  }, [activeClip, setCurrentTime])

  const handleVideoLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video || !activeClip) return
    // 활성 클립의 trimStart로 seek
    const seekTo = activeClip.trimStart + (storeCurrentTime - activeClip.start)
    video.currentTime = Math.max(activeClip.trimStart, Math.min(activeClip.trimEnd, seekTo))
  }, [activeClip, storeCurrentTime])

  const handleVideoEnded = useCallback(() => {
    setPlaying(false)
  }, [setPlaying])

  // 외부 currentTime 변경 → video seek (ruler 클릭, 슬라이더 등)
  useEffect(() => {
    if (!activeClip || activeAsset?.type !== 'video') return
    const video = videoRef.current
    if (!video) return

    const expectedVideoTime = activeClip.trimStart + (storeCurrentTime - activeClip.start)
    if (Math.abs(lastVideoTimeRef.current - expectedVideoTime) < 0.05) return

    isSyncingRef.current = true
    lastVideoTimeRef.current = expectedVideoTime
    setLocalCurrentTime(storeCurrentTime)
    video.currentTime = Math.max(
      activeClip.trimStart,
      Math.min(activeClip.trimEnd, expectedVideoTime)
    )

    setTimeout(() => {
      isSyncingRef.current = false
    }, 50)
  }, [storeCurrentTime, activeClip, activeAsset?.type])

  // storeCurrentTime 외부 변경 시 localCurrentTime 동기화
  useEffect(() => {
    if (!isSliderDragging) {
      setLocalCurrentTime(storeCurrentTime)
    }
  }, [storeCurrentTime, isSliderDragging])

  // 언마운트 시 RAF 정리
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
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
          position: 'relative',
        }}
      >
        {/* 캔버스 비율 유지 컨테이너 */}
        <Box
          sx={{
            aspectRatio: `${canvasWidth} / ${canvasHeight}`,
            maxWidth: '100%',
            maxHeight: '100%',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 빈 상태 */}
          {!activeAsset && activeOverlays.length === 0 && (
            <Box sx={{ color: 'text.disabled', fontSize: 14 }}>Preview</Box>
          )}

          {/* 메인 비디오 (항상 렌더, 소스 없으면 숨김) */}
          {/* biome-ignore lint/a11y/useMediaCaption: 비디오 에디터 프리뷰 */}
          <video
            ref={videoRef}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              display: activeAsset?.type === 'video' ? 'block' : 'none',
            }}
            onTimeUpdate={handleVideoTimeUpdate}
            onLoadedMetadata={handleVideoLoadedMetadata}
            onEnded={handleVideoEnded}
          />

          {/* 이미지 클립 (비디오 트랙에 배치된 이미지) */}
          {activeAsset?.type === 'image' && (
            <Box
              component="img"
              src={convertFileSrc(activeAsset.path)}
              alt={activeAsset.name}
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          )}

          {/* 오버레이 이미지 (overlay 트랙 클립 — 비디오 위에 겹침) */}
          {activeOverlays.map(({ clip, asset: overlayAsset }) => (
            <Box
              key={clip.id}
              component="img"
              src={convertFileSrc(overlayAsset.path)}
              alt={overlayAsset.name}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                pointerEvents: 'none',
              }}
            />
          ))}
        </Box>
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

        {/* 재생 컨트롤 + 시간 표시 */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton size="small" onClick={() => setPlaying(!isPlaying)} disabled={!canPlay}>
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
            {formatTime(isSliderDragging ? localCurrentTime : storeCurrentTime)} /{' '}
            {formatTime(totalDuration)}
          </Typography>
          {activeAsset && (
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
              title={activeAsset.name}
            >
              {activeAsset.name}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  )
}
