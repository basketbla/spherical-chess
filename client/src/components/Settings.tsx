import React, { useState } from 'react';
import type { Settings } from '../settings';

interface SettingsButtonProps {
  settings: Settings;
  onChange: (next: Settings) => void;
  onLeaveGame: () => void;
}

/** A gear button that opens a small settings popover. */
export default function SettingsPanel({ settings, onChange, onLeaveGame }: SettingsButtonProps) {
  const [open, setOpen] = useState(false);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    onChange({ ...settings, [key]: value });

  return (
    <div style={{ position: 'absolute', left: 16, bottom: 16, zIndex: 120 }}>
      {open && (
        <div className="panel" style={{ position: 'absolute', bottom: 44, left: 0, width: 230, padding: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>Settings</div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Piece detail</div>
            <div className="segmented">
              <button className={settings.quality === 'fast' ? 'is-active' : ''} onClick={() => set('quality', 'fast')}>Fast</button>
              <button className={settings.quality === 'high' ? 'is-active' : ''} onClick={() => set('quality', 'high')}>High</button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 6 }}>
              High loads detailed 3D models (~4MB).
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Move animation</div>
            <div className="segmented">
              <button className={settings.animate ? 'is-active' : ''} onClick={() => set('animate', true)}>On</button>
              <button className={!settings.animate ? 'is-active' : ''} onClick={() => set('animate', false)}>Off</button>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, marginBottom: 8 }}>Rank / file labels</div>
            <div className="segmented">
              <button className={settings.showLabels ? 'is-active' : ''} onClick={() => set('showLabels', true)}>On</button>
              <button className={!settings.showLabels ? 'is-active' : ''} onClick={() => set('showLabels', false)}>Off</button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line)', marginTop: 16, paddingTop: 14 }}>
            <button
              className="btn btn--outline btn--sm btn--block"
              onClick={() => { setOpen(false); onLeaveGame(); }}
            >
              Leave game
            </button>
          </div>
        </div>
      )}

      <button className="icon-btn" title="Settings" onClick={() => setOpen((o) => !o)} aria-label="Settings">
        {/* gear glyph */}
        ⚙
      </button>
    </div>
  );
}
