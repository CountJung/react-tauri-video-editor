import { withHistory } from '@/lib/withHistory'
import type { Clip, ClipKeyframe } from '@/store/timelineStore'
import { useTimelineStore } from '@/store/timelineStore'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type React from 'react'

const KEYFRAME_TIME_EPSILON = 0.01

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        fontWeight: 700,
        color: 'text.secondary',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        px: 1.5,
        pt: 1.5,
        pb: 0.5,
        display: 'block',
      }}
    >
      {children}
    </Typography>
  )
}

function formatTime(time: number): string {
  return `${time.toFixed(2)}s`
}

function makeKeyframe(clip: Clip, localTime: number): ClipKeyframe {
  return {
    time: Math.max(0, Math.min(clip.duration, Number(localTime.toFixed(2)))),
    x: Math.round(clip.x),
    y: Math.round(clip.y),
    width: Math.round(clip.width),
    height: Math.round(clip.height),
    opacity: Number(clip.opacity.toFixed(3)),
  }
}

export function KeyframePanel({ clip }: { clip: Clip }) {
  const currentTime = useTimelineStore((s) => s.currentTime)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)
  const localTime = Math.max(0, Math.min(clip.duration, currentTime - clip.start))
  const keyframes = [...(clip.keyframes ?? [])].sort((a, b) => a.time - b.time)
  const hasKeyframeAtCurrentTime = keyframes.some(
    (keyframe) => Math.abs(keyframe.time - localTime) <= KEYFRAME_TIME_EPSILON
  )

  const upsertKeyframe = () => {
    const nextKeyframe = makeKeyframe(clip, localTime)
    const nextKeyframes = keyframes
      .filter((keyframe) => Math.abs(keyframe.time - nextKeyframe.time) > KEYFRAME_TIME_EPSILON)
      .concat(nextKeyframe)
      .sort((a, b) => a.time - b.time)

    withHistory(hasKeyframeAtCurrentTime ? '키프레임 갱신' : '키프레임 추가', () =>
      updateClipCanvas(clip.id, { keyframes: nextKeyframes })
    )
  }

  const removeKeyframe = (time: number) => {
    withHistory('키프레임 삭제', () =>
      updateClipCanvas(clip.id, {
        keyframes: keyframes.filter(
          (keyframe) => Math.abs(keyframe.time - time) > KEYFRAME_TIME_EPSILON
        ),
      })
    )
  }

  return (
    <>
      <SectionTitle>키프레임</SectionTitle>
      <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={<AddIcon sx={{ fontSize: 16 }} />}
          onClick={upsertKeyframe}
          sx={{ justifyContent: 'flex-start', fontSize: 12 }}
        >
          {hasKeyframeAtCurrentTime ? '현재 위치 키프레임 갱신' : '현재 위치 키프레임 추가'}
        </Button>
        <Typography variant="caption" color="text.secondary">
          {formatTime(localTime)} 지점의 위치, 크기, 불투명도를 저장합니다.
        </Typography>
      </Box>

      {keyframes.length === 0 ? (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            저장된 키프레임이 없습니다.
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding sx={{ pb: 1 }}>
          {keyframes.map((keyframe) => (
            <ListItem
              key={keyframe.time}
              secondaryAction={
                <Tooltip title="키프레임 삭제">
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={() => removeKeyframe(keyframe.time)}
                    aria-label="키프레임 삭제"
                  >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              }
              sx={{ px: 1.5, py: 0.25 }}
            >
              <ListItemText
                primary={formatTime(keyframe.time)}
                secondary={`X ${keyframe.x}, Y ${keyframe.y}, W ${keyframe.width}, H ${keyframe.height}, O ${Math.round(keyframe.opacity * 100)}%`}
                primaryTypographyProps={{ variant: 'caption', fontWeight: 700 }}
                secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItem>
          ))}
        </List>
      )}
    </>
  )
}
