import { type ToolType, useToolStore } from '@/store/toolStore'
import ArticleIcon from '@mui/icons-material/Article'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import CropIcon from '@mui/icons-material/Crop'
import EastIcon from '@mui/icons-material/East'
import MouseIcon from '@mui/icons-material/Mouse'
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import Tooltip from '@mui/material/Tooltip'
import type React from 'react'

interface ToolButtonProps {
  tool: ToolType
  label: string
  icon: React.ReactNode
  active: boolean
  onClick: () => void
}

function ToolButton({ label, icon, active, onClick }: ToolButtonProps) {
  return (
    <Tooltip title={label} placement="right" arrow>
      <Box
        component="button"
        onClick={onClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 40,
          height: 40,
          borderRadius: 1,
          border: 'none',
          cursor: 'pointer',
          bgcolor: active ? 'primary.main' : 'transparent',
          color: active ? 'primary.contrastText' : 'text.secondary',
          transition: 'background-color 0.15s, color 0.15s',
          '&:hover': {
            bgcolor: active ? 'primary.dark' : 'action.hover',
            color: active ? 'primary.contrastText' : 'text.primary',
          },
        }}
      >
        {icon}
      </Box>
    </Tooltip>
  )
}

/**
 * 도구 선택 패널 — CanvasCompositor 좌측 세로 툴바
 *
 * 제공 도구:
 * - Select  : 오브젝트 선택·이동·리사이즈
 * - Text    : 텍스트 클립 삽입
 * - Rect    : 사각형 도형 삽입
 * - Circle  : 원형 도형 삽입
 * - Arrow   : 화살표 삽입
 * - Crop    : 클립 표시 영역 자르기
 * - Razor   : 클립 분할
 */
export function ToolPanel() {
  const activeTool = useToolStore((s) => s.activeTool)
  const setActiveTool = useToolStore((s) => s.setActiveTool)

  const primaryTools: Array<{ tool: ToolType; label: string; icon: React.ReactNode }> = [
    { tool: 'select', label: '선택 (V)', icon: <MouseIcon fontSize="small" /> },
    { tool: 'text', label: '텍스트 (T)', icon: <ArticleIcon fontSize="small" /> },
  ]

  const shapeTools: Array<{ tool: ToolType; label: string; icon: React.ReactNode }> = [
    { tool: 'rect', label: '사각형 (R)', icon: <RectangleOutlinedIcon fontSize="small" /> },
    { tool: 'circle', label: '원형 (C)', icon: <CircleOutlinedIcon fontSize="small" /> },
    { tool: 'arrow', label: '화살표 (A)', icon: <EastIcon fontSize="small" /> },
  ]

  const editTools: Array<{ tool: ToolType; label: string; icon: React.ReactNode }> = [
    { tool: 'crop', label: '자르기 (X)', icon: <CropIcon fontSize="small" /> },
    { tool: 'razor', label: '클립 분할 (S)', icon: <ContentCutIcon fontSize="small" /> },
  ]

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width: 48,
        flexShrink: 0,
        bgcolor: 'background.paper',
        borderRight: 1,
        borderColor: 'divider',
        py: 1,
        gap: 0.5,
        overflowY: 'auto',
      }}
    >
      {primaryTools.map((t) => (
        <ToolButton
          key={t.tool}
          tool={t.tool}
          label={t.label}
          icon={t.icon}
          active={activeTool === t.tool}
          onClick={() => setActiveTool(t.tool)}
        />
      ))}

      <Divider flexItem sx={{ my: 0.5, mx: 1 }} />

      {shapeTools.map((t) => (
        <ToolButton
          key={t.tool}
          tool={t.tool}
          label={t.label}
          icon={t.icon}
          active={activeTool === t.tool}
          onClick={() => setActiveTool(t.tool)}
        />
      ))}

      <Divider flexItem sx={{ my: 0.5, mx: 1 }} />

      {editTools.map((t) => (
        <ToolButton
          key={t.tool}
          tool={t.tool}
          label={t.label}
          icon={t.icon}
          active={activeTool === t.tool}
          onClick={() => setActiveTool(t.tool)}
        />
      ))}
    </Box>
  )
}
