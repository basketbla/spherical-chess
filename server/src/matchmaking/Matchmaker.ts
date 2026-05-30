import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, Color } from 'spherical-chess-shared';
import { GameManager } from '../game/GameManager.js';

interface QueueEntry {
  socket: Socket<ClientToServerEvents, ServerToClientEvents>;
  playerId: string;
  playerName: string;
  joinedAt: number;
}

export class Matchmaker {
  private queue: QueueEntry[] = [];
  private gameManager: GameManager;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private matchInterval: ReturnType<typeof setInterval>;

  constructor(
    gameManager: GameManager,
    io: Server<ClientToServerEvents, ServerToClientEvents>,
  ) {
    this.gameManager = gameManager;
    this.io = io;

    // Try to match players every 2 seconds
    this.matchInterval = setInterval(() => this.tryMatch(), 2000);
  }

  addToQueue(
    socket: Socket<ClientToServerEvents, ServerToClientEvents>,
    playerId: string,
    playerName: string,
  ): void {
    // Remove any existing entry for this player (e.g. a stale socket).
    this.removeFromQueue(playerId);

    this.queue.push({
      socket,
      playerId,
      playerName,
      joinedAt: Date.now(),
    });

    console.log(`${playerName} joined queue (${this.queue.length} waiting)`);
    this.tryMatch();
  }

  removeFromQueue(playerId: string): void {
    this.queue = this.queue.filter(entry => entry.playerId !== playerId);
  }

  private tryMatch(): void {
    while (this.queue.length >= 2) {
      const player1 = this.queue.shift()!;
      const player2 = this.queue.shift()!;

      // Randomly assign colors
      const whiteFirst = Math.random() < 0.5;
      const white = whiteFirst ? player1 : player2;
      const black = whiteFirst ? player2 : player1;

      const room = this.gameManager.createMatchedRoom(
        white.playerId,
        white.playerName,
        black.playerId,
        black.playerName,
      );

      // Both players join the socket room
      white.socket.join(room.id);
      black.socket.join(room.id);

      // Notify both players
      white.socket.emit('matchFound', room.id, 'white' as Color);
      black.socket.emit('matchFound', room.id, 'black' as Color);

      // Send game start to the room
      this.io.to(room.id).emit('gameStart', room);

      console.log(`Match created: ${white.playerName} vs ${black.playerName} (room ${room.id})`);
    }
  }

  destroy(): void {
    clearInterval(this.matchInterval);
  }
}
