import { STORAGE_KEYS } from '@/lib/storageKeys'
import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light' | 'system'

interface SettingsState {
  themeMode: ThemeMode
}

interface SettingsActions {
  setThemeMode: (mode: ThemeMode) => void
}

function readStoredThemeMode(): ThemeMode {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS_THEME_MODE)
    if (raw !== null) {
      const val = JSON.parse(raw) as string
      if (val === 'dark' || val === 'light' || val === 'system') return val
    }
  } catch {
    // ignore
  }
  const envVal = import.meta.env.VITE_THEME_MODE as string | undefined
  if (envVal === 'dark' || envVal === 'light' || envVal === 'system') return envVal
  return 'dark'
}

export const useSettingsStore = create<SettingsState & SettingsActions>((set) => ({
  themeMode: readStoredThemeMode(),

  setThemeMode: (themeMode) => {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS_THEME_MODE, JSON.stringify(themeMode))
    } catch {
      // ignore
    }
    set({ themeMode })
  },
}))
