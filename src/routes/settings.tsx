import Box from '@mui/material/Box'
import { createFileRoute } from '@tanstack/react-router'
import { Suspense, lazy } from 'react'

export const Route = createFileRoute('/settings')({
  component: SettingsRoutePage,
})

const LazySettingsPage = lazy(() =>
  import('@/components/settings/SettingsPage').then((module) => ({
    default: module.SettingsPage,
  }))
)

function SettingsRoutePage() {
  return (
    <Suspense fallback={<Box sx={{ flex: 1, bgcolor: 'background.default' }} />}>
      <LazySettingsPage />
    </Suspense>
  )
}
