import React, { useEffect, useRef } from 'react';
import type { Move } from 'spherical-chess-shared';

interface SidebarProps {
  moves: Move[];
  /** Number of plies applied in the currently-viewed position (0..moves.length). */
  ply: number;
  onSetPly: (ply: number) => void;
}

/** Move list with VCR-style navigation through the game's history. */
export default function Sidebar({ moves, ply, onSetPly }: SidebarProps) {
  const total = moves.length;
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active move scrolled into view as you navigate.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [ply]);

  // Group plies into full moves: [whiteMove, blackMove?].
  const rows: { num: number; white?: Move; black?: Move; wPly: number; bPly: number }[] = [];
  for (let i = 0; i < total; i += 2) {
    rows.push({ num: i / 2 + 1, white: moves[i], black: moves[i + 1], wPly: i + 1, bPly: i + 2 });
  }

  const cell = (mv: Move | undefined, atPly: number) => {
    if (!mv) return <span style={{ flex: 1 }} />;
    const active = ply === atPly;
    return (
      <button
        ref={active ? activeRef : undefined}
        onClick={() => onSetPly(atPly)}
        style={{
          flex: 1, textAlign: 'left', appearance: 'none', cursor: 'pointer',
          font: 'inherit', padding: '3px 6px', borderRadius: 3, border: 'none',
          background: active ? 'var(--gold)' : 'transparent',
          color: active ? '#1a150d' : 'var(--text)',
          fontWeight: active ? 600 : 400,
        }}
      >
        {mv.notation || '…'}
      </button>
    );
  };

  return (
    <div className="panel" style={{
      position: 'absolute', right: 16, top: 76, bottom: 16, width: 220, zIndex: 100,
      display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
        <div className="eyebrow">Moves</div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 8px', fontFamily: 'monospace', fontSize: 13 }}>
        {rows.length === 0 && (
          <div style={{ color: 'var(--text-faint)', fontSize: 12, padding: 8 }}>No moves yet</div>
        )}
        {rows.map((row) => (
          <div key={row.num} style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 1 }}>
            <span style={{ width: 22, color: 'var(--text-faint)', fontSize: 12, flexShrink: 0 }}>{row.num}.</span>
            {cell(row.white, row.wPly)}
            {cell(row.black, row.bPly)}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, padding: 10, borderTop: '1px solid var(--line)' }}>
        <button className="icon-btn" title="First" disabled={ply === 0} onClick={() => onSetPly(0)} style={{ flex: 1 }}>⏮</button>
        <button className="icon-btn" title="Previous" disabled={ply === 0} onClick={() => onSetPly(Math.max(0, ply - 1))} style={{ flex: 1 }}>‹</button>
        <button className="icon-btn" title="Next" disabled={ply >= total} onClick={() => onSetPly(Math.min(total, ply + 1))} style={{ flex: 1 }}>›</button>
        <button className="icon-btn" title="Latest" disabled={ply >= total} onClick={() => onSetPly(total)} style={{ flex: 1 }}>⏭</button>
      </div>
    </div>
  );
}
