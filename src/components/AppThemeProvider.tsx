import { useSettingsStore } from '@/store/settingsStore'
import CssBaseline from '@mui/material/CssBaseline'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import { useMemo } from 'react'
import type { ReactNode } from 'react'

interface Props {
  children: ReactNode
}

/**
 * settingsStore의 themeMode에 따라 MUI 테마를 동적으로 적용한다.
 * 'system'은 prefers-color-scheme 미디어 쿼리로 해석한다.
 */
export function AppThemeProvider({ children }: Props) {
  const themeMode = useSettingsStore((s) => s.themeMode)

  const resolvedMode: 'dark' | 'light' =
    themeMode === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : themeMode

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: resolvedMode,
          primary: { main: '#2196f3' },
          background: {
            default: resolvedMode === 'dark' ? '#1a1a1a' : '#f0f0f0',
            paper: resolvedMode === 'dark' ? '#242424' : '#ffffff',
          },
        },
      }),
    [resolvedMode]
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}
