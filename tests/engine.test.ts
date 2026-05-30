import { describe, it, expect } from 'vitest';
import {
  Color, PieceType, GameStatus,
  createEmptyBoard, createInitialGameState,
  wrapFile, wrapPosition, getPiece, posFromString, posEqual,
  getLegalMovesForPiece, isInCheck, makeMove,
  type GameState, type Move,
} from 'spherical-chess-shared';

// ---- helpers -------------------------------------------------------------

/** A fresh, empty board with no castling rights / en passant. */
function blankState(turn: Color = Color.White): GameState {
  const s = createInitialGameState();
  s.board = createEmptyBoard();
  s.turn = turn;
  s.castlingRights = {
    [Color.White]: { kingSide: false, queenSide: false },
    [Color.Black]: { kingSide: false, queenSide: false },
  };
  s.enPassantTarget = null;
  s.moveHistory = [];
  s.halfMoveClock = 0;
  s.status = GameStatus.Active;
  return s;
}

const sq = (s: string) => posFromString(s);

function put(s: GameState, square: string, type: PieceType, color: Color, hasMoved = true) {
  const p = sq(square);
  s.board[p.file][p.rank] = { type, color, hasMoved };
}

const reaches = (moves: Move[], to: string) => moves.some(m => posEqual(m.to, sq(to)));

// ---- coordinate wrapping (the defining feature) --------------------------

describe('coordinate wrapping', () => {
  it('wraps files around the cylinder (a <-> h)', () => {
    expect(wrapFile(8)).toBe(0);
    expect(wrapFile(-1)).toBe(7);
    expect(wrapFile(11)).toBe(3);
    expect(wrapPosition(8, 3)).toEqual({ file: 0, rank: 3 });
    expect(wrapPosition(-1, 3)).toEqual({ file: 7, rank: 3 });
  });

  it('maps every file across the north pole shifted by 4 (a8<->e8 ...)', () => {
    // Stepping one past rank 8 (index 7) lands on rank 8 of file+4.
    for (let f = 0; f < 8; f++) {
      expect(wrapPosition(f, 8)).toEqual({ file: (f + 4) % 8, rank: 7 });
    }
  });

  it('maps every file across the south pole shifted by 4 (a1<->e1 ...)', () => {
    for (let f = 0; f < 8; f++) {
      expect(wrapPosition(f, -1)).toEqual({ file: (f + 4) % 8, rank: 0 });
    }
  });

  it('continues past the pole (rank bounces back the far side)', () => {
    // Two steps past rank 7: rank 9 -> index 6, file+4.
    expect(wrapPosition(0, 9)).toEqual({ file: 4, rank: 6 });
  });

  it('returns null when a single step would re-cross a pole (invalid)', () => {
    expect(wrapPosition(0, 16)).toBeNull();
  });
});

// ---- piece movement under wrapping ---------------------------------------

describe('piece movement', () => {
  it('rook slides through the pole and on down the far file', () => {
    const s = blankState();
    put(s, 'a8', PieceType.Rook, Color.White);
    const m = getLegalMovesForPiece(s, sq('a8'));
    expect(reaches(m, 'e8')).toBe(true); // one step north = through the pole
    expect(reaches(m, 'e1')).toBe(true); // keeps sliding south on the e-file
    expect(reaches(m, 'a1')).toBe(true); // and straight down its own file
  });

  it('knight keeps full 8-move mobility even from a "corner"', () => {
    const s = blankState();
    put(s, 'a1', PieceType.Knight, Color.White);
    // Rules: knights have no edge/corner reduction on a sphere.
    expect(getLegalMovesForPiece(s, sq('a1')).length).toBe(8);
  });

  it('pawn pushes one or two from its start rank', () => {
    const s = blankState();
    put(s, 'e2', PieceType.Pawn, Color.White, false);
    const m = getLegalMovesForPiece(s, sq('e2'));
    expect(reaches(m, 'e3')).toBe(true);
    expect(reaches(m, 'e4')).toBe(true);
    expect(m.length).toBe(2);
  });

  it('pawn promotes (4 options) at the edge and does not wrap past the pole', () => {
    const s = blankState();
    put(s, 'a7', PieceType.Pawn, Color.White);
    const toA8 = getLegalMovesForPiece(s, sq('a7')).filter(m => posEqual(m.to, sq('a8')));
    expect(toA8.length).toBe(4); // exactly the four promotions, nothing wrapped onward
    expect(new Set(toA8.map(m => m.promotion))).toEqual(
      new Set([PieceType.Queen, PieceType.Rook, PieceType.Bishop, PieceType.Knight]),
    );
  });

  it('pawn capture wraps across the file seam (a-file captures onto h-file)', () => {
    const s = blankState();
    put(s, 'a2', PieceType.Pawn, Color.White, false);
    put(s, 'h3', PieceType.Knight, Color.Black);
    expect(reaches(getLegalMovesForPiece(s, sq('a2')), 'h3')).toBe(true);
  });
});

