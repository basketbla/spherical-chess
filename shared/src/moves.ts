// ============================================================
// Spherical Chess - Move Generation & Validation
// ============================================================

import {
  Piece, PieceType, Color, Position, Move, GameState, GameStatus,
} from './types.js';
import {
  wrapFile, wrapPosition, getPiece, cloneGameState, posEqual, posToString,
} from './board.js';

// ---- Directional helpers ----

type Direction = [number, number]; // [fileDelta, rankDelta]

const ROOK_DIRS: Direction[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP_DIRS: Direction[] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const QUEEN_DIRS: Direction[] = [...ROOK_DIRS, ...BISHOP_DIRS];
const KNIGHT_JUMPS: Direction[] = [
  [1, 2], [2, 1], [2, -1], [1, -2],
  [-1, -2], [-2, -1], [-2, 1], [-1, 2],
];
const KING_DIRS: Direction[] = QUEEN_DIRS;

/**
 * Generate sliding moves along a direction, wrapping through poles/files.
 */
function slidingMoves(
  board: (Piece | null)[][],
  from: Position,
  dir: Direction,
  color: Color,
): Position[] {
  const positions: Position[] = [];
  let file = from.file;
  let rank = from.rank;

  let df = dir[0];
  let dr = dir[1];

  for (let step = 0; step < 8; step++) {
    const nextFile = file + df;
    const nextRank = rank + dr;
    const wrapped = wrapPosition(nextFile, nextRank);

    if (!wrapped) break;

    // Prevent infinite loops: if we've returned to the start
    if (posEqual(wrapped, from)) break;

    const piece = getPiece(board, wrapped);
    if (piece) {
      if (piece.color !== color) {
        positions.push(wrapped);
      }
      break; // Blocked
    }

    positions.push(wrapped);

    // If we crossed a pole, the rank direction reverses
    if (nextRank > 7 || nextRank < 0) {
      dr = -dr;
    }

    file = wrapped.file;
    rank = wrapped.rank;
  }

  return positions;
}

/**
 * Generate single-step moves (king, knight) with wrapping.
 */
function stepMoves(
  board: (Piece | null)[][],
  from: Position,
  deltas: Direction[],
  color: Color,
): Position[] {
  const positions: Position[] = [];

  for (const [df, dr] of deltas) {
    const wrapped = wrapPosition(from.file + df, from.rank + dr);
    if (!wrapped) continue;

    const piece = getPiece(board, wrapped);
    if (!piece || piece.color !== color) {
      positions.push(wrapped);
    }
  }

  return positions;
}

/**
 * Generate pawn moves with spherical wrapping.
 */
function pawnMoves(
  board: (Piece | null)[][],
  from: Position,
  color: Color,
  enPassantTarget: Position | null,
): Move[] {
  const moves: Move[] = [];
  const direction = color === Color.White ? 1 : -1;
  const startRank = color === Color.White ? 1 : 6;
  const promoRank = color === Color.White ? 7 : 0;

  // Forward one
  const fwd = wrapPosition(from.file, from.rank + direction);
  if (fwd && !getPiece(board, fwd)) {
    if (fwd.rank === promoRank) {
      for (const promo of [PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]) {
        moves.push({ from, to: fwd, promotion: promo });
      }
    } else {
      moves.push({ from, to: fwd });

      // Forward two from starting rank
      if (from.rank === startRank) {
        const fwd2 = wrapPosition(from.file, from.rank + 2 * direction);
        if (fwd2 && !getPiece(board, fwd2)) {
          moves.push({ from, to: fwd2 });
        }
      }
    }
  }

  // Captures (diagonal)
  for (const df of [-1, 1]) {
    const target = wrapPosition(from.file + df, from.rank + direction);
    if (!target) continue;

    const piece = getPiece(board, target);
    if (piece && piece.color !== color) {
      if (target.rank === promoRank) {
        for (const promo of [PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]) {
          moves.push({ from, to: target, promotion: promo, isCapture: true });
        }
      } else {
        moves.push({ from, to: target, isCapture: true });
      }
    }

    // En passant
    if (enPassantTarget && posEqual(target, enPassantTarget)) {
      moves.push({ from, to: target, isEnPassant: true, isCapture: true });
    }
  }

  return moves;
}

/**
 * Generate all pseudo-legal moves for a piece (doesn't check for leaving king in check).
 */
function pseudoLegalMovesForPiece(
  state: GameState,
  pos: Position,
): Move[] {
  const piece = getPiece(state.board, pos);
  if (!piece) return [];

  const color = piece.color;
  let targetPositions: Position[] = [];
  let moves: Move[] = [];

  switch (piece.type) {
    case PieceType.Rook:
      for (const dir of ROOK_DIRS) {
        targetPositions.push(...slidingMoves(state.board, pos, dir, color));
      }
      break;

    case PieceType.Bishop:
      for (const dir of BISHOP_DIRS) {
        targetPositions.push(...slidingMoves(state.board, pos, dir, color));
      }
      break;

    case PieceType.Queen:
      for (const dir of QUEEN_DIRS) {
        targetPositions.push(...slidingMoves(state.board, pos, dir, color));
      }
      break;

    case PieceType.Knight:
      targetPositions = stepMoves(state.board, pos, KNIGHT_JUMPS, color);
      break;

    case PieceType.King:
      targetPositions = stepMoves(state.board, pos, KING_DIRS, color);
      // Castling
      moves.push(...getCastlingMoves(state, pos, color));
      break;

    case PieceType.Pawn:
      return pawnMoves(state.board, pos, color, state.enPassantTarget);
  }

  for (const to of targetPositions) {
    const captured = getPiece(state.board, to);
    moves.push({
      from: pos,
      to,
      isCapture: captured !== null,
    });
  }

  return moves;
}

/**
 * Generate castling moves. Standard rules apply on the spherical board.
 * Castling only happens along rank 1/8 and wraps through files.
 */
function getCastlingMoves(state: GameState, kingPos: Position, color: Color): Move[] {
  const moves: Move[] = [];
  const rank = color === Color.White ? 0 : 7;
  const rights = state.castlingRights[color];

  if (kingPos.rank !== rank || kingPos.file !== 4) return moves;

  // King side: king moves to g-file (file 6)
  if (rights.kingSide) {
    const rookPos: Position = { file: 7, rank };
    const rook = getPiece(state.board, rookPos);
    if (rook && rook.type === PieceType.Rook && !rook.hasMoved) {
      // Check squares between are empty
      const f = getPiece(state.board, { file: 5, rank });
      const g = getPiece(state.board, { file: 6, rank });
      if (!f && !g) {
        // Check king doesn't pass through check
        if (
          !isSquareAttacked(state.board, { file: 4, rank }, color) &&
          !isSquareAttacked(state.board, { file: 5, rank }, color) &&
          !isSquareAttacked(state.board, { file: 6, rank }, color)
        ) {
          moves.push({ from: kingPos, to: { file: 6, rank }, isCastle: true });
        }
      }
    }
  }

  // Queen side: king moves to c-file (file 2)
  if (rights.queenSide) {
    const rookPos: Position = { file: 0, rank };
    const rook = getPiece(state.board, rookPos);
    if (rook && rook.type === PieceType.Rook && !rook.hasMoved) {
      const b = getPiece(state.board, { file: 1, rank });
      const c = getPiece(state.board, { file: 2, rank });
      const d = getPiece(state.board, { file: 3, rank });
      if (!b && !c && !d) {
        if (
          !isSquareAttacked(state.board, { file: 4, rank }, color) &&
          !isSquareAttacked(state.board, { file: 3, rank }, color) &&
          !isSquareAttacked(state.board, { file: 2, rank }, color)
        ) {
          moves.push({ from: kingPos, to: { file: 2, rank }, isCastle: true });
        }
      }
    }
  }

  return moves;
}

/**
 * Check if a square is attacked by the opponent of `color`.
 */
export function isSquareAttacked(
  board: (Piece | null)[][],
  pos: Position,
  color: Color,
): boolean {
  const opponent = color === Color.White ? Color.Black : Color.White;

  // Check attacks from each direction

  // Rook/Queen attacks along ranks and files
  for (const dir of ROOK_DIRS) {
    let file = pos.file;
    let rank = pos.rank;
    let df = dir[0];
    let dr = dir[1];

    for (let step = 0; step < 8; step++) {
      const wrapped = wrapPosition(file + df, rank + dr);
      if (!wrapped) break;
      if (posEqual(wrapped, pos)) break;

      const piece = getPiece(board, wrapped);
      if (piece) {
        if (piece.color === opponent &&
          (piece.type === PieceType.Rook || piece.type === PieceType.Queen)) {
          return true;
        }
        break;
      }

      if ((rank + dr) > 7 || (rank + dr) < 0) dr = -dr;
      file = wrapped.file;
      rank = wrapped.rank;
    }
  }

  // Bishop/Queen attacks along diagonals
  for (const dir of BISHOP_DIRS) {
    let file = pos.file;
    let rank = pos.rank;
    let df = dir[0];
    let dr = dir[1];

    for (let step = 0; step < 8; step++) {
      const wrapped = wrapPosition(file + df, rank + dr);
      if (!wrapped) break;
      if (posEqual(wrapped, pos)) break;

      const piece = getPiece(board, wrapped);
      if (piece) {
        if (piece.color === opponent &&
          (piece.type === PieceType.Bishop || piece.type === PieceType.Queen)) {
          return true;
        }
        break;
      }

      if ((rank + dr) > 7 || (rank + dr) < 0) dr = -dr;
      file = wrapped.file;
      rank = wrapped.rank;
    }
  }

  // Knight attacks
  for (const [df, dr] of KNIGHT_JUMPS) {
    const wrapped = wrapPosition(pos.file + df, pos.rank + dr);
    if (!wrapped) continue;
    const piece = getPiece(board, wrapped);
    if (piece && piece.color === opponent && piece.type === PieceType.Knight) {
      return true;
    }
  }

  // King attacks
  for (const [df, dr] of KING_DIRS) {
    const wrapped = wrapPosition(pos.file + df, pos.rank + dr);
    if (!wrapped) continue;
    const piece = getPiece(board, wrapped);
    if (piece && piece.color === opponent && piece.type === PieceType.King) {
      return true;
    }
  }

  // Pawn attacks
  const pawnDir = color === Color.White ? 1 : -1;
  for (const df of [-1, 1]) {
    const wrapped = wrapPosition(pos.file + df, pos.rank + pawnDir);
    if (!wrapped) continue;
    const piece = getPiece(board, wrapped);
    if (piece && piece.color === opponent && piece.type === PieceType.Pawn) {
      return true;
    }
  }

  return false;
}

/**
 * Find the king position for a given color.
 */
export function findKing(board: (Piece | null)[][], color: Color): Position | null {
  for (let file = 0; file < 8; file++) {
    for (let rank = 0; rank < 8; rank++) {
      const piece = board[file][rank];
      if (piece && piece.type === PieceType.King && piece.color === color) {
        return { file, rank };
      }
    }
  }
  return null;
}

/**
 * Check if the given color's king is in check.
 */
export function isInCheck(board: (Piece | null)[][], color: Color): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos, color);
}

