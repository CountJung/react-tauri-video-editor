import Box from '@mui/material/Box'
import { useCallback, useRef } from 'react'

interface LayoutResizerProps {
  /** 'vertical' = 세로 막대 (좌우 패널 분할, ew-resize)
   *  'horizontal' = 가로 막대 (상하 패널 분할, ns-resize) */
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

/**
 * 드래그로 레이아웃 크기를 조절하는 얇은 핸들 바.
 * onResize(delta) 로 픽셀 변화량을 전달한다.
 */
export function LayoutResizer({ direction, onResize }: LayoutResizerProps) {
  const onResizeRef = useRef(onResize)
  onResizeRef.current = onResize

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      let lastPos = direction === 'vertical' ? e.clientX : e.clientY

      document.body.style.cursor = direction === 'vertical' ? 'ew-resize' : 'ns-resize'
      document.body.style.userSelect = 'none'

      function onMouseMove(ev: MouseEvent) {
        const currentPos = direction === 'vertical' ? ev.clientX : ev.clientY
        const delta = currentPos - lastPos
        lastPos = currentPos
        onResizeRef.current(delta)
      }

      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
      }

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
    },
    [direction]
  )

  return (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        flexShrink: 0,
        width: direction === 'vertical' ? 4 : '100%',
        height: direction === 'vertical' ? '100%' : 4,
        cursor: direction === 'vertical' ? 'ew-resize' : 'ns-resize',
        bgcolor: 'divider',
        transition: 'background-color 0.15s',
        zIndex: 10,
        '&:hover': { bgcolor: 'primary.main' },
        '&:active': { bgcolor: 'primary.dark' },
      }}
    />
  )
}
