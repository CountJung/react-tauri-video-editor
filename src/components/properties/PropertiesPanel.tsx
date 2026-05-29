import { useTimelineStore } from '@/store/timelineStore'
import { type ToolType, useToolStore } from '@/store/toolStore'
import type { SvgIconComponent } from '@mui/icons-material'
import ArticleIcon from '@mui/icons-material/Article'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import CropIcon from '@mui/icons-material/Crop'
import EastIcon from '@mui/icons-material/East'
import MouseIcon from '@mui/icons-material/Mouse'
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined'
import Box from '@mui/material/Box'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type React from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// 헬퍼
// ─────────────────────────────────────────────────────────────────────────────

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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 0.5, gap: 1 }}>
      <Typography variant="caption" sx={{ width: 56, flexShrink: 0, color: 'text.secondary' }}>
        {label}
      </Typography>
      <Box sx={{ flex: 1 }}>{children}</Box>
    </Box>
  )
}

function NumInput({
  value,
  onChange,
  min,
  max,
  unit = '',
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  unit?: string
}) {
  return (
    <TextField
      size="small"
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      inputProps={{ min, max, style: { padding: '2px 6px', fontSize: 12 } }}
      InputProps={{
        endAdornment: unit ? (
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', mr: 0.5, whiteSpace: 'nowrap' }}
          >
            {unit}
          </Typography>
        ) : undefined,
      }}
      sx={{ '& .MuiOutlinedInput-root': { fontSize: 12 } }}
      fullWidth
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 도구별 패널 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

function SelectPanel() {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const tracks = useTimelineStore((s) => s.tracks)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)

  const clip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null

  if (!clip) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          캔버스에서 클립을 선택하세요.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <SectionTitle>위치</SectionTitle>
      <Row label="X">
        <NumInput
          value={Math.round(clip.x)}
          onChange={(v) => updateClipCanvas(clip.id, { x: v })}
        />
      </Row>
      <Row label="Y">
        <NumInput
          value={Math.round(clip.y)}
          onChange={(v) => updateClipCanvas(clip.id, { y: v })}
        />
      </Row>

      <SectionTitle>크기</SectionTitle>
      <Row label="W">
        <NumInput
          value={Math.round(clip.width)}
          min={1}
          onChange={(v) => updateClipCanvas(clip.id, { width: v })}
          unit="px"
        />
      </Row>
      <Row label="H">
        <NumInput
          value={Math.round(clip.height)}
          min={1}
          onChange={(v) => updateClipCanvas(clip.id, { height: v })}
          unit="px"
        />
      </Row>

      <SectionTitle>변환</SectionTitle>
      <Row label="회전">
        <NumInput
          value={Math.round(clip.rotation)}
          min={-180}
          max={180}
          onChange={(v) => updateClipCanvas(clip.id, { rotation: v })}
          unit="°"
        />
      </Row>
      <Row label="불투명도">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Slider
            size="small"
            value={Math.round(clip.opacity * 100)}
            min={0}
            max={100}
            onChange={(_, v) => updateClipCanvas(clip.id, { opacity: (v as number) / 100 })}
            sx={{ flex: 1 }}
          />
          <Typography variant="caption" sx={{ width: 30, textAlign: 'right' }}>
            {Math.round(clip.opacity * 100)}%
          </Typography>
        </Box>
      </Row>
    </>
  )
}

function TextPanel() {
  return (
    <>
      <SectionTitle>텍스트 속성</SectionTitle>
      <Row label="폰트">
        <TextField
          size="small"
          defaultValue="Sans-Serif"
          inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
          fullWidth
        />
      </Row>
      <Row label="크기">
        <NumInput value={48} min={8} max={512} onChange={() => {}} unit="px" />
      </Row>
      <Row label="색상">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="input"
            type="color"
            defaultValue="#ffffff"
            sx={{
              width: 28,
              height: 24,
              border: 'none',
              borderRadius: 0.5,
              cursor: 'pointer',
              p: 0,
            }}
          />
          <TextField
            size="small"
            defaultValue="#ffffff"
            inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
            sx={{ flex: 1 }}
          />
        </Box>
      </Row>
      <Row label="스타일">
        <ToggleButtonGroup
          size="small"
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 12 } }}
        >
          <ToggleButton value="bold">
            <strong>B</strong>
          </ToggleButton>
          <ToggleButton value="italic">
            <em>I</em>
          </ToggleButton>
          <ToggleButton value="underline">
            <u>U</u>
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      <Row label="정렬">
        <ToggleButtonGroup
          size="small"
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 11 } }}
        >
          <ToggleButton value="left">좌</ToggleButton>
          <ToggleButton value="center">중</ToggleButton>
          <ToggleButton value="right">우</ToggleButton>
        </ToggleButtonGroup>
      </Row>
      <Box sx={{ px: 1.5, pt: 0.5 }}>
        <Typography variant="caption" color="text.secondary">
          * 텍스트 클립 선택 시 상세 편집 가능
        </Typography>
      </Box>
    </>
  )
}

