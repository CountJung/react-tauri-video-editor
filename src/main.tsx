import { RouterProvider, createRouter } from '@tanstack/react-router'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppLoader } from './components/AppLoader'
import { AppThemeProvider } from './components/AppThemeProvider'
import { installTestBridge } from './lib/testBridge'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

installTestBridge()

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <AppThemeProvider>
      <AppLoader>
        <RouterProvider router={router} />
      </AppLoader>
    </AppThemeProvider>
  </React.StrictMode>
)
