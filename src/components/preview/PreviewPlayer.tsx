import { useTimelineStore } from '@/store/timelineStore'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'

/** 미디어 프리뷰 플레이어 (Phase 1 — 기본 구조) */
export function PreviewPlayer() {
  const isPlaying = useTimelineStore((s) => s.isPlaying)
  const setPlaying = useTimelineStore((s) => s.setPlaying)
  const currentTime = useTimelineStore((s) => s.currentTime)
  const duration = useTimelineStore((s) => s.duration)

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

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
      {/* 비디오 영역 */}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Box sx={{ color: 'text.disabled', fontSize: 14 }}>Preview</Box>
      </Box>

      {/* 컨트롤 바 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 1,
          py: 0.5,
          bgcolor: 'background.paper',
          borderTop: 1,
          borderColor: 'divider',
          gap: 1,
        }}
      >
        <IconButton size="small" onClick={() => setPlaying(!isPlaying)}>
          {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
        </IconButton>
        <Box sx={{ fontSize: 12, color: 'text.secondary', fontFamily: 'monospace' }}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Box>
      </Box>
    </Box>
  )
}
