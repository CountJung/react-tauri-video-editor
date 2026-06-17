import { jumpToUndoIndexWithDirty, redoWithDirty } from '@/lib/historyActions'
import { useHistoryStore } from '@/store/historyStore'
import HistoryIcon from '@mui/icons-material/History'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Typography from '@mui/material/Typography'
import type React from 'react'

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

export function HistoryPanel() {
  const undoStack = useHistoryStore((s) => s.undoStack)
  const redoStack = useHistoryStore((s) => s.redoStack)

  return (
    <Box sx={{ py: 1 }}>
      <SectionTitle>Undo</SectionTitle>
      {undoStack.length === 0 ? (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            히스토리가 없습니다.
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {undoStack.map((snapshot, index) => (
            <ListItemButton
              key={`${snapshot.label}-${index}`}
              onClick={() => jumpToUndoIndexWithDirty(index)}
              sx={{ px: 1.5, py: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={snapshot.label}
                secondary={`${snapshot.tracks.reduce((count, track) => count + track.clips.length, 0)} clips`}
                primaryTypographyProps={{ variant: 'caption', fontWeight: index === 0 ? 700 : 500 }}
                secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItemButton>
          ))}
        </List>
      )}

      <Divider sx={{ my: 1 }} />

      <SectionTitle>Redo</SectionTitle>
      {redoStack.length === 0 ? (
        <Box sx={{ px: 1.5, py: 1 }}>
          <Typography variant="caption" color="text.secondary">
            다시 실행할 항목이 없습니다.
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {redoStack.map((snapshot, index) => (
            <ListItemButton
              key={`${snapshot.label}-${index}`}
              onClick={index === 0 ? redoWithDirty : undefined}
              disabled={index !== 0}
              sx={{ px: 1.5, py: 0.5 }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <HistoryIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={snapshot.label}
                secondary={`${snapshot.tracks.reduce((count, track) => count + track.clips.length, 0)} clips`}
                primaryTypographyProps={{ variant: 'caption', fontWeight: index === 0 ? 700 : 500 }}
                secondaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              />
            </ListItemButton>
          ))}
        </List>
      )}
    </Box>
  )
}
