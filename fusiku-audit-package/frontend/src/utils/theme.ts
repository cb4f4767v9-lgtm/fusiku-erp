export type ThemeMode = 'light' | 'dark'

const STORAGE_KEY = 'fusiku_theme'

export function getInitialTheme(): ThemeMode {
  try {
    const stored = String(localStorage.getItem(STORAGE_KEY) || '').trim()
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    /* ignore */
  }

  try {
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    return prefersDark ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'dark') root.classList.add('dark')
  else root.classList.remove('dark')
  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    /* ignore */
  }
}

