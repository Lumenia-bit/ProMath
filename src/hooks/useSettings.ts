import { useEffect, useState } from 'react';
import type { AngleMode } from '../math/types';
import { readStorage, writeStorage } from '../utils/storage';

interface Settings { theme: 'light' | 'dark'; angleMode: AngleMode }
function loadSettings(): Settings {
  const raw = readStorage('promath.settings.v1') as Partial<Settings> | null;
  return {
    theme: raw?.theme === 'dark' || raw?.theme === 'light' ? raw.theme
      : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    angleMode: raw?.angleMode === 'RAD' ? 'RAD' : 'DEG',
  };
}
export function useSettings() {
  const [settings, setSettings] = useState(loadSettings);
  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme;
    writeStorage('promath.settings.v1', settings);
  }, [settings]);
  return { ...settings, setTheme: (theme: Settings['theme']) => setSettings(s => ({ ...s, theme })),
    setAngleMode: (angleMode: AngleMode) => setSettings(s => ({ ...s, angleMode })) };
}
