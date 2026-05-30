// ============================================================
// Spherical Chess - Core Types
// ============================================================

export enum PieceType {
  King = 'K',
  Queen = 'Q',
  Rook = 'R',
  Bishop = 'B',
  Knight = 'N',
  Pawn = 'P',
}

export enum Color {
  White = 'white',
  Black = 'black',
}

export interface Piece {
  type: PieceType;
  color: Color;
  hasMoved: boolean;
}

/** File 0-7 (a-h), Rank 0-7 (1-8) */
export interface Position {
  file: number;
  rank: number;
}

export interface Move {
  from: Position;
  to: Position;
  promotion?: PieceType;
  isCapture?: boolean;
  isCastle?: boolean;
  isEnPassant?: boolean;
  notation?: string;
}

export interface GameState {
  board: (Piece | null)[][];  // board[file][rank]
  turn: Color;
  moveHistory: Move[];
  halfMoveClock: number;
  fullMoveNumber: number;
  enPassantTarget: Position | null;
  castlingRights: {
    [Color.White]: { kingSide: boolean; queenSide: boolean };
    [Color.Black]: { kingSide: boolean; queenSide: boolean };
  };
  status: GameStatus;
  winner: Color | null;
}

export enum GameStatus {
  Waiting = 'waiting',
  Active = 'active',
  Check = 'check',
  Checkmate = 'checkmate',
  Stalemate = 'stalemate',
  Draw = 'draw',
  Resigned = 'resigned',
}

// Matchmaking / networking types
export interface GameRoom {
  id: string;
  white: string | null;
  black: string | null;
  state: GameState;
  createdAt: number;
}

export interface PlayerInfo {
  id: string;
  name: string;
  rating: number;
}

// Socket event types
export interface ServerToClientEvents {
  gameCreated: (room: GameRoom) => void;
  gameStart: (room: GameRoom) => void;
  gameUpdate: (state: GameState, move: Move) => void;
  gameOver: (state: GameState) => void;
  error: (message: string) => void;
  matchFound: (roomId: string, color: Color) => void;
  opponentDisconnected: () => void;
  opponentReconnected: () => void;
  // Sent to a reconnecting player to restore their in-progress game.
  rejoinedGame: (room: GameRoom, color: Color) => void;
  validMoves: (moves: Move[]) => void;
}

export interface ClientToServerEvents {
  joinQueue: (playerName: string) => void;
  leaveQueue: () => void;
  makeMove: (roomId: string, move: Move) => void;
  resign: (roomId: string) => void;
  requestValidMoves: (roomId: string, position: Position) => void;
  createPrivateGame: (playerName: string) => void;
  joinPrivateGame: (roomId: string, playerName: string) => void;
}
