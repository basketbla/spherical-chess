import type { Quality } from './three/ChessSphere';

export interface Settings {
  quality: Quality;
  animate: boolean;
  showLabels: boolean;
}

const KEY = 'spherical-chess-settings';

export const DEFAULT_SETTINGS: Settings = {
  // High-quality pieces by default everywhere; users can drop to "fast" in
  // settings if performance is poor.
  quality: 'high',
  animate: true,
  showLabels: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw);
    return {
      quality: parsed.quality === 'fast' || parsed.quality === 'high' ? parsed.quality : DEFAULT_SETTINGS.quality,
      animate: typeof parsed.animate === 'boolean' ? parsed.animate : DEFAULT_SETTINGS.animate,
      showLabels: typeof parsed.showLabels === 'boolean' ? parsed.showLabels : DEFAULT_SETTINGS.showLabels,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
