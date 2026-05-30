import { describe, it, expect } from 'vitest';
import { getLegalMovesForPiece, type Move } from 'spherical-chess-shared';
import { GameManager } from '../server/src/game/GameManager';

// These tests pin the server's trust boundary: clients send only move *intents*,
// and the server re-validates everything against its own authoritative state.
// See docs/architecture.md (Online Multiplayer: Trust Model).

/** Start a 2-player game and return the manager + room + a legal first move. */
function startGame() {
  const gm = new GameManager();
  gm.registerConnection('white-1', 'sockW');
  gm.registerConnection('black-1', 'sockB');
  const room = gm.createMatchedRoom('white-1', 'Alice', 'black-1', 'Bob');
  // Pull a real legal move for white straight from the engine.
  let first: Move | undefined;
  outer: for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const moves = getLegalMovesForPiece(room.state, { file: f, rank: r });
      if (moves.length) { first = moves[0]; break outer; }
    }
  }
  return { gm, room, firstWhiteMove: first! };
}

describe('move authorization', () => {
  it('accepts a legal move from the player to move', () => {
    const { gm, room, firstWhiteMove } = startGame();
    const res = gm.makeMove(room.id, 'white-1', firstWhiteMove);
    expect(res).not.toBeNull();
    expect(res!.state.turn).toBe('black');
  });

  it('rejects a move played out of turn', () => {
    const { gm, room } = startGame();
    const blackMove = getLegalMovesForPiece(room.state, { file: 0, rank: 6 })[0]; // a black pawn
    expect(gm.makeMove(room.id, 'black-1', blackMove)).toBeNull();
  });

  it('rejects a move from a player not seated in the room', () => {
    const { gm, room, firstWhiteMove } = startGame();
    // A third party who somehow learns the roomId still can't move.
    expect(gm.makeMove(room.id, 'intruder', firstWhiteMove)).toBeNull();
  });

  it('rejects an illegal move even from the correct player', () => {
    const { gm, room } = startGame();
    const bogus: Move = { from: { file: 0, rank: 0 }, to: { file: 5, rank: 5 } };
    expect(gm.makeMove(room.id, 'white-1', bogus)).toBeNull();
  });

  it('ignores moves for an unknown room', () => {
    const { gm, firstWhiteMove } = startGame();
    expect(gm.makeMove('no-such-room', 'white-1', firstWhiteMove)).toBeNull();
  });
});

describe('private room seating', () => {
  it('refuses to let the creator take both seats', () => {
    const gm = new GameManager();
    const room = gm.createRoom('p1', 'Solo');
    expect(gm.joinRoom(room.id, 'p1', 'Solo')).toBeNull();
  });

  it('refuses to join a full room', () => {
    const gm = new GameManager();
    const room = gm.createRoom('p1', 'A');
    expect(gm.joinRoom(room.id, 'p2', 'B')).not.toBeNull();
    expect(gm.joinRoom(room.id, 'p3', 'C')).toBeNull();
  });

  it('does not leak player ids in the public room view', () => {
    const gm = new GameManager();
    gm.registerConnection('p1', 's1');
    const room = gm.createRoom('p1', 'A') as Record<string, unknown>;
    // The seat token must never travel to clients, or seats could be spoofed.
    expect(room.whitePlayerId).toBeUndefined();
    expect(room.blackPlayerId).toBeUndefined();
  });
});

describe('reconnection by player id', () => {
  it('lets a seated player rejoin and reports their color', () => {
    const { gm } = startGame();
    const rj = gm.getRejoinInfo('black-1');
    expect(rj?.color).toBe('black');
    expect(rj?.room.id).toBeDefined();
  });

  it('has no rejoin info for an unknown player', () => {
    const { gm } = startGame();
    expect(gm.getRejoinInfo('stranger')).toBeNull();
  });

  it('ignores a stale socket disconnect after a reconnect', () => {
    const { gm } = startGame();
    gm.registerConnection('white-1', 'sockW2'); // reconnected on a new socket
    // The old socket's late disconnect must not knock the player offline.
    expect(gm.markDisconnected('white-1', 'sockW')).toBe(false);
    expect(gm.isConnected('white-1')).toBe(true);
    // The current socket's disconnect does register.
    expect(gm.markDisconnected('white-1', 'sockW2')).toBe(true);
    expect(gm.isConnected('white-1')).toBe(false);
  });
});

describe('resignation and game end', () => {
  it('ends the game on resign and blocks further play', () => {
    const { gm, room, firstWhiteMove } = startGame();
    const ended = gm.resign(room.id, 'black-1');
    expect(ended?.status).toBe('resigned');
    expect(ended?.winner).toBe('white');
    // No moves and no second resignation accepted after the game is over.
    expect(gm.makeMove(room.id, 'white-1', firstWhiteMove)).toBeNull();
    expect(gm.resign(room.id, 'white-1')).toBeNull();
  });
});