function ShapePanel({ type }: { type: 'rect' | 'circle' | 'arrow' }) {
  return (
    <>
      <SectionTitle>도형 속성</SectionTitle>
      <Row label="채우기">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="input"
            type="color"
            defaultValue="#4fc3f7"
            sx={{
              width: 28,
              height: 24,
              border: 'none',
              borderRadius: 0.5,
              cursor: 'pointer',
              p: 0,
            }}
          />
          <TextField
            size="small"
            defaultValue="#4fc3f7"
            inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
            sx={{ flex: 1 }}
          />
        </Box>
      </Row>
      <Row label="선 색">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            component="input"
            type="color"
            defaultValue="#ffffff"
            sx={{
              width: 28,
              height: 24,
              border: 'none',
              borderRadius: 0.5,
              cursor: 'pointer',
              p: 0,
            }}
          />
          <TextField
            size="small"
            defaultValue="#ffffff"
            inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
            sx={{ flex: 1 }}
          />
        </Box>
      </Row>
      <Row label="선 두께">
        <NumInput value={2} min={0} max={50} onChange={() => {}} unit="px" />
      </Row>
      {type === 'rect' && (
        <Row label="모서리">
          <NumInput value={0} min={0} max={500} onChange={() => {}} unit="px" />
        </Row>
      )}
      {type === 'arrow' && (
        <Row label="화살촉">
          <ToggleButtonGroup
            size="small"
            sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 11 } }}
          >
            <ToggleButton value="filled">채움</ToggleButton>
            <ToggleButton value="open">열림</ToggleButton>
            <ToggleButton value="none">없음</ToggleButton>
          </ToggleButtonGroup>
        </Row>
      )}
    </>
  )
}

function CropPanel() {
  return (
    <>
      <SectionTitle>자르기 영역</SectionTitle>
      <Row label="X">
        <NumInput value={0} min={0} onChange={() => {}} unit="px" />
      </Row>
      <Row label="Y">
        <NumInput value={0} min={0} onChange={() => {}} unit="px" />
      </Row>
      <Row label="W">
        <NumInput value={1920} min={1} onChange={() => {}} unit="px" />
      </Row>
      <Row label="H">
        <NumInput value={1080} min={1} onChange={() => {}} unit="px" />
      </Row>
      <SectionTitle>비율</SectionTitle>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <ToggleButtonGroup
          size="small"
          sx={{
            flexWrap: 'wrap',
            gap: 0.5,
            '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 11 },
          }}
        >
          {['16:9', '9:16', '1:1', '4:3', '자유'].map((r) => (
            <ToggleButton key={r} value={r}>
              {r}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
    </>
  )
}

function RazorPanel() {
  const currentTime = useTimelineStore((s) => s.currentTime)
  const toTime = (sec: number) => {
    const m = Math.floor(sec / 60)
      .toString()
      .padStart(2, '0')
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0')
    const ms = Math.round((sec % 1) * 100)
      .toString()
      .padStart(2, '0')
    return `${m}:${s}.${ms}`
  }
  return (
    <Box sx={{ px: 1.5, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        현재 플레이헤드 위치:
      </Typography>
      <Typography variant="h6" sx={{ fontFamily: 'monospace', fontSize: 18 }}>
        {toTime(currentTime)}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        타임라인에서 클립을 클릭하면 해당 위치에서 분할됩니다.
      </Typography>
    </Box>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// 도구 레이블 맵
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_META: Record<ToolType, { label: string; Icon: SvgIconComponent }> = {
  select: { label: '선택 도구', Icon: MouseIcon },
  text: { label: '텍스트 도구', Icon: ArticleIcon },
  rect: { label: '사각형 도구', Icon: RectangleOutlinedIcon },
  circle: { label: '원형 도구', Icon: CircleOutlinedIcon },
  arrow: { label: '화살표 도구', Icon: EastIcon },
  crop: { label: '자르기 도구', Icon: CropIcon },
  razor: { label: '클립 분할 도구', Icon: ContentCutIcon },
}

// ─────────────────────────────────────────────────────────────────────────────
// PropertiesPanel (메인)
// ─────────────────────────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const activeTool = useToolStore((s) => s.activeTool)
  const { label, Icon } = TOOL_META[activeTool]

  const renderContent = () => {
    switch (activeTool) {
      case 'select':
        return <SelectPanel />
      case 'text':
        return <TextPanel />
      case 'rect':
        return <ShapePanel type="rect" />
      case 'circle':
        return <ShapePanel type="circle" />
      case 'arrow':
        return <ShapePanel type="arrow" />
      case 'crop':
        return <CropPanel />
      case 'razor':
        return <RazorPanel />
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper',
        borderLeft: 1,
        borderColor: 'divider',
        overflow: 'hidden',
      }}
    >
      {/* 헤더 */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 0.75,
          borderBottom: 1,
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Tooltip title={label}>
          <Icon sx={{ fontSize: 16, color: 'primary.main' }} />
        </Tooltip>
        <Typography variant="caption" sx={{ fontWeight: 600, fontSize: 12 }}>
          {label}
        </Typography>
      </Box>

      {/* 내용 */}
      <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>{renderContent()}</Box>
    </Box>
  )
}
