import React from 'react';
import type { GameState, Color } from 'spherical-chess-shared';

interface GameUIProps {
  gameState: GameState;
  playerColor: Color | null;
  gameOver: boolean;
  opponentDisconnected: boolean;
  onResign: () => void;
  reviewing: boolean;
  onReturnToLive: () => void;
}

function getStatusText(state: GameState, playerColor: Color | null): string {
  switch (state.status) {
    case 'checkmate':
      return state.winner === playerColor ? 'Checkmate — you win!' : 'Checkmate — you lose!';
    case 'stalemate':
      return 'Stalemate — draw!';
    case 'draw':
      return 'Draw!';
    case 'resigned':
      return state.winner === playerColor ? 'Opponent resigned — you win!' : 'You resigned';
    case 'check':
      return state.turn === playerColor ? 'You are in check!' : 'Opponent is in check';
    case 'active':
      return state.turn === playerColor ? 'Your turn' : "Opponent's turn";
    case 'waiting':
      return 'Waiting for opponent…';
    default:
      return '';
  }
}

export default function GameUI({
  gameState, playerColor, gameOver, opponentDisconnected, onResign, reviewing, onReturnToLive,
}: GameUIProps) {
  const isMyTurn = gameState.turn === playerColor;
  const statusText = getStatusText(gameState, playerColor);

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0, padding: '14px 16px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
      pointerEvents: 'none', zIndex: 100,
    }}>
      <div style={{ pointerEvents: 'auto' }}>
        <h2 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontSize: 24, fontWeight: 600, color: '#f3eee2' }}>
          Spherical Chess
        </h2>
        <div style={{ marginTop: 4, fontSize: 13, color: isMyTurn ? 'var(--green)' : 'var(--text-dim)', fontWeight: isMyTurn ? 600 : 400 }}>
          {statusText}
        </div>
        {opponentDisconnected && (
          <div style={{ color: 'var(--danger-bright)', fontSize: 13, marginTop: 4 }}>Opponent disconnected</div>
        )}
        {reviewing && (
          <button className="btn btn--outline btn--sm" style={{ marginTop: 8 }} onClick={onReturnToLive}>
            ⏴ Reviewing history — return to live
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', pointerEvents: 'auto' }}>
        <div style={{
          padding: '5px 12px', borderRadius: 'var(--radius-sm)', fontSize: 12, letterSpacing: 0.4,
          border: '1px solid var(--line-strong)',
          background: playerColor === 'white' ? 'rgba(239,231,212,0.9)' : 'rgba(40,36,30,0.9)',
          color: playerColor === 'white' ? '#222' : '#ece6d8',
        }}>
          Playing {playerColor}
        </div>
        {!gameOver && (
          <button className="btn btn--danger btn--sm" onClick={onResign}>Resign</button>
        )}
      </div>
    </div>
  );
}
