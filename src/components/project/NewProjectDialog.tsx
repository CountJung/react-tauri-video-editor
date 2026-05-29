import {
  CANVAS_PRESETS,
  type CanvasPreset,
  type ProjectMeta,
  useProjectStore,
} from '@/store/projectStore'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControl from '@mui/material/FormControl'
import FormControlLabel from '@mui/material/FormControlLabel'
import FormHelperText from '@mui/material/FormHelperText'
import FormLabel from '@mui/material/FormLabel'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { save as tauriSave } from '@tauri-apps/plugin-dialog'
import { useCallback, useEffect, useState } from 'react'
import { ResizableDialog } from '../common/ResizableDialog'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: (meta: ProjectMeta) => void
}

export function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const createProject = useProjectStore((s) => s.createProject)

  const [name, setName] = useState('새 프로젝트')
  const [preset, setPreset] = useState<CanvasPreset>('1080p_16:9')
  const [customW, setCustomW] = useState(1920)
  const [customH, setCustomH] = useState(1080)
  const [saveDir, setSaveDir] = useState<string>('')
  const [nameError, setNameError] = useState('')

  useEffect(() => {
    if (open) {
      setName('새 프로젝트')
      setPreset('1080p_16:9')
      setCustomW(1920)
      setCustomH(1080)
      setSaveDir('')
      setNameError('')
    }
  }, [open])

  const handleSelectDir = useCallback(async () => {
    const path = await tauriSave({
      defaultPath: `${name}.vedproj`,
      filters: [{ name: '비디오 에디터 프로젝트', extensions: ['vedproj'] }],
    })
    if (path) setSaveDir(path as string)
  }, [name])

  const handleCreate = useCallback(() => {
    const trimmed = name.trim()
    if (!trimmed) {
      setNameError('프로젝트 이름을 입력하세요.')
      return
    }
    const meta = createProject(trimmed, preset, customW, customH)
    // saveDir가 있으면 filePath 즉시 설정 (저장은 onCreated 후 처리)
    if (saveDir) {
      useProjectStore.getState().updateProjectMeta({})
      const patchedMeta: ProjectMeta = { ...meta, filePath: saveDir }
      useProjectStore.setState({ currentProject: patchedMeta })
      onCreated(patchedMeta)
    } else {
      onCreated(meta)
    }
    onClose()
  }, [name, preset, customW, customH, saveDir, createProject, onCreated, onClose])

  const selectedPresetDef = CANVAS_PRESETS.find((p) => p.id === preset)

  return (
    <ResizableDialog
      open={open}
      onClose={onClose}
      dialogTitle="새 프로젝트"
      defaultWidth={480}
      defaultHeight={520}
      minWidth={380}
      minHeight={420}
      storageKey="dialog:new-project"
    >
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 2.5,
          p: 2,
          height: '100%',
          overflowY: 'auto',
        }}
      >
        {/* 프로젝트 이름 */}
        <TextField
          label="프로젝트 이름"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setNameError('')
          }}
          error={!!nameError}
          helperText={nameError}
          size="small"
          autoFocus
          fullWidth
        />

        {/* 캔버스 프리셋 */}
        <FormControl component="fieldset">
          <FormLabel component="legend" sx={{ fontSize: 13, fontWeight: 600, mb: 0.5 }}>
            캔버스 크기
          </FormLabel>
          <RadioGroup value={preset} onChange={(e) => setPreset(e.target.value as CanvasPreset)}>
            {CANVAS_PRESETS.map((p) => (
              <FormControlLabel
                key={p.id}
                value={p.id}
                control={<Radio size="small" />}
                label={<Typography variant="body2">{p.label}</Typography>}
              />
            ))}
          </RadioGroup>
        </FormControl>

        {/* 커스텀 크기 입력 */}
        {preset === 'custom' && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              label="너비 (px)"
              type="number"
              value={customW}
              onChange={(e) => setCustomW(Math.max(1, Number(e.target.value)))}
              size="small"
              inputProps={{ min: 1, max: 7680 }}
              sx={{ flex: 1 }}
            />
            <TextField
              label="높이 (px)"
              type="number"
              value={customH}
              onChange={(e) => setCustomH(Math.max(1, Number(e.target.value)))}
              size="small"
              inputProps={{ min: 1, max: 4320 }}
              sx={{ flex: 1 }}
            />
          </Box>
        )}

        {/* 미리보기 */}
        {selectedPresetDef && (
          <FormHelperText>
            출력 해상도:{' '}
            {preset === 'custom'
              ? `${customW}×${customH}`
              : `${selectedPresetDef.width}×${selectedPresetDef.height}`}
          </FormHelperText>
        )}

        {/* 저장 위치 */}
        <TextField
          label="저장 위치 (선택)"
          value={saveDir}
          size="small"
          placeholder="나중에 저장 위치를 지정할 수 있습니다"
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  size="small"
                  onClick={handleSelectDir}
                  edge="end"
                  aria-label="저장 위치 선택"
                >
                  <FolderOpenIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
          fullWidth
        />

        {/* 버튼 */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 'auto' }}>
          <Button variant="outlined" size="small" onClick={onClose}>
            취소
          </Button>
          <Button variant="contained" size="small" onClick={handleCreate}>
            만들기
          </Button>
        </Box>
      </Box>
    </ResizableDialog>
  )
}
