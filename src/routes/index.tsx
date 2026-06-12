import Box from '@mui/material/Box'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

export const Route = createFileRoute('/')({
  component: EditorPage,
})

const LazyEditorLayout = lazy(() =>
  import('@/components/EditorLayout').then((module) => ({ default: module.EditorLayout }))
)

function EditorPage() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Suspense fallback={<Box sx={{ flex: 1, bgcolor: 'background.default' }} />}>
        <LazyEditorLayout />
      </Suspense>
    </Box>
  )
}
