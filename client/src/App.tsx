import React, { useState, useCallback } from 'react';
import ChessSphere, { type Quality } from './three/ChessSphere';
import GameUI, { MoveHistory } from './components/GameUI';
import Lobby from './components/Lobby';
import WaitingRoom from './components/WaitingRoom';
import { useSocket } from './hooks/useSocket';
import {
  type Position,
  type Move,
  type GameState,
  type Color,
  GameStatus,
  createInitialGameState,
  getLegalMovesForPiece,
  makeMove as applyLocalMove,
} from 'spherical-chess-shared';

type Screen = 'lobby' | 'waiting' | 'game';

/** Default to lighter pieces on phones / low-core machines, HD elsewhere. */
function defaultQuality(): Quality {
  if (typeof navigator === 'undefined') return 'high';
  const lowCores = (navigator.hardwareConcurrency ?? 8) <= 4;
  const smallScreen = Math.min(window.innerWidth, window.innerHeight) < 700;
  return lowCores || smallScreen ? 'fast' : 'high';
}

export default function App() {
  const socket = useSocket();
  const [screen, setScreen] = useState<Screen>('lobby');
  const [selectedSquare, setSelectedSquare] = useState<Position | null>(null);
  const [currentValidMoves, setCurrentValidMoves] = useState<Move[]>([]);
  const [isLocalGame, setIsLocalGame] = useState(false);
  const [localState, setLocalState] = useState<GameState | null>(null);
  const [quality, setQuality] = useState<Quality>(defaultQuality);

  const gameState = isLocalGame ? localState : socket.gameState;
  const playerColor = isLocalGame ? (localState?.turn ?? null) : socket.playerColor;

  // Handle socket events to transition screens
  React.useEffect(() => {
    if (socket.room && !socket.gameState) {
      setScreen('waiting');
    }
    if (socket.gameState && socket.gameState.status !== GameStatus.Waiting) {
      setScreen('game');
    }
  }, [socket.room, socket.gameState]);

  const handleSquareClick = useCallback((pos: Position) => {
    if (!gameState) return;

    const piece = gameState.board[pos.file][pos.rank];

    // If we have a selected piece and click a valid move target, make the move
    if (selectedSquare && currentValidMoves.some(m => m.to.file === pos.file && m.to.rank === pos.rank)) {
      const move = currentValidMoves.find(m => m.to.file === pos.file && m.to.rank === pos.rank)!;

      if (isLocalGame) {
        const newState = applyLocalMove(gameState, move);
        if (newState) {
          setLocalState(newState);
        }
      } else {
        socket.makeMove(move);
      }

      setSelectedSquare(null);
      setCurrentValidMoves([]);
      return;
    }

    // If clicking our own piece, select it and show valid moves
    const currentTurn = gameState.turn;
    if (piece && piece.color === currentTurn) {
      // In online mode, only select if it's our turn
      if (!isLocalGame && piece.color !== socket.playerColor) {
        return;
      }

      setSelectedSquare(pos);
      const moves = getLegalMovesForPiece(gameState, pos);
      setCurrentValidMoves(moves);
      return;
    }

    // Clicking empty square or opponent piece without selection - deselect
    setSelectedSquare(null);
    setCurrentValidMoves([]);
  }, [gameState, selectedSquare, currentValidMoves, isLocalGame, socket]);

  const handlePlayLocal = useCallback(() => {
    setIsLocalGame(true);
    setLocalState(createInitialGameState());
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

  if (screen === 'game' && gameState) {
    return (
      <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <ChessSphere
          gameState={gameState}
          playerColor={playerColor}
          validMoves={currentValidMoves}
          selectedSquare={selectedSquare}
          onSquareClick={handleSquareClick}
          quality={quality}
        />
        <button
          onClick={() => setQuality((q) => (q === 'high' ? 'fast' : 'high'))}
          title="Toggle piece detail"
          style={{
            position: 'absolute', left: 16, bottom: 16, zIndex: 100,
            padding: '6px 12px', fontSize: 12, cursor: 'pointer',
            background: 'rgba(20,18,24,0.8)', color: '#ece6d8',
            border: '1px solid rgba(236,230,216,0.2)', borderRadius: 6,
          }}
        >
          Pieces: {quality === 'high' ? 'High' : 'Fast'}
        </button>
        <GameUI
          gameState={gameState}
          playerColor={isLocalGame ? gameState.turn : playerColor}
          gameOver={isLocalGame
            ? gameState.status === GameStatus.Checkmate || gameState.status === GameStatus.Stalemate
            : socket.gameOver
          }
          opponentDisconnected={isLocalGame ? false : socket.opponentDisconnected}
          onResign={handleResign}
        />
        <MoveHistory moves={gameState.moveHistory} />
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
