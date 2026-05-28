import { EditorLayout } from '@/components/EditorLayout'
import Box from '@mui/material/Box'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: EditorPage,
})

function EditorPage() {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <EditorLayout />
    </Box>
  )
}
