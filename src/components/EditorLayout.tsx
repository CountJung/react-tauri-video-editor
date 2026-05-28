import Box from '@mui/material/Box'
import { AssetPanel } from './assets/AssetPanel'
import { PreviewPlayer } from './preview/PreviewPlayer'
import { TimelinePanel } from './timeline/TimelinePanel'

/**
 * 에디터 메인 레이아웃
 *
 * +------------------+-----------------------------+
 * | AssetPanel (좌측) |   PreviewPlayer (우측상)    |
 * |                  +-----------------------------+
 * |                  |   TimelinePanel (우측하)    |
 * +------------------+-----------------------------+
 */
export function EditorLayout() {
  return (
    <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* 좌측: 에셋 패널 */}
      <Box
        sx={{
          width: 240,
          minWidth: 180,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <AssetPanel />
      </Box>

      {/* 우측: 프리뷰 + 타임라인 */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* 프리뷰 */}
        <Box sx={{ flex: '0 0 40%', borderBottom: 1, borderColor: 'divider', overflow: 'hidden' }}>
          <PreviewPlayer />
        </Box>

        {/* 타임라인 */}
        <Box sx={{ flex: 1, overflow: 'hidden' }}>
          <TimelinePanel />
        </Box>
      </Box>
    </Box>
  )
}
