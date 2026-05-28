import type { Quality } from './three/ChessSphere';

export interface Settings {
  quality: Quality;
  animate: boolean;
}

const KEY = 'spherical-chess-settings';

/** Lighter pieces on phones / low-core machines, HD elsewhere. */
function defaultQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high';
  const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
  return lowCores || smallScreen ? 'fast' : 'high';
}

export function loadSettings(): Settings {
  const fallback: Settings = { quality: defaultQuality(), animate: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      quality: parsed.quality === 'fast' || parsed.quality === 'high' ? parsed.quality : fallback.quality,
      animate: typeof parsed.animate === 'boolean' ? parsed.animate : fallback.animate,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore quota / private-mode errors */
  }
}