/**
 * Apply a move to the game state, returning a new state.
 * Does NOT validate legality - use makeMove() for that.
 */
export function applyMove(state: GameState, move: Move): GameState {
  const newState = cloneGameState(state);
  const piece = getPiece(newState.board, move.from)!;
  const captured = getPiece(newState.board, move.to);

  // Move piece
  newState.board[move.to.file][move.to.rank] = piece;
  newState.board[move.from.file][move.from.rank] = null;
  piece.hasMoved = true;

  // Handle promotion
  if (move.promotion) {
    newState.board[move.to.file][move.to.rank] = {
      type: move.promotion,
      color: piece.color,
      hasMoved: true,
    };
  }

  // Handle castling
  if (move.isCastle) {
    const rank = move.from.rank;
    if (move.to.file === 6) {
      // King side
      const rook = newState.board[7][rank]!;
      newState.board[5][rank] = rook;
      newState.board[7][rank] = null;
      rook.hasMoved = true;
    } else if (move.to.file === 2) {
      // Queen side
      const rook = newState.board[0][rank]!;
      newState.board[3][rank] = rook;
      newState.board[0][rank] = null;
      rook.hasMoved = true;
    }
  }

  // Handle en passant capture
  if (move.isEnPassant) {
    const capturedPawnRank = piece.color === Color.White ? move.to.rank - 1 : move.to.rank + 1;
    newState.board[move.to.file][capturedPawnRank] = null;
  }

  // Update en passant target
  if (piece.type === PieceType.Pawn && Math.abs(move.to.rank - move.from.rank) === 2) {
    const epRank = (move.from.rank + move.to.rank) / 2;
    newState.enPassantTarget = { file: move.from.file, rank: epRank };
  } else {
    newState.enPassantTarget = null;
  }

  // Update castling rights
  if (piece.type === PieceType.King) {
    newState.castlingRights[piece.color] = { kingSide: false, queenSide: false };
  }
  if (piece.type === PieceType.Rook) {
    if (move.from.file === 0 && move.from.rank === (piece.color === Color.White ? 0 : 7)) {
      newState.castlingRights[piece.color].queenSide = false;
    }
    if (move.from.file === 7 && move.from.rank === (piece.color === Color.White ? 0 : 7)) {
      newState.castlingRights[piece.color].kingSide = false;
    }
  }

  // Update clocks
  if (piece.type === PieceType.Pawn || captured) {
    newState.halfMoveClock = 0;
  } else {
    newState.halfMoveClock++;
  }

  if (state.turn === Color.Black) {
    newState.fullMoveNumber++;
  }

  // Switch turn
  newState.turn = state.turn === Color.White ? Color.Black : Color.White;

  // Add move to history. Notation is intentionally NOT computed here:
  // applyMove runs thousands of times during legality checking, and
  // getMoveNotation itself applies moves to test for check/mate — computing
  // it here would cause unbounded mutual recursion. makeMove() fills in the
  // notation once, for the single move it actually commits.
  newState.moveHistory.push({ ...move });

  return newState;
}

