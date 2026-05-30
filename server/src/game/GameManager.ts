import { v4 as uuidv4 } from 'uuid';
import {
  GameRoom, GameState, GameStatus, Color, Move, Position,
  createInitialGameState, makeMove as applyGameMove,
  getLegalMovesForPiece,
} from 'spherical-chess-shared';

interface InternalRoom extends GameRoom {
  // Seats are bound to persistent player IDs (not socket IDs), so a player can
  // drop their socket and reconnect with a new one without losing their seat.
  whitePlayerId: string | null;
  blackPlayerId: string | null;
}

export class GameManager {
  private rooms = new Map<string, InternalRoom>();
  private playerRooms = new Map<string, string>(); // playerId -> roomId
  // playerId -> current live socketId. Absent means the player is disconnected.
  private liveSockets = new Map<string, string>();

  /** Record (or refresh) the live socket for a player. */
  registerConnection(playerId: string, socketId: string): void {
    this.liveSockets.set(playerId, socketId);
  }

  isConnected(playerId: string): boolean {
    return this.liveSockets.has(playerId);
  }

  /**
   * Mark a player disconnected. Guarded by socketId so a stale disconnect (from
   * an old socket that was already superseded by a reconnect) doesn't clobber
   * the newer live connection. Returns true if this was the current connection.
   */
  markDisconnected(playerId: string, socketId: string): boolean {
    if (this.liveSockets.get(playerId) === socketId) {
      this.liveSockets.delete(playerId);
      return true;
    }
    return false;
  }

  createRoom(playerId: string, playerName: string): GameRoom {
    const id = uuidv4().slice(0, 8);
    const room: InternalRoom = {
      id,
      white: playerName,
      black: null,
      state: createInitialGameState(),
      createdAt: Date.now(),
      whitePlayerId: playerId,
      blackPlayerId: null,
    };
    room.state.status = GameStatus.Waiting;
    this.rooms.set(id, room);
    this.playerRooms.set(playerId, id);
    return this.toPublicRoom(room);
  }

  joinRoom(roomId: string, playerId: string, playerName: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    if (!room || room.blackPlayerId) return null;
    // Don't let the creator take both seats.
    if (room.whitePlayerId === playerId) return null;

    room.black = playerName;
    room.blackPlayerId = playerId;
    room.state.status = GameStatus.Active;
    this.playerRooms.set(playerId, roomId);

    return this.toPublicRoom(room);
  }

  createMatchedRoom(
    whitePlayerId: string,
    whiteName: string,
    blackPlayerId: string,
    blackName: string,
  ): GameRoom {
    const id = uuidv4().slice(0, 8);
    const room: InternalRoom = {
      id,
      white: whiteName,
      black: blackName,
      state: createInitialGameState(),
      createdAt: Date.now(),
      whitePlayerId,
      blackPlayerId,
    };
    this.rooms.set(id, room);
    this.playerRooms.set(whitePlayerId, id);
    this.playerRooms.set(blackPlayerId, id);
    return this.toPublicRoom(room);
  }

  makeMove(
    roomId: string,
    playerId: string,
    move: Move,
  ): { state: GameState; move: Move } | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    // Verify it's this player's turn
    const playerColor = this.getPlayerColor(room, playerId);
    if (!playerColor || playerColor !== room.state.turn) return null;

    const newState = applyGameMove(room.state, move);
    if (!newState) return null;

    room.state = newState;
    return { state: newState, move };
  }

  getValidMoves(roomId: string, playerId: string, position: Position): Move[] {
    const room = this.rooms.get(roomId);
    if (!room) return [];

    const playerColor = this.getPlayerColor(room, playerId);
    if (!playerColor || playerColor !== room.state.turn) return [];

    return getLegalMovesForPiece(room.state, position);
  }

  resign(roomId: string, playerId: string): GameState | null {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    const playerColor = this.getPlayerColor(room, playerId);
    if (!playerColor) return null;
    // Don't re-end an already-finished game.
    if (this.isFinished(room.state.status)) return null;

    room.state.status = GameStatus.Resigned;
    room.state.winner = playerColor === Color.White ? Color.Black : Color.White;
    return room.state;
  }

  getPlayerRoom(playerId: string): string | undefined {
    return this.playerRooms.get(playerId);
  }

  /** The room (public view) + seat color for a reconnecting player, if any. */
  getRejoinInfo(playerId: string): { room: GameRoom; color: Color } | null {
    const roomId = this.playerRooms.get(playerId);
    if (!roomId) return null;
    const room = this.rooms.get(roomId);
    if (!room) return null;
    const color = this.getPlayerColor(room, playerId);
    if (!color) return null;
    return { room: this.toPublicRoom(room), color };
  }

  isRoomActive(roomId: string): boolean {
    const room = this.rooms.get(roomId);
    return !!room && !this.isFinished(room.state.status);
  }

  /** Clean up a player's room association after their game is finished. */
  cleanupIfFinished(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room || !this.isFinished(room.state.status)) return;
    const whiteGone = !room.whitePlayerId || !this.liveSockets.has(room.whitePlayerId);
    const blackGone = !room.blackPlayerId || !this.liveSockets.has(room.blackPlayerId);
    if (whiteGone && blackGone) {
      if (room.whitePlayerId) this.playerRooms.delete(room.whitePlayerId);
      if (room.blackPlayerId) this.playerRooms.delete(room.blackPlayerId);
      this.rooms.delete(roomId);
    }
  }

  getActiveGameCount(): number {
    return this.rooms.size;
  }

  getActiveGames(): { id: string; players: number; status: string }[] {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      players:
        (room.whitePlayerId && this.liveSockets.has(room.whitePlayerId) ? 1 : 0) +
        (room.blackPlayerId && this.liveSockets.has(room.blackPlayerId) ? 1 : 0),
      status: room.state.status,
    }));
  }

  private isFinished(status: GameStatus): boolean {
    return (
      status === GameStatus.Checkmate ||
      status === GameStatus.Stalemate ||
      status === GameStatus.Draw ||
      status === GameStatus.Resigned
    );
  }

  private getPlayerColor(room: InternalRoom, playerId: string): Color | null {
    if (room.whitePlayerId === playerId) return Color.White;
    if (room.blackPlayerId === playerId) return Color.Black;
    return null;
  }

  private toPublicRoom(room: InternalRoom): GameRoom {
    return {
      id: room.id,
      white: room.white,
      black: room.black,
      state: room.state,
      createdAt: room.createdAt,
    };
  }
}
