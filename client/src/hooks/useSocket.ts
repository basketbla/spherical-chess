import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  GameStatus,
  type ClientToServerEvents,
  type ServerToClientEvents,
  type GameRoom,
  type GameState,
  type Color,
  type Move,
  type Position,
} from 'spherical-chess-shared';
import { getPlayerId } from '../identity';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export interface UseSocketReturn {
  connected: boolean;
  room: GameRoom | null;
  gameState: GameState | null;
  playerColor: Color | null;
  validMoves: Move[];
  error: string | null;
  gameOver: boolean;
  opponentDisconnected: boolean;
  joinQueue: (name: string) => void;
  leaveQueue: () => void;
  createPrivateGame: (name: string) => void;
  joinPrivateGame: (roomId: string, name: string) => void;
  makeMove: (move: Move) => void;
  requestValidMoves: (position: Position) => void;
  resign: () => void;
  clearError: () => void;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<GameSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<GameRoom | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [validMoves, setValidMoves] = useState<Move[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  useEffect(() => {
    const serverUrl = import.meta.env.VITE_SERVER_URL || window.location.origin;
    // Pass our persistent player id in the handshake so the server can bind our
    // game seat to it and let us reconnect into an in-progress game.
    const socket: GameSocket = io(serverUrl, { auth: { playerId: getPlayerId() } });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('gameCreated', (newRoom: GameRoom) => {
      setRoom(newRoom);
    });

    socket.on('matchFound', (roomId: string, color: Color) => {
      setPlayerColor(color);
    });

    socket.on('gameStart', (newRoom: GameRoom) => {
      setRoom(newRoom);
      setGameState(newRoom.state);
      setGameOver(false);
      setOpponentDisconnected(false);
      // If color wasn't set by matchFound (private game), determine from room
      if (!playerColor) {
        // The creator is always white in private games
        setPlayerColor('white' as Color);
      }
    });

    socket.on('gameUpdate', (state: GameState, _move: Move) => {
      setGameState(state);
      setValidMoves([]);
    });

    socket.on('gameOver', (state: GameState) => {
      setGameState(state);
      setGameOver(true);
    });

    socket.on('validMoves', (moves: Move[]) => {
      setValidMoves(moves);
    });

    socket.on('error', (message: string) => {
      setError(message);
    });

    socket.on('opponentDisconnected', () => {
      setOpponentDisconnected(true);
    });

    socket.on('opponentReconnected', () => {
      setOpponentDisconnected(false);
    });

    // Reconnected into an in-progress game (new socket, same player id).
    socket.on('rejoinedGame', (rejoinedRoom: GameRoom, color: Color) => {
      setRoom(rejoinedRoom);
      setGameState(rejoinedRoom.state);
      setPlayerColor(color);
      setOpponentDisconnected(false);
      const status = rejoinedRoom.state.status;
      setGameOver(
        status === GameStatus.Checkmate ||
        status === GameStatus.Stalemate ||
        status === GameStatus.Draw ||
        status === GameStatus.Resigned,
      );
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinQueue = useCallback((name: string) => {
    socketRef.current?.emit('joinQueue', name);
  }, []);

  const leaveQueue = useCallback(() => {
    socketRef.current?.emit('leaveQueue');
  }, []);

  const createPrivateGame = useCallback((name: string) => {
    socketRef.current?.emit('createPrivateGame', name);
  }, []);

  const joinPrivateGame = useCallback((roomId: string, name: string) => {
    socketRef.current?.emit('joinPrivateGame', roomId, name);
  }, []);

  const makeMove = useCallback((move: Move) => {
    if (room) {
      socketRef.current?.emit('makeMove', room.id, move);
    }
  }, [room]);

  const requestValidMoves = useCallback((position: Position) => {
    if (room) {
      socketRef.current?.emit('requestValidMoves', room.id, position);
    }
  }, [room]);

  const resign = useCallback(() => {
    if (room) {
      socketRef.current?.emit('resign', room.id);
    }
  }, [room]);

  const clearError = useCallback(() => setError(null), []);

  return {
    connected,
    room,
    gameState,
    playerColor,
    validMoves,
    error,
    gameOver,
    opponentDisconnected,
    joinQueue,
    leaveQueue,
    createPrivateGame,
    joinPrivateGame,
    makeMove,
    requestValidMoves,
    resign,
    clearError,
  };
}
