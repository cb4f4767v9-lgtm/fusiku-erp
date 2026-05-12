import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { applyTheme, getInitialTheme, type ThemeMode } from '../../utils/theme';

export function ThemeToggle({
  compact = false,
  variant = 'button',
  className,
}: {
  compact?: boolean;
  variant?: 'button' | 'switch';
  className?: string;
}) {
  const [mode, setMode] = useState<ThemeMode>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(mode);
  }, [mode]);

  const isDark = mode === 'dark';

  if (variant === 'switch') {
    if (compact) {
      return (
        <button
          type="button"
          onClick={() => setMode(isDark ? 'light' : 'dark')}
          className={`group inline-flex h-6 items-center rounded-full bg-white/10 px-1.5 ring-1 ring-white/20 backdrop-blur-2xl transition hover:bg-white/15 ${className ?? ''}`}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          <span
            aria-hidden
            className={`relative h-[22px] w-[38px] shrink-0 rounded-full ring-1 ring-white/20 transition ${
              isDark ? 'bg-indigo-500/70' : 'bg-white/15'
            }`}
          >
            <span
              className={`absolute top-1/2 h-[18px] w-[18px] -translate-y-1/2 rounded-full bg-white shadow transition ${
                isDark ? 'left-[18px]' : 'left-[2px]'
              }`}
            />
            <span className="absolute left-0.5 top-1/2 -translate-y-1/2 text-white/80">
              <Moon size={10} aria-hidden />
            </span>
            <span className="absolute right-0.5 top-1/2 -translate-y-1/2 text-white/80">
              <Sun size={10} aria-hidden />
            </span>
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={() => setMode(isDark ? 'light' : 'dark')}
        className={`group inline-flex items-center rounded-full bg-white/10 px-2.5 py-2 ring-1 ring-white/20 backdrop-blur-2xl transition hover:bg-white/15 ${className ?? ''}`}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Light mode' : 'Dark mode'}
      >
        <span
          aria-hidden
          className={`relative h-6 w-11 rounded-full ring-1 ring-white/20 transition ${
            isDark ? 'bg-indigo-500/70' : 'bg-white/15'
          }`}
        >
          <span
            className={`absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition ${
              isDark ? 'left-[22px]' : 'left-[2px]'
            }`}
          />
          <span className="absolute left-1 top-1/2 -translate-y-1/2 text-white/80">
            <Moon size={12} aria-hidden />
          </span>
          <span className="absolute right-1 top-1/2 -translate-y-1/2 text-white/80">
            <Sun size={12} aria-hidden />
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setMode(isDark ? 'light' : 'dark')}
      className={
        className ||
        (compact
          ? 'inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-slate-900 ring-1 ring-slate-900/10 backdrop-blur-xl transition hover:bg-white/30'
          : 'inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-xs font-semibold text-white/80 ring-1 ring-white/20 backdrop-blur-2xl transition hover:-translate-y-0.5 hover:bg-white/15')
      }
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {isDark ? <Sun size={16} aria-hidden /> : <Moon size={16} aria-hidden />}
      {compact ? null : <span className="hidden sm:inline">{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
