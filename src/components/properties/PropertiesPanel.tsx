import { withHistory } from '@/lib/withHistory'
import { useAssetStore } from '@/store/assetStore'
import { useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import { type ToolType, useToolStore } from '@/store/toolStore'
import type { SvgIconComponent } from '@mui/icons-material'
import ArticleIcon from '@mui/icons-material/Article'
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined'
import ContentCutIcon from '@mui/icons-material/ContentCut'
import CropIcon from '@mui/icons-material/Crop'
import EastIcon from '@mui/icons-material/East'
import EditIcon from '@mui/icons-material/Edit'
import FitScreenIcon from '@mui/icons-material/FitScreen'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import MouseIcon from '@mui/icons-material/Mouse'
import RectangleOutlinedIcon from '@mui/icons-material/RectangleOutlined'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import Slider from '@mui/material/Slider'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type React from 'react'

const SYSTEM_FONTS = [
  'Arial',
  'Segoe UI',
  'Roboto',
  'Helvetica',
  'Noto Sans KR',
  'Malgun Gothic',
  'Apple SD Gothic Neo',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'monospace',
  'sans-serif',
]

const FALLBACK_TEXT_PROPS = {
  text: '',
  fontFamily: 'sans-serif',
  fontSize: 72,
  color: '#ffffff',
  bold: false,
  italic: false,
  align: 'center' as const,
}

const MIN_CANVAS_SIZE = 64
const MAX_CANVAS_SIZE = 8192
const ASPECT_RATIO_EPSILON = 0.01

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

function ColorInput({
  value,
  onChange,
}: {
  value: string
  onChange: (value: string) => void
}) {
  const colorValue = /^#[0-9a-f]{6}$/i.test(value) ? value : '#000000'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        component="input"
        type="color"
        value={colorValue}
        onChange={(event) => onChange(event.target.value)}
        sx={{
          width: 28,
          height: 24,
          border: 'none',
          borderRadius: 0.5,
          cursor: 'pointer',
          p: 0,
          bgcolor: 'transparent',
        }}
      />
      <TextField
        size="small"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
        sx={{ flex: 1 }}
      />
    </Box>
  )
}

function formatRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '-'
  return (width / height).toFixed(2)
}

// ─────────────────────────────────────────────────────────────────────────────
// 도구별 패널 컴포넌트
// ─────────────────────────────────────────────────────────────────────────────

