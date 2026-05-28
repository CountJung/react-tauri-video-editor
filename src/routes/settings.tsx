import { STORAGE_KEYS } from '@/lib/storageKeys'
import { type ThemeMode, useSettingsStore } from '@/store/settingsStore'
import { useTimelineStore } from '@/store/timelineStore'
import Box from '@mui/material/Box'
import Divider from '@mui/material/Divider'
import FormControl from '@mui/material/FormControl'
import InputLabel from '@mui/material/InputLabel'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import Slider from '@mui/material/Slider'
import Typography from '@mui/material/Typography'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { themeMode, setThemeMode } = useSettingsStore()
  const zoom = useTimelineStore((s) => s.zoom)
  const snapInterval = useTimelineStore((s) => s.snapInterval)
  const setZoom = useTimelineStore((s) => s.setZoom)
  const setSnapInterval = useTimelineStore((s) => s.setSnapInterval)

  function handleZoomChange(_: Event, value: number | number[]) {
    const v = Array.isArray(value) ? value[0] : value
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_DEFAULT_ZOOM, JSON.stringify(v))
    } catch {
      // ignore
    }
    setZoom(v)
  }

  function handleSnapChange(value: number) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_SNAP_INTERVAL, JSON.stringify(value))
    } catch {
      // ignore
    }
    setSnapInterval(value)
  }

  return (
    <Box sx={{ p: 3, maxWidth: 560, mx: 'auto', mt: 2 }}>
      {/* ── 화면 설정 ── */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
        화면
      </Typography>

      <FormControl fullWidth size="small" sx={{ mt: 1.5, mb: 3 }}>
        <InputLabel id="theme-mode-label">테마 모드</InputLabel>
        <Select<ThemeMode>
          labelId="theme-mode-label"
          value={themeMode}
          label="테마 모드"
          onChange={(e) => setThemeMode(e.target.value as ThemeMode)}
        >
          <MenuItem value="dark">다크</MenuItem>
          <MenuItem value="light">라이트</MenuItem>
          <MenuItem value="system">시스템 설정 따르기</MenuItem>
        </Select>
      </FormControl>

      <Divider sx={{ mb: 3 }} />

      {/* ── 타임라인 설정 ── */}
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>
        타임라인
      </Typography>

      <Box sx={{ mt: 1.5, mb: 3 }}>
        <Typography variant="body2" gutterBottom>
          기본 줌 레벨: <strong>{zoom} px/s</strong>
        </Typography>
        <Slider
          min={10}
          max={300}
          step={5}
          value={zoom}
          onChange={handleZoomChange}
          valueLabelDisplay="auto"
          valueLabelFormat={(v) => `${v} px/s`}
        />
        <Typography variant="caption" color="text.secondary">
          앱 재시작 시 이 값이 기본값으로 사용됩니다.
        </Typography>
      </Box>

      <FormControl fullWidth size="small" sx={{ mb: 3 }}>
        <InputLabel id="snap-interval-label">스냅 간격</InputLabel>
        <Select
          labelId="snap-interval-label"
          value={snapInterval}
          label="스냅 간격"
          onChange={(e) => handleSnapChange(Number(e.target.value))}
        >
          <MenuItem value={0.1}>0.1초</MenuItem>
          <MenuItem value={0.25}>0.25초</MenuItem>
          <MenuItem value={0.5}>0.5초</MenuItem>
          <MenuItem value={1}>1초</MenuItem>
          <MenuItem value={2}>2초</MenuItem>
          <MenuItem value={5}>5초</MenuItem>
        </Select>
      </FormControl>
    </Box>
  )
}
