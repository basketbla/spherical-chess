import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GameManager } from './game/GameManager.js';
import { Matchmaker } from './matchmaking/Matchmaker.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  Move,
  Position,
  Color,
} from 'spherical-chess-shared';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3001;

const app = express();
app.use(cors());
app.use(express.json());

// Serve client static files in production
const clientDist = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDist));

const httpServer = createServer(app);
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const gameManager = new GameManager();
const matchmaker = new Matchmaker(gameManager, io);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', games: gameManager.getActiveGameCount() });
});

// List active games
app.get('/api/games', (_req, res) => {
  res.json(gameManager.getActiveGames());
});

// How long a disconnected player has to reconnect before they forfeit.
const DISCONNECT_GRACE_MS = 60_000;

io.on('connection', (socket) => {
  // Stable, client-supplied identity (persisted in the client's localStorage).
  // Falls back to socket.id for older clients that don't send one.
  const playerId: string =
    (socket.handshake.auth?.playerId as string | undefined) || socket.id;

  console.log(`Player connected: socket=${socket.id} player=${playerId}`);
  gameManager.registerConnection(playerId, socket.id);

  // If this player is already seated in a game, restore it (reconnection).
  const rejoin = gameManager.getRejoinInfo(playerId);
  if (rejoin) {
    socket.join(rejoin.room.id);
    socket.emit('rejoinedGame', rejoin.room, rejoin.color);
    socket.to(rejoin.room.id).emit('opponentReconnected');
  }

  socket.on('joinQueue', (playerName: string) => {
    matchmaker.addToQueue(socket, playerId, playerName);
  });

  socket.on('leaveQueue', () => {
    matchmaker.removeFromQueue(playerId);
  });

  socket.on('createPrivateGame', (playerName: string) => {
    const room = gameManager.createRoom(playerId, playerName);
    socket.join(room.id);
    socket.emit('gameCreated', room);
  });

  socket.on('joinPrivateGame', (roomId: string, playerName: string) => {
    const room = gameManager.joinRoom(roomId, playerId, playerName);
    if (!room) {
      socket.emit('error', 'Game not found or full');
      return;
    }
    socket.join(roomId);
    // The joiner of a private game is always black (creator is white).
    socket.emit('matchFound', roomId, 'black' as Color);
    io.to(roomId).emit('gameStart', room);
  });

  socket.on('makeMove', (roomId: string, move: Move) => {
    const result = gameManager.makeMove(roomId, playerId, move);
    if (!result) {
      socket.emit('error', 'Invalid move');
      return;
    }
    io.to(roomId).emit('gameUpdate', result.state, result.move);
    if (result.state.status === 'checkmate' || result.state.status === 'stalemate' || result.state.status === 'draw') {
      io.to(roomId).emit('gameOver', result.state);
    }
  });

  socket.on('requestValidMoves', (roomId: string, position: Position) => {
    const moves = gameManager.getValidMoves(roomId, playerId, position);
    socket.emit('validMoves', moves);
  });

  socket.on('resign', (roomId: string) => {
    const result = gameManager.resign(roomId, playerId);
    if (result) {
      io.to(roomId).emit('gameOver', result);
      gameManager.cleanupIfFinished(roomId);
    }
  });

  socket.on('disconnect', () => {
    console.log(`Player disconnected: socket=${socket.id} player=${playerId}`);
    // Only act if this is the player's current connection (guards against a
    // stale socket's disconnect firing after a fresh reconnect).
    const wasCurrent = gameManager.markDisconnected(playerId, socket.id);
    if (!wasCurrent) return;

    matchmaker.removeFromQueue(playerId);

    const roomId = gameManager.getPlayerRoom(playerId);
    if (roomId && gameManager.isRoomActive(roomId)) {
      io.to(roomId).emit('opponentDisconnected');
      // Grace period: forfeit only if they haven't reconnected by the deadline.
      setTimeout(() => {
        if (gameManager.isConnected(playerId)) return; // reconnected — no forfeit
        const result = gameManager.resign(roomId, playerId);
        if (result) {
          io.to(roomId).emit('gameOver', result);
          gameManager.cleanupIfFinished(roomId);
        }
      }, DISCONNECT_GRACE_MS);
    } else if (roomId) {
      gameManager.cleanupIfFinished(roomId);
    }
  });
});

// SPA fallback — serve index.html for non-API routes
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

httpServer.listen(PORT, () => {
  console.log(`Spherical Chess server running on port ${PORT}`);
});
