import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { LanguageSwitcher } from '../LanguageSwitcher'
import { ThemeToggle } from './ThemeToggle'
import { applyTheme, getInitialTheme } from '../../utils/theme'

export function AuthShell({
  children,
  overflow = 'hidden',
  /** Login/Signup: theme toggle centered; language stays top-right. Other pages: both top-right. */
  topControls = 'app',
}: {
  children: React.ReactNode
  overflow?: 'hidden' | 'auto' | 'visible'
  topControls?: 'auth' | 'app'
}) {
  const { i18n } = useTranslation()

  useEffect(() => {
    applyTheme(getInitialTheme())
  }, [])

  const isRTL = useMemo(() => {
    const code = (i18n.language || 'en').split('-')[0].toLowerCase()
    return ['ar', 'ur'].includes(code)
  }, [i18n.language])

  return (
    <div
      className={`relative min-h-screen w-full overflow-x-hidden ${
        overflow === 'auto' ? 'overflow-y-auto' : overflow === 'visible' ? 'overflow-visible' : 'overflow-hidden'
      } bg-gradient-to-br from-[#bfe3ff] via-[#cfe9ff] to-[#efe9ff] text-white dark:from-[#0b1025] dark:via-[#111a3a] dark:to-[#2b1b5a]`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-sky-400/35 blur-3xl dark:bg-cyan-400/25" />
        <div className="absolute bottom-[-220px] right-[-160px] h-[680px] w-[680px] rounded-full bg-indigo-500/20 blur-3xl dark:bg-fuchsia-500/25" />
        <div className="absolute top-[22%] left-[-220px] h-[520px] w-[520px] rounded-full bg-cyan-300/30 blur-3xl dark:bg-indigo-500/25" />
      </div>

      {topControls === 'auth' ? (
        <>
          <div className="fixed top-6 left-1/2 z-50 -translate-x-1/2">
            <ThemeToggle variant="switch" />
          </div>
          <div className="fixed top-6 right-8 z-50">
            <LanguageSwitcher />
          </div>
        </>
      ) : (
        <div className="fixed top-6 right-8 z-50 flex items-center gap-3">
          <ThemeToggle variant="switch" />
          <LanguageSwitcher />
        </div>
      )}

      {/* CONTENT */}
      <div className="relative z-10 h-full w-full">
        {children}
      </div>

      {/* Footer — same on every AuthShell page (login, signup, setup, pricing, etc.) */}
      <div className="fixed bottom-4 left-6 z-50 flex items-center gap-2 text-xs text-white opacity-60 transition hover:opacity-100 select-none">
        <img src="/logo-icon.svg" alt="" className="h-4 w-4 shrink-0 opacity-100" aria-hidden />
        <span>Powered by Fusiku</span>
      </div>
    </div>
  )
}