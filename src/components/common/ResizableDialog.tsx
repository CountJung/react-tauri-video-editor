import CloseIcon from '@mui/icons-material/Close'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Paper from '@mui/material/Paper'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface ResizableDialogProps {
  open: boolean
  onClose: () => void
  /** 제목바에 표시할 텍스트. 생략 시 AppBar 없이 children만 렌더 */
  dialogTitle?: string
  defaultWidth?: number
  defaultHeight?: number
  minWidth?: number
  minHeight?: number
  /** localStorage 키로 크기 세션 유지 */
  storageKey?: string
  children: React.ReactNode
  hideBackdrop?: boolean
}

function readSize(
  storageKey: string | undefined,
  defaultWidth: number,
  defaultHeight: number
): { w: number; h: number } {
  if (!storageKey) return { w: defaultWidth, h: defaultHeight }
  try {
    const raw = localStorage.getItem(`resizable-dialog:${storageKey}`)
    if (raw) {
      const parsed = JSON.parse(raw) as { w?: number; h?: number }
      return {
        w: typeof parsed.w === 'number' ? parsed.w : defaultWidth,
        h: typeof parsed.h === 'number' ? parsed.h : defaultHeight,
      }
    }
  } catch {
    // ignore
  }
  return { w: defaultWidth, h: defaultHeight }
}

/**
 * 드래그 가능한 리사이즈 다이얼로그.
 * 모든 팝업은 반드시 이 컴포넌트를 사용한다 — MUI Dialog 직접 사용 금지.
 */
export function ResizableDialog({
  open,
  onClose,
  dialogTitle,
  defaultWidth = 520,
  defaultHeight = 380,
  minWidth = 300,
  minHeight = 200,
  storageKey,
  children,
  hideBackdrop = false,
}: ResizableDialogProps) {
  const initialSize = readSize(storageKey, defaultWidth, defaultHeight)
  const [size, setSize] = useState(initialSize)
  const sizeRef = useRef(size)
  sizeRef.current = size

  // 크기 변경 시 localStorage 저장
  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(`resizable-dialog:${storageKey}`, JSON.stringify(size))
  }, [size, storageKey])

  // open 시 저장된 크기 복원
  useEffect(() => {
    if (open) {
      setSize(readSize(storageKey, defaultWidth, defaultHeight))
    }
  }, [open, storageKey, defaultWidth, defaultHeight])

  // 8방향 리사이즈 핸들러
  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent, direction: string) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const startW = sizeRef.current.w
      const startH = sizeRef.current.h

      function onMove(ev: PointerEvent) {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        setSize((prev) => {
          let w = prev.w
          let h = prev.h
          if (direction.includes('e')) w = Math.max(minWidth, startW + dx)
          if (direction.includes('w')) w = Math.max(minWidth, startW - dx)
          if (direction.includes('s')) h = Math.max(minHeight, startH + dy)
          if (direction.includes('n')) h = Math.max(minHeight, startH - dy)
          return { w, h }
        })
      }
      function onUp() {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [minWidth, minHeight]
  )

  const resizeHandles = [
    { dir: 'e', cursor: 'ew-resize', style: { top: 8, right: 0, bottom: 8, width: 6 } },
    { dir: 'w', cursor: 'ew-resize', style: { top: 8, left: 0, bottom: 8, width: 6 } },
    { dir: 's', cursor: 'ns-resize', style: { left: 8, right: 8, bottom: 0, height: 6 } },
    { dir: 'se', cursor: 'se-resize', style: { right: 0, bottom: 0, width: 12, height: 12 } },
    { dir: 'sw', cursor: 'sw-resize', style: { left: 0, bottom: 0, width: 12, height: 12 } },
  ]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      hideBackdrop={hideBackdrop}
      PaperComponent={({ children: paperChildren }) => (
        <Paper
          elevation={8}
          sx={{
            width: size.w,
            height: size.h,
            minWidth,
            minHeight,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            m: 0,
          }}
        >
          {paperChildren}
          {/* 리사이즈 핸들 */}
          {resizeHandles.map(({ dir, cursor, style }) => (
            <Box
              key={dir}
              onPointerDown={(e) => handleResizePointerDown(e, dir)}
              sx={{
                position: 'absolute',
                cursor,
                zIndex: 10,
                ...style,
              }}
            />
          ))}
        </Paper>
      )}
      sx={{ '& .MuiDialog-paper': { m: 0 } }}
    >
      {dialogTitle && (
        <AppBar
          position="static"
          elevation={0}
          sx={{ flexShrink: 0, cursor: 'default', userSelect: 'none' }}
        >
          <Toolbar variant="dense" sx={{ minHeight: 40, gap: 0.5 }}>
            <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 600, fontSize: 13 }}>
              {dialogTitle}
            </Typography>
            <IconButton size="small" onClick={onClose} sx={{ color: 'inherit' }} aria-label="닫기">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Toolbar>
        </AppBar>
      )}
      <Box sx={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
        {children}
      </Box>
    </Dialog>
  )
}