// ---- check / checkmate / draw --------------------------------------------

describe('check, checkmate, draw', () => {
  it('detects a normal rook check down a file', () => {
    const s = blankState();
    put(s, 'e1', PieceType.King, Color.White);
    put(s, 'e8', PieceType.Rook, Color.Black);
    expect(isInCheck(s.board, Color.White)).toBe(true);
    s.board[sq('e8').file][sq('e8').rank] = null;
    expect(isInCheck(s.board, Color.White)).toBe(false);
  });

  it('detects check delivered through the pole', () => {
    const s = blankState(Color.Black);
    put(s, 'e8', PieceType.King, Color.Black);
    put(s, 'a8', PieceType.Rook, Color.White);
    // Block both rank paths a8->e8 so the only attack is the pole step north.
    put(s, 'b8', PieceType.Pawn, Color.White);
    put(s, 'h8', PieceType.Pawn, Color.White);
    expect(isInCheck(s.board, Color.Black)).toBe(true);
    s.board[0][7] = null; // remove the rook
    expect(isInCheck(s.board, Color.Black)).toBe(false);
  });

  it('recognises checkmate (fool\'s mate, no wrapping involved)', () => {
    let s = createInitialGameState();
    const play = (from: string, to: string) => {
      const ns = makeMove(s, { from: sq(from), to: sq(to) });
      expect(ns, `move ${from}->${to} should be legal`).not.toBeNull();
      s = ns!;
    };
    play('f2', 'f3');
    play('e7', 'e5');
    play('g2', 'g4');
    play('d8', 'h4'); // Qh4#
    expect(s.status).toBe(GameStatus.Checkmate);
    expect(s.winner).toBe(Color.Black);
  });

  it('declares a draw at the 50-move clock', () => {
    const s = blankState();
    put(s, 'e4', PieceType.King, Color.White);
    put(s, 'a4', PieceType.King, Color.Black);
    s.halfMoveClock = 99; // a non-pawn, non-capture move ticks it to 100
    const ns = makeMove(s, { from: sq('e4'), to: sq('e3') });
    expect(ns).not.toBeNull();
    expect(ns!.status).toBe(GameStatus.Draw);
  });
});

// ---- castling & en passant -----------------------------------------------

describe('castling and en passant', () => {
  it('offers king-side castling when the path is clear', () => {
    const s = blankState();
    put(s, 'e1', PieceType.King, Color.White, false);
    put(s, 'h1', PieceType.Rook, Color.White, false);
    s.castlingRights[Color.White] = { kingSide: true, queenSide: false };
    const castle = getLegalMovesForPiece(s, sq('e1')).find(
      m => m.isCastle && posEqual(m.to, sq('g1')),
    );
    expect(castle).toBeTruthy();
  });

  it('forbids castling through an attacked square', () => {
    const s = blankState();
    put(s, 'e1', PieceType.King, Color.White, false);
    put(s, 'h1', PieceType.Rook, Color.White, false);
    s.castlingRights[Color.White] = { kingSide: true, queenSide: false };
    put(s, 'f8', PieceType.Rook, Color.Black); // attacks f1, which the king crosses
    const castle = getLegalMovesForPiece(s, sq('e1')).find(
      m => m.isCastle && posEqual(m.to, sq('g1')),
    );
    expect(castle).toBeFalsy();
  });

  it('allows en passant across the file seam, removing the right pawn', () => {
    const s = blankState(Color.Black);
    put(s, 'd1', PieceType.King, Color.White);
    put(s, 'd8', PieceType.King, Color.Black);
    put(s, 'h4', PieceType.Pawn, Color.White); // just double-pushed h2-h4
    put(s, 'a4', PieceType.Pawn, Color.Black); // sits across the seam from h4
    s.enPassantTarget = sq('h3');
    const ep = getLegalMovesForPiece(s, sq('a4')).find(m => posEqual(m.to, sq('h3')));
    expect(ep?.isEnPassant).toBe(true);
    const ns = makeMove(s, ep!);
    expect(ns).not.toBeNull();
    expect(getPiece(ns!.board, sq('h4'))).toBeNull();              // captured pawn gone
    expect(getPiece(ns!.board, sq('h3'))?.color).toBe(Color.Black); // capturer landed
  });
});