function SelectPanel() {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const tracks = useTimelineStore((s) => s.tracks)
  const assets = useAssetStore((s) => s.assets)
  const canvasWidth = useTimelineStore((s) => s.canvasWidth)
  const canvasHeight = useTimelineStore((s) => s.canvasHeight)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)
  const fitClipToCanvas = useTimelineStore((s) => s.fitClipToCanvas)
  const setCanvasDimensions = useTimelineStore((s) => s.setCanvasDimensions)
  const updateProjectMeta = useProjectStore((s) => s.updateProjectMeta)

  const clip = selectedClipId
    ? tracks.flatMap((t) => t.clips).find((c) => c.id === selectedClipId)
    : null
  const selectedAsset = clip?.assetId ? assets.find((asset) => asset.id === clip.assetId) : null
  const sourceWidth = selectedAsset?.width ?? 0
  const sourceHeight = selectedAsset?.height ?? 0
  const sourceAspect = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : null
  const clipAspect = clip && clip.width > 0 && clip.height > 0 ? clip.width / clip.height : null
  const fitModesLookSame =
    sourceAspect !== null &&
    clipAspect !== null &&
    Math.abs(sourceAspect - clipAspect) < ASPECT_RATIO_EPSILON

  const updateCanvasSize = (width: number, height: number) => {
    const nextWidth = Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.round(width)))
    const nextHeight = Math.max(MIN_CANVAS_SIZE, Math.min(MAX_CANVAS_SIZE, Math.round(height)))
    withHistory('캔버스 크기 변경', () => setCanvasDimensions(nextWidth, nextHeight))
    updateProjectMeta({ canvasWidth: nextWidth, canvasHeight: nextHeight, preset: 'custom' })
  }

  if (!clip) {
    return (
      <>
        <SectionTitle>캔버스</SectionTitle>
        <Row label="W">
          <NumInput
            value={canvasWidth}
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            onChange={(value) => updateCanvasSize(value, canvasHeight)}
            unit="px"
          />
        </Row>
        <Row label="H">
          <NumInput
            value={canvasHeight}
            min={MIN_CANVAS_SIZE}
            max={MAX_CANVAS_SIZE}
            onChange={(value) => updateCanvasSize(canvasWidth, value)}
            unit="px"
          />
        </Row>
        <Box sx={{ px: 1.5, py: 2 }}>
          <Typography variant="caption" color="text.secondary">
            캔버스에서 클립을 선택하세요.
          </Typography>
        </Box>
      </>
    )
  }

  return (
    <>
      <SectionTitle>캔버스</SectionTitle>
      <Row label="W">
        <NumInput
          value={canvasWidth}
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          onChange={(value) => updateCanvasSize(value, canvasHeight)}
          unit="px"
        />
      </Row>
      <Row label="H">
        <NumInput
          value={canvasHeight}
          min={MIN_CANVAS_SIZE}
          max={MAX_CANVAS_SIZE}
          onChange={(value) => updateCanvasSize(canvasWidth, value)}
          unit="px"
        />
      </Row>

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

      {clip.clipType === 'media' && (
        <>
          <SectionTitle>배치</SectionTitle>
          <Box sx={{ px: 1.5, pb: 0.5 }}>
            <Button
              size="small"
              variant="outlined"
              fullWidth
              disabled
              startIcon={<FitScreenIcon sx={{ fontSize: 16 }} />}
              onClick={() => withHistory('클립을 캔버스에 맞춤', () => fitClipToCanvas(clip.id))}
              sx={{ justifyContent: 'flex-start', fontSize: 12 }}
            >
              캔버스 전체에 맞춤
            </Button>
          </Box>
          <Row label="맞춤">
            <TextField
              size="small"
              select
              disabled
              value={clip.fitMode}
              onChange={(e) =>
                updateClipCanvas(clip.id, { fitMode: e.target.value as typeof clip.fitMode })
              }
              inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
              fullWidth
            >
              <MenuItem value="fit">fit — 비율 유지, 전체 보이기</MenuItem>
              <MenuItem value="fill">fill — 비율 유지, 꽉 채우기</MenuItem>
              <MenuItem value="stretch">stretch — 캔버스에 늘리기</MenuItem>
              <MenuItem value="center">center — 원본 중앙 배치</MenuItem>
              <MenuItem value="crop">crop — cropRect 사용</MenuItem>
            </TextField>
          </Row>
          <Box sx={{ px: 1.5, pb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              현재 비디오 프리뷰는 검증용으로 전체 캔버스에 고정 렌더되므로 맞춤 모드는 비활성화되어
              있습니다.
            </Typography>
          </Box>
          {fitModesLookSame && (
            <Box sx={{ px: 1.5, pb: 1 }}>
              <Typography variant="caption" color="text.secondary">
                원본({sourceWidth}×{sourceHeight}, {formatRatio(sourceWidth, sourceHeight)})과 클립(
                {Math.round(clip.width)}×{Math.round(clip.height)},{' '}
                {formatRatio(clip.width, clip.height)}) 비율이 같아 fit/fill/stretch가 거의 동일하게
                보일 수 있습니다.
              </Typography>
            </Box>
          )}
        </>
      )}
    </>
  )
}

function TextPanel() {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const tracks = useTimelineStore((s) => s.tracks)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)

  const clip = selectedClipId
    ? tracks.flatMap((track) => track.clips).find((candidate) => candidate.id === selectedClipId)
    : null

  if (!clip || clip.clipType !== 'text') {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          캔버스에서 텍스트 클립을 선택하세요.
        </Typography>
      </Box>
    )
  }

  const textProps = clip.textProps ?? FALLBACK_TEXT_PROPS
  const updateText = (label: string, update: Partial<typeof textProps>) => {
    withHistory(label, () =>
      updateClipCanvas(clip.id, {
        textProps: {
          ...textProps,
          ...update,
        },
      })
    )
  }

  return (
    <>
      <SectionTitle>텍스트 속성</SectionTitle>
      <Row label="폰트">
        <TextField
          size="small"
          select
          value={textProps.fontFamily}
          onChange={(event) => updateText('텍스트 폰트 변경', { fontFamily: event.target.value })}
          inputProps={{ style: { padding: '2px 6px', fontSize: 12 } }}
          fullWidth
        >
          {SYSTEM_FONTS.map((font) => (
            <MenuItem key={font} value={font} sx={{ fontFamily: font }}>
              {font}
            </MenuItem>
          ))}
        </TextField>
      </Row>
      <Row label="크기">
        <NumInput
          value={textProps.fontSize}
          min={8}
          max={512}
          onChange={(value) => updateText('텍스트 크기 변경', { fontSize: value })}
          unit="px"
        />
      </Row>
      <Row label="색상">
        <ColorInput
          value={textProps.color}
          onChange={(value) => updateText('텍스트 색상 변경', { color: value })}
        />
      </Row>
      <Row label="스타일">
        <ToggleButtonGroup
          size="small"
          value={[...(textProps.bold ? ['bold'] : []), ...(textProps.italic ? ['italic'] : [])]}
          onChange={(_, values) =>
            updateText('텍스트 스타일 변경', {
              bold: (values as string[]).includes('bold'),
              italic: (values as string[]).includes('italic'),
            })
          }
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 12 } }}
        >
          <ToggleButton value="bold">
            <strong>B</strong>
          </ToggleButton>
          <ToggleButton value="italic">
            <em>I</em>
          </ToggleButton>
        </ToggleButtonGroup>
      </Row>
      <Row label="정렬">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={textProps.align}
          onChange={(_, value) => {
            if (value) updateText('텍스트 정렬 변경', { align: value })
          }}
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 11 } }}
        >
          <ToggleButton value="left">좌</ToggleButton>
          <ToggleButton value="center">중</ToggleButton>
          <ToggleButton value="right">우</ToggleButton>
        </ToggleButtonGroup>
      </Row>
    </>
  )
}

