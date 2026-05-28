import { useTimelineStore } from '@/store/timelineStore'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** 타임라인 패널 — Track/Clip 편집 영역 (Phase 2) */
export function TimelinePanel() {
  const tracks = useTimelineStore((s) => s.tracks)
  const zoom = useTimelineStore((s) => s.zoom)
  const duration = useTimelineStore((s) => s.duration)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const setCurrentTime = useTimelineStore((s) => s.setCurrentTime)

  const totalWidth = Math.max(duration * zoom, 800)

  function handleRulerClick(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    setCurrentTime(x / zoom)
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* 툴바 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          gap: 1,
        }}
      >
        <Typography variant="caption" color="text.secondary">
          TIMELINE
        </Typography>
        <Typography variant="caption" color="text.secondary">
          zoom: {zoom}px/s
        </Typography>
      </Box>

      {/* 스크롤 영역 */}
      <Box sx={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        <Box sx={{ minWidth: totalWidth, position: 'relative' }}>
          {/* 눈금자 */}
          <Box
            sx={{
              height: 24,
              bgcolor: 'background.paper',
              borderBottom: 1,
              borderColor: 'divider',
              cursor: 'pointer',
              position: 'relative',
            }}
            onClick={handleRulerClick}
          >
            {/* 플레이헤드 */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: currentTime * zoom,
                width: 1,
                height: '100%',
                bgcolor: 'primary.main',
                pointerEvents: 'none',
              }}
            />
          </Box>

          {/* 트랙 목록 */}
          {tracks.map((track) => (
            <Box
              key={track.id}
              sx={{
                height: 48,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: track.type === 'video' ? 'rgba(33,150,243,0.05)' : 'rgba(76,175,80,0.05)',
                position: 'relative',
              }}
            >
              {/* 트랙 레이블 (고정 좌측) */}
              <Box
                sx={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  width: 64,
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  px: 1,
                  bgcolor: 'background.paper',
                  borderRight: 1,
                  borderColor: 'divider',
                  zIndex: 1,
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  {track.type === 'video' ? 'V' : 'A'}
                </Typography>
              </Box>

              {/* 클립들 */}
              {track.clips.map((clip) => (
                <Box
                  key={clip.id}
                  sx={{
                    position: 'absolute',
                    left: 64 + clip.start * zoom,
                    width: clip.duration * zoom,
                    top: 4,
                    height: 40,
                    bgcolor: track.type === 'video' ? 'primary.dark' : 'success.dark',
                    borderRadius: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    px: 0.5,
                    overflow: 'hidden',
                    cursor: 'grab',
                  }}
                >
                  <Typography variant="caption" noWrap sx={{ fontSize: 10 }}>
                    {clip.assetId}
                  </Typography>
                </Box>
              ))}
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  )
}
