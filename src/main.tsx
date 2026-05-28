import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLoader } from './components/AppLoader'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2196f3' },
    background: {
      default: '#1a1a1a',
      paper: '#242424',
    },
  },
})

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppLoader>
        <RouterProvider router={router} />
      </AppLoader>
    </ThemeProvider>
  </React.StrictMode>
)
