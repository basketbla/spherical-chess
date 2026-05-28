import React from 'react';
import type { GameRoom } from 'spherical-chess-shared';

interface WaitingRoomProps {
  room: GameRoom;
}

export default function WaitingRoom({ room }: WaitingRoomProps) {
  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', color: 'var(--text)',
    }}>
      <h2 style={{ marginBottom: 24, fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 30, color: '#f3eee2' }}>
        Waiting for opponent…
      </h2>
      <div className="panel" style={{ padding: '22px 44px', textAlign: 'center' }}>
        <p className="eyebrow" style={{ margin: '0 0 10px' }}>Share this room code</p>
        <p style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6, color: 'var(--gold)', margin: 0, fontFamily: 'monospace' }}>
          {room.id}
        </p>
      </div>
      <div style={{
        marginTop: 26, width: 30, height: 30,
        border: '2px solid rgba(201,167,106,0.25)', borderTopColor: 'var(--gold)',
        borderRadius: '50%', animation: 'spin 0.9s linear infinite',
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
