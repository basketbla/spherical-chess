import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ChessSphere, { type AnimatedMove, BACKGROUND_COLOR } from './three/ChessSphere';
import GameUI from './components/GameUI';
import Sidebar from './components/Sidebar';
import SettingsPanel from './components/Settings';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import { useSocket } from './hooks/useSocket';
import { loadSettings, saveSettings, type Settings } from './settings';
import { scenarioFromUrl } from './debugScenarios';
import {
  type Position,
  type Move,
  type GameState,
  GameStatus,
  createInitialGameState,
  getLegalMovesForPiece,
  makeMove as applyLocalMove,
  applyMove,
} from 'spherical-chess-shared';

type Screen = 'lobby' | 'waiting' | 'game';

// Horizontal space the move sidebar occupies (width 220 + right gap 16 + breathing room).
const SIDEBAR_RESERVE = 248;

export default function App() {
  const socket = useSocket();
  // Debug: ?scenario=check|checkmate boots straight into a local game with a
  // preset position (see debugScenarios.ts).
  const debugScenario = useMemo(() => scenarioFromUrl(), []);
  const [screen, setScreen] = useState<Screen>(debugScenario ? 'game' : 'lobby');
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [currentValidMoves, setCurrentValidMoves] = useState<Move[]>([]);
  const [isLocalGame, setIsLocalGame] = useState(!!debugScenario);
  const [localState, setLocalState] = useState<GameState | null>(debugScenario);
  const [settings, setSettings] = useState<Settings>(loadSettings);

  // Which ply we're viewing; null = follow the live position.
  const [viewPly, setViewPly] = useState<number | null>(null);
  // The move to animate when it's freshly played on the live board.
  const [anim, setAnim] = useState<AnimatedMove | null>(null);

  const liveState = isLocalGame ? localState : socket.gameState;
  const playerColor = isLocalGame ? (liveState?.turn ?? null) : socket.playerColor;

  const totalPly = liveState?.moveHistory.length ?? 0;
  const resolvedPly = viewPly === null ? totalPly : Math.min(viewPly, totalPly);
  const viewingLive = resolvedPly >= totalPly;

  // The board shown on screen: the live state, or a replayed past position.
  const displayState = useMemo<GameState | null>(() => {
    if (!liveState) return null;
    if (viewingLive) return liveState;
    let s = createInitialGameState();
    for (let i = 0; i < resolvedPly; i++) s = applyMove(s, liveState.moveHistory[i]);
    return s;
  }, [liveState, viewingLive, resolvedPly]);

  const updateSettings = useCallback((next: Settings) => {
    setSettings(next);
    saveSettings(next);
  }, []);

  // Persist screen transitions for online play.
  useEffect(() => {
    if (socket.room && !socket.gameState) setScreen('waiting');
    if (socket.gameState && socket.gameState.status !== GameStatus.Waiting) setScreen('game');
  }, [socket.room, socket.gameState]);

  // When a new move lands on the live board, queue its animation (if enabled).
  const prevLen = useRef(0);
  useEffect(() => {
    const len = liveState?.moveHistory.length ?? 0;
    if (len > prevLen.current && liveState) {
      const mv = liveState.moveHistory[len - 1];
      if (settings.animate) setAnim({ from: mv.from, to: mv.to, id: len });
    }
    prevLen.current = len;
  }, [liveState, settings.animate]);

  const handleSquareClick = useCallback((pos: Position) => {
    if (!liveState || !viewingLive) return; // no moving while reviewing history

    const piece = liveState.board[pos.file][pos.rank];

    if (selectedSquare && currentValidMoves.some(m => m.to.file === pos.file && m.to.rank === pos.rank)) {
      const move = currentValidMoves.find(m => m.to.file === pos.file && m.to.rank === pos.rank)!;
      if (isLocalGame) {
        const newState = applyLocalMove(liveState, move);
        if (newState) setLocalState(newState);
      } else {
        socket.makeMove(move);
      }
      setSelectedSquare(null);
      setCurrentValidMoves([]);
      return;
    }

    const currentTurn = liveState.turn;
    if (piece && piece.color === currentTurn) {
      if (!isLocalGame && piece.color !== socket.playerColor) return;
      setSelectedSquare(pos);
      setCurrentValidMoves(getLegalMovesForPiece(liveState, pos));
      return;
    }

    setSelectedSquare(null);
    setCurrentValidMoves([]);
  }, [liveState, viewingLive, selectedSquare, currentValidMoves, isLocalGame, socket]);

  const handlePlayLocal = useCallback(() => {
    setIsLocalGame(true);
    setLocalState(createInitialGameState());
    setViewPly(null);
    setScreen('game');
  }, []);

  const handleResign = useCallback(() => {
    if (isLocalGame) {
      setScreen('lobby');
      setIsLocalGame(false);
      setLocalState(null);
    } else {
      socket.resign();
    }
  }, [isLocalGame, socket]);

  // Exit to the main menu from anywhere in a game (including after it's over).
  const handleLeaveGame = useCallback(() => {
    if (isLocalGame) {
      setIsLocalGame(false);
      setLocalState(null);
    } else {
      socket.leaveGame();
    }
    setSelectedSquare(null);
    setCurrentValidMoves([]);
    setViewPly(null);
    setScreen('lobby');
  }, [isLocalGame, socket]);

  if (screen === 'lobby') {
    return (
      <Lobby
        connected={socket.connected}
        onJoinQueue={socket.joinQueue}
        onCreatePrivate={socket.createPrivateGame}
        onJoinPrivate={socket.joinPrivateGame}
        onPlayLocal={handlePlayLocal}
        error={socket.error}
        onClearError={socket.clearError}
      />
    );
  }

  if (screen === 'waiting' && socket.room) {
    return <WaitingRoom room={socket.room} />;
  }

  if (screen === 'game' && displayState && liveState) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative', background: BACKGROUND_COLOR }}>
        {/* Reserve the sidebar's footprint so the sphere centers in the space to
            its left rather than under it. The canvas bg matches the root bg, so
            the reserved strip is seamless. */}
        <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: SIDEBAR_RESERVE }}>
          <ChessSphere
            gameState={displayState}
            playerColor={playerColor}
            validMoves={viewingLive ? currentValidMoves : []}
            selectedSquare={viewingLive ? selectedSquare : null}
            onSquareClick={handleSquareClick}
            quality={settings.quality}
            animatedMove={viewingLive && settings.animate ? anim : null}
            showLabels={settings.showLabels}
          />
        </div>
        <SettingsPanel settings={settings} onChange={updateSettings} onLeaveGame={handleLeaveGame} />
        <GameUI
          gameState={liveState}
          playerColor={isLocalGame ? liveState.turn : playerColor}
          gameOver={isLocalGame
            ? liveState.status === GameStatus.Checkmate || liveState.status === GameStatus.Stalemate
            : socket.gameOver
          }
          opponentDisconnected={isLocalGame ? false : socket.opponentDisconnected}
          onResign={handleResign}
          onLeaveGame={handleLeaveGame}
          reviewing={!viewingLive}
          onReturnToLive={() => setViewPly(null)}
        />
        <Sidebar moves={liveState.moveHistory} ply={resolvedPly} onSetPly={(p) => setViewPly(p >= totalPly ? null : p)} />
      </div>
    );
  }

  // Fallback
  return (
    <Lobby
      connected={socket.connected}
      onJoinQueue={socket.joinQueue}
      onCreatePrivate={socket.createPrivateGame}
      onJoinPrivate={socket.joinPrivateGame}
      onPlayLocal={handlePlayLocal}
      error={socket.error}
      onClearError={socket.clearError}
    />
  );
}
