'use client';

import { useEffect, useState } from 'react';
import { MoonIcon, SunIcon } from './ui/Icons';

export const THEME_STORAGE_KEY = 'ukaf-theme';

/**
 * Blocking script injected into <head> so the theme class is set before the
 * page paints — without this, a dark-mode visitor sees a flash of the light
 * theme on every load. Runs before hydration, so it can't use React.
 */
export const themeInitScript = `(function(){try{var t=localStorage.getItem('${THEME_STORAGE_KEY}');var d=t?t==='dark':window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
  localStorage.setItem(THEME_STORAGE_KEY, dark ? 'dark' : 'light');
}

export function ThemeToggle({ className }: { className?: string }) {
  // Starts null so the server-rendered icon matches on hydration; the real
  // state is read from the DOM class the blocking script already set.
  const [isDark, setIsDark] = useState<boolean | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
  }, []);

  return (
    <button
      type="button"
      onClick={() => {
        const next = !(isDark ?? false);
        applyTheme(next);
        setIsDark(next);
      }}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={className ?? 'grid h-9 w-9 place-items-center rounded-lg text-steel-500 hover:bg-steel-100 hover:text-steel-900 dark:text-steel-400 dark:hover:bg-steel-800 dark:hover:text-white'}
    >
      {isDark ? <SunIcon className="text-base" /> : <MoonIcon className="text-base" />}
    </button>
  );
}
