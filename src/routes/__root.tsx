import { buildProjectJson } from '@/lib/projectSerialization'
import type { ProjectMeta } from '@/store/projectStore'
import { saveProjectFile } from '@/store/projectStore'
import Box from '@mui/material/Box'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Suspense, lazy, useCallback, useState } from 'react'

export const Route = createRootRoute({
  component: RootLayout,
})

const LazyGlobalAppBar = lazy(() =>
  import('@/components/app/GlobalAppBar').then((module) => ({ default: module.GlobalAppBar }))
)
const LazyExportDialog = lazy(() =>
  import('@/components/preview/ExportDialog').then((module) => ({ default: module.ExportDialog }))
)
const LazyNewProjectDialog = lazy(() =>
  import('@/components/project/NewProjectDialog').then((module) => ({
    default: module.NewProjectDialog,
  }))
)

function RootLayout() {
  const [exportOpen, setExportOpen] = useState(false)
  const [newProjectOpen, setNewProjectOpen] = useState(false)

  const handleProjectCreated = useCallback(async (meta: ProjectMeta) => {
    if (meta.filePath) {
      await saveProjectFile(meta.filePath, buildProjectJson())
    }
  }, [])

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Suspense fallback={<Box sx={{ height: 40, flexShrink: 0, bgcolor: 'primary.main' }} />}>
        <LazyGlobalAppBar
          onExport={() => setExportOpen(true)}
          onNewProject={() => setNewProjectOpen(true)}
        />
      </Suspense>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Outlet />
      </Box>
      <Suspense fallback={null}>
        {exportOpen ? (
          <LazyExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
        ) : null}
        {newProjectOpen ? (
          <LazyNewProjectDialog
            open={newProjectOpen}
            onClose={() => setNewProjectOpen(false)}
            onCreated={handleProjectCreated}
          />
        ) : null}
      </Suspense>
    </Box>
  )
}
