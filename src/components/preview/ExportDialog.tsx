import { tauriInvoke, tauriListen } from '@/lib/invoke'
import { useAssetStore } from '@/store/assetStore'
import { type ProjectMeta, useProjectStore } from '@/store/projectStore'
import { useTimelineStore } from '@/store/timelineStore'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import LinearProgress from '@mui/material/LinearProgress'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { save } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ResizableDialog } from '../common/ResizableDialog'
import { buildExportTimelinePayload } from './exportPayload'

interface ClipExportInfo {
  asset_path: string
  trim_start: number
  trim_end: number
  fit_mode: string
  crop_x?: number
  crop_y?: number
  crop_width?: number
  crop_height?: number
  canvas_width: number
  canvas_height: number
}

interface FfmpegProgress {
  percent: number
  current_time: number
  total_time: number
}

type ExportStatus = 'idle' | 'running' | 'done' | 'error'

const MIN_EXPORT_SIZE = 16
const MAX_EXPORT_SIZE = 7680
const MIN_EXPORT_FPS = 1
const MAX_EXPORT_FPS = 120

interface ExportDialogProps {
  open: boolean
  onClose: () => void
}

/** Phase 4 — Export 다이얼로그 (FFmpeg 인코딩 + 진행률 표시) */
export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const { tracks, canvasWidth, canvasHeight } = useTimelineStore()
  const { assets } = useAssetStore()
  const currentProject = useProjectStore((s) => s.currentProject)

  const [outputPath, setOutputPath] = useState('')
  const [status, setStatus] = useState<ExportStatus>('idle')
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const [exportWidth, setExportWidth] = useState(String(canvasWidth))
  const [exportHeight, setExportHeight] = useState(String(canvasHeight))
  const [exportFps, setExportFps] = useState('30')

  // 리스너 정리용 ref
  const unlistenersRef = useRef<Array<() => void>>([])

  // 다이얼로그 닫힐 때 상태 초기화
  useEffect(() => {
    if (!open) {
      setStatus('idle')
      setProgress(0)
      setErrorMsg('')
    } else {
      setExportWidth(String(currentProject?.canvasWidth ?? canvasWidth))
      setExportHeight(String(currentProject?.canvasHeight ?? canvasHeight))
      setExportFps(String(currentProject?.fps ?? 30))
    }
  }, [open, currentProject, canvasWidth, canvasHeight])

  // 컴포넌트 언마운트 시 리스너 정리
  useEffect(() => {
    return () => {
      for (const fn of unlistenersRef.current) fn()
      unlistenersRef.current = []
    }
  }, [])

  const handleSelectPath = async () => {
    const path = await save({
      title: '내보낼 파일 경로 선택',
      defaultPath: 'output.mp4',
      filters: [{ name: 'Video', extensions: ['mp4'] }],
    })
    if (path) setOutputPath(path)
  }

  const fallbackProjectMeta: ProjectMeta = useMemo(
    () => ({
      id: 'export-session',
      name: 'Untitled',
      filePath: null,
      canvasWidth,
      canvasHeight,
      fps: 30,
      preset: 'custom',
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }),
    [canvasWidth, canvasHeight]
  )

  /** 타임라인 상태에서 기존 Export 요약용 ClipExportInfo 배열 구성 */
  const buildClips = useCallback((): ClipExportInfo[] => {
    const clips: ClipExportInfo[] = []
    for (const track of tracks) {
      if (track.type !== 'video') continue
      const sorted = [...track.clips].sort((a, b) => a.start - b.start)
      for (const clip of sorted) {
        const asset = assets.find((a) => a.id === clip.assetId)
        if (!asset) continue
        clips.push({
          asset_path: asset.path,
          trim_start: clip.trimStart,
          trim_end: clip.trimEnd,
          fit_mode: clip.fitMode,
          crop_x: clip.cropRect?.x,
          crop_y: clip.cropRect?.y,
          crop_width: clip.cropRect?.width,
          crop_height: clip.cropRect?.height,
          canvas_width: canvasWidth,
          canvas_height: canvasHeight,
        })
      }
    }
    return clips
  }, [tracks, assets, canvasWidth, canvasHeight])

  const readExportSettings = (): { width: number; height: number; fps: number } | null => {
    const width = Math.round(Number(exportWidth))
    const height = Math.round(Number(exportHeight))
    const fps = Number(exportFps)
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      !Number.isFinite(fps) ||
      width < MIN_EXPORT_SIZE ||
      height < MIN_EXPORT_SIZE ||
      width > MAX_EXPORT_SIZE ||
      height > MAX_EXPORT_SIZE ||
      fps < MIN_EXPORT_FPS ||
      fps > MAX_EXPORT_FPS
    ) {
      return null
    }
    return { width, height, fps }
  }

  const handleExport = async () => {
    if (!outputPath) {
      setErrorMsg('출력 경로를 선택하세요.')
      return
    }
    const exportSettings = readExportSettings()
    if (!exportSettings) {
      setErrorMsg('출력 해상도와 FPS 값을 확인하세요.')
      return
    }
    const clips = buildClips()
    if (clips.length === 0) {
      setErrorMsg('타임라인에 비디오 클립이 없습니다.')
      return
    }
    const payload = buildExportTimelinePayload({
      projectMeta: currentProject ?? fallbackProjectMeta,
      tracks,
      assets,
      canvasWidth,
      canvasHeight,
      settings: exportSettings,
    })

    setStatus('running')
    setProgress(0)
    setErrorMsg('')

    // 이전 리스너 정리
    for (const fn of unlistenersRef.current) fn()
    unlistenersRef.current = []

    // FFmpeg 이벤트 구독
    let cancelled = false
    ;(async () => {
      const unProgress = await tauriListen<FfmpegProgress>('ffmpeg-progress', (e) => {
        setProgress(Math.round(e.payload.percent))
      })
      if (cancelled) {
        unProgress()
        return
      }
      unlistenersRef.current.push(unProgress)

      const unDone = await tauriListen<void>('ffmpeg-done', () => {
        setStatus('done')
        setProgress(100)
      })
      if (cancelled) {
        unDone()
        return
      }
      unlistenersRef.current.push(unDone)

      const unError = await tauriListen<string>('ffmpeg-error', (e) => {
        setStatus('error')
        setErrorMsg(e.payload ?? 'FFmpeg 오류가 발생했습니다.')
      })
      if (cancelled) {
        unError()
        return
      }
      unlistenersRef.current.push(unError)
    })()

    try {
      await tauriInvoke('ffmpeg_export', { outputPath, payload })
    } catch (err) {
      if (!cancelled) {
        cancelled = true
        setStatus('error')
        setErrorMsg(err instanceof Error ? err.message : String(err))
      }
    } finally {
      cancelled = true
    }
  }

  const handleClose = () => {
    if (status === 'running') return // 인코딩 중 닫기 방지
    for (const fn of unlistenersRef.current) fn()
    unlistenersRef.current = []
    onClose()
  }

  const clipCount = buildClips().length
  const isRunning = status === 'running'

  return (
    <ResizableDialog
      open={open}
      onClose={handleClose}
      dialogTitle="내보내기 (Export)"
      defaultWidth={480}
      defaultHeight={400}
      minWidth={360}
      minHeight={340}
      storageKey="export-dialog"
    >
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
        {/* 출력 경로 */}
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
          <TextField
            label="출력 파일"
            value={outputPath}
            onChange={(e) => setOutputPath(e.target.value)}
            size="small"
            fullWidth
            placeholder="저장 경로를 선택하세요"
            disabled={isRunning}
            inputProps={{ readOnly: true }}
          />
          <Button
            variant="outlined"
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={handleSelectPath}
            disabled={isRunning}
            sx={{ whiteSpace: 'nowrap', flexShrink: 0, mt: 0.25 }}
          >
            찾아보기
          </Button>
        </Box>

        {/* 클립 요약 */}
        <Typography variant="body2" color="text.secondary">
          비디오 클립 {clipCount}개 내보내기
        </Typography>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.8fr', gap: 1 }}>
          <TextField
            label="Width"
            value={exportWidth}
            onChange={(event) => setExportWidth(event.target.value)}
            type="number"
            size="small"
            disabled={isRunning}
            inputProps={{ min: MIN_EXPORT_SIZE, max: MAX_EXPORT_SIZE, step: 1 }}
          />
          <TextField
            label="Height"
            value={exportHeight}
            onChange={(event) => setExportHeight(event.target.value)}
            type="number"
            size="small"
            disabled={isRunning}
            inputProps={{ min: MIN_EXPORT_SIZE, max: MAX_EXPORT_SIZE, step: 1 }}
          />
          <TextField
            label="FPS"
            value={exportFps}
            onChange={(event) => setExportFps(event.target.value)}
            type="number"
            size="small"
            disabled={isRunning}
            inputProps={{ min: MIN_EXPORT_FPS, max: MAX_EXPORT_FPS, step: 1 }}
          />
        </Box>

        {/* 진행률 */}
        {(isRunning || status === 'done') && (
          <Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 1 }}
              color={status === 'done' ? 'success' : 'primary'}
            />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {status === 'done' ? '완료!' : `${progress}% 처리 중...`}
            </Typography>
          </Box>
        )}

        {/* 오류 메시지 */}
        {status === 'error' && (
          <Alert severity="error" sx={{ py: 0.5 }}>
            {errorMsg}
          </Alert>
        )}

        {/* 입력값 오류 */}
        {status === 'idle' && errorMsg && (
          <Alert severity="warning" sx={{ py: 0.5 }}>
            {errorMsg}
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 2, pb: 2 }}>
        <Button onClick={handleClose} disabled={isRunning} size="small">
          {status === 'done' ? '닫기' : '취소'}
        </Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={isRunning || status === 'done' || !outputPath}
          startIcon={<FileDownloadIcon />}
          size="small"
        >
          {isRunning ? `인코딩 중... ${progress}%` : '내보내기 시작'}
        </Button>
      </DialogActions>
    </ResizableDialog>
  )
}