/**
 * Get all legal moves for the current player.
 */
export function getLegalMoves(state: GameState): Move[] {
  const legalMoves: Move[] = [];

  for (let file = 0; file < 8; file++) {
    for (let rank = 0; rank < 8; rank++) {
      const piece = state.board[file][rank];
      if (!piece || piece.color !== state.turn) continue;

      const pos: Position = { file, rank };
      const pseudoMoves = pseudoLegalMovesForPiece(state, pos);

      for (const move of pseudoMoves) {
        // Apply the move and check if our king is still safe
        const newState = applyMove(state, move);
        if (!isInCheck(newState.board, state.turn)) {
          legalMoves.push(move);
        }
      }
    }
  }

  return legalMoves;
}

/**
 * Get legal moves for a specific piece.
 */
export function getLegalMovesForPiece(state: GameState, pos: Position): Move[] {
  const piece = getPiece(state.board, pos);
  if (!piece || piece.color !== state.turn) return [];

  const pseudoMoves = pseudoLegalMovesForPiece(state, pos);
  return pseudoMoves.filter(move => {
    const newState = applyMove(state, move);
    return !isInCheck(newState.board, state.turn);
  });
}

/**
 * Make a move if it's legal. Returns the new state or null if invalid.
 */
export function makeMove(state: GameState, move: Move): GameState | null {
  if (state.status === GameStatus.Checkmate ||
    state.status === GameStatus.Stalemate ||
    state.status === GameStatus.Draw ||
    state.status === GameStatus.Resigned) {
    return null;
  }

  const piece = getPiece(state.board, move.from);
  if (!piece || piece.color !== state.turn) return null;

  const legalMoves = getLegalMovesForPiece(state, move.from);
  const matchingMove = legalMoves.find(m =>
    posEqual(m.to, move.to) &&
    m.promotion === move.promotion
  );

  if (!matchingMove) return null;

  const newState = applyMove(state, matchingMove);

  // Fill in algebraic notation for the committed move (the pre-move `state`
  // is needed to read the moving piece and disambiguate).
  const lastIdx = newState.moveHistory.length - 1;
  newState.moveHistory[lastIdx] = {
    ...newState.moveHistory[lastIdx],
    notation: getMoveNotation(state, matchingMove),
  };

  // Check game status
  const opponentMoves = getLegalMoves(newState);
  const inCheck = isInCheck(newState.board, newState.turn);

  if (opponentMoves.length === 0) {
    if (inCheck) {
      newState.status = GameStatus.Checkmate;
      newState.winner = state.turn;
    } else {
      newState.status = GameStatus.Stalemate;
    }
  } else if (inCheck) {
    newState.status = GameStatus.Check;
  } else {
    newState.status = GameStatus.Active;
  }

  // 50-move rule
  if (newState.halfMoveClock >= 100) {
    newState.status = GameStatus.Draw;
  }

  return newState;
}

/**
 * Generate algebraic notation for a move.
 */
function getMoveNotation(state: GameState, move: Move): string {
  const piece = getPiece(state.board, move.from)!;

  if (move.isCastle) {
    return move.to.file === 6 ? 'O-O' : 'O-O-O';
  }

  let notation = '';

  if (piece.type !== PieceType.Pawn) {
    notation += piece.type;
  }

  if (move.isCapture) {
    if (piece.type === PieceType.Pawn) {
      notation += String.fromCharCode(97 + move.from.file);
    }
    notation += 'x';
  }

  notation += posToString(move.to);

  if (move.promotion) {
    notation += '=' + move.promotion;
  }

  // Check/checkmate indicator
  const newState = applyMove(state, move);
  if (isInCheck(newState.board, newState.turn)) {
    const opponentMoves = getLegalMoves(newState);
    notation += opponentMoves.length === 0 ? '#' : '+';
  }

  return notation;
}
