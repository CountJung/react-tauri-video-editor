import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

/** 에셋 패널 — 파일 임포트 및 목록 표시 (Phase 1) */
export function AssetPanel() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', p: 1 }}>
      <Typography variant="caption" sx={{ mb: 1, color: 'text.secondary', fontWeight: 'bold' }}>
        ASSETS
      </Typography>
      <Box
        sx={{
          flex: 1,
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Typography variant="body2" color="text.secondary">
          파일을 여기에 드롭
        </Typography>
      </Box>
    </Box>
  )
}
