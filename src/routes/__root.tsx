import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import SettingsIcon from '@mui/icons-material/Settings'
import AppBar from '@mui/material/AppBar'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import { Outlet, createRootRoute, useNavigate, useRouterState } from '@tanstack/react-router'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <GlobalAppBar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Outlet />
      </Box>
    </Box>
  )
}

function GlobalAppBar() {
  const navigate = useNavigate()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isSettings = pathname === '/settings'

  return (
    <AppBar
      position="static"
      elevation={0}
      sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider', zIndex: 20 }}
    >
      <Toolbar variant="dense" sx={{ minHeight: 40, gap: 0.5 }}>
        {isSettings && (
          <IconButton
            size="small"
            onClick={() => navigate({ to: '/' })}
            sx={{ mr: 0.5 }}
            aria-label="뒤로가기"
          >
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700, fontSize: 13 }}>
          {isSettings ? '설정' : '🎬 Video Editor'}
        </Typography>
        {!isSettings && (
          <IconButton
            size="small"
            onClick={() => navigate({ to: '/settings' })}
            aria-label="설정 열기"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        )}
      </Toolbar>
    </AppBar>
  )
}