function ShapePanel({ type }: { type: 'rect' | 'circle' | 'arrow' }) {
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const tracks = useTimelineStore((s) => s.tracks)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)

  const clip = selectedClipId
    ? tracks.flatMap((track) => track.clips).find((candidate) => candidate.id === selectedClipId)
    : null

  if (!clip || clip.clipType !== 'shape' || !clip.shapeProps) {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          캔버스에서 도형 클립을 선택하세요.
        </Typography>
      </Box>
    )
  }

  const shapeProps = clip.shapeProps
  const updateShape = (label: string, update: Partial<typeof shapeProps>) => {
    withHistory(label, () =>
      updateClipCanvas(clip.id, {
        shapeProps: {
          ...shapeProps,
          ...update,
        },
      })
    )
  }
  const selectedType = shapeProps.shapeType

  return (
    <>
      <SectionTitle>도형 속성</SectionTitle>
      {selectedType !== type && (
        <Box sx={{ px: 1.5, pb: 0.5 }}>
          <Typography variant="caption" color="text.secondary">
            선택된 도형: {selectedType}
          </Typography>
        </Box>
      )}
      <Row label="채우기">
        <ColorInput
          value={shapeProps.fill}
          onChange={(value) => updateShape('도형 채우기 색상 변경', { fill: value })}
        />
      </Row>
      <Row label="선 색">
        <ColorInput
          value={shapeProps.stroke}
          onChange={(value) => updateShape('도형 선 색상 변경', { stroke: value })}
        />
      </Row>
      <Row label="선 두께">
        <NumInput
          value={shapeProps.strokeWidth}
          min={0}
          max={50}
          onChange={(value) => updateShape('도형 선 두께 변경', { strokeWidth: value })}
          unit="px"
        />
      </Row>
      {selectedType === 'rect' && (
        <Row label="모서리">
          <NumInput
            value={shapeProps.cornerRadius ?? 0}
            min={0}
            max={500}
            onChange={(value) => updateShape('도형 모서리 변경', { cornerRadius: value })}
            unit="px"
          />
        </Row>
      )}
      <Row label="선 스타일">
        <ToggleButtonGroup
          exclusive
          size="small"
          value={shapeProps.dash?.length ? 'dash' : 'solid'}
          onChange={(_, value) => {
            if (value) updateShape('도형 선 스타일 변경', { dash: value === 'dash' ? [12, 8] : [] })
          }}
          sx={{ '& .MuiToggleButton-root': { py: 0.25, px: 0.75, fontSize: 11 } }}
        >
          <ToggleButton value="solid">실선</ToggleButton>
          <ToggleButton value="dash">점선</ToggleButton>
        </ToggleButtonGroup>
      </Row>
      {selectedType === 'arrow' && (
        <Row label="화살촉">
          <ToggleButtonGroup
            size="small"
            value="filled"
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
  const selectedClipId = useTimelineStore((s) => s.selectedClipId)
  const tracks = useTimelineStore((s) => s.tracks)
  const updateClipCanvas = useTimelineStore((s) => s.updateClipCanvas)
  const cropEditing = useToolStore((s) => s.cropEditing)
  const setCropEditing = useToolStore((s) => s.setCropEditing)

  const clip = selectedClipId
    ? tracks.flatMap((track) => track.clips).find((candidate) => candidate.id === selectedClipId)
    : null
  const cropRect = clip?.cropRect

  const startEditing = () => {
    setCropEditing(true)
  }

  const stopEditing = () => {
    setCropEditing(false)
  }

  const updateCropRect = (update: Partial<NonNullable<typeof cropRect>>) => {
    if (!clip) return
    const next = {
      x: cropRect?.x ?? 0,
      y: cropRect?.y ?? 0,
      width: cropRect?.width ?? Math.max(1, Math.round(clip.width)),
      height: cropRect?.height ?? Math.max(1, Math.round(clip.height)),
      ...update,
    }
    withHistory('자르기 영역 변경', () =>
      updateClipCanvas(clip.id, {
        fitMode: 'crop',
        cropRect: next,
      })
    )
  }

  if (!clip || clip.clipType !== 'media') {
    return (
      <Box sx={{ px: 1.5, py: 2 }}>
        <Typography variant="caption" color="text.secondary">
          캔버스에서 미디어 클립을 선택한 뒤 자르기 편집을 시작하세요.
        </Typography>
      </Box>
    )
  }

  return (
    <>
      <SectionTitle>자르기 영역</SectionTitle>
      <Box sx={{ px: 1.5, pb: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Button
          size="small"
          variant={cropEditing ? 'contained' : 'outlined'}
          startIcon={<EditIcon sx={{ fontSize: 16 }} />}
          onClick={cropEditing ? stopEditing : startEditing}
          sx={{ justifyContent: 'flex-start', fontSize: 12 }}
        >
          {cropEditing ? '자르기 편집 종료' : '자르기 편집 시작'}
        </Button>
        <Typography variant="caption" color="text.secondary">
          편집 시작 후 캔버스에서 드래그하면 crop 영역이 설정됩니다.
        </Typography>
      </Box>

      {!cropEditing && cropRect ? (
        <Box sx={{ px: 1.5, pb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            현재 crop: X {cropRect.x}, Y {cropRect.y}, W {cropRect.width}, H {cropRect.height}
          </Typography>
        </Box>
      ) : null}

      {cropEditing ? (
        <>
          <Row label="X">
            <NumInput
              value={cropRect?.x ?? 0}
              min={0}
              onChange={(value) => updateCropRect({ x: value })}
              unit="px"
            />
          </Row>
          <Row label="Y">
            <NumInput
              value={cropRect?.y ?? 0}
              min={0}
              onChange={(value) => updateCropRect({ y: value })}
              unit="px"
            />
          </Row>
          <Row label="W">
            <NumInput
              value={cropRect?.width ?? Math.round(clip.width)}
              min={1}
              onChange={(value) => updateCropRect({ width: value })}
              unit="px"
            />
          </Row>
          <Row label="H">
            <NumInput
              value={cropRect?.height ?? Math.round(clip.height)}
              min={1}
              onChange={(value) => updateCropRect({ height: value })}
              unit="px"
            />
          </Row>
        </>
      ) : null}
      {cropEditing ? (
        <>
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
                <ToggleButton key={r} value={r} disabled>
                  {r}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        </>
      ) : null}
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

export function PropertiesPanel({ onClose }: { onClose?: () => void }) {
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
        <Tooltip title="속성 패널 닫기">
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ ml: 'auto' }}
            aria-label="속성 패널 닫기"
          >
            <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>

      {/* 내용 */}
      <Box sx={{ flex: 1, overflowY: 'auto', pb: 2 }}>{renderContent()}</Box>
    </Box>
  )
}
