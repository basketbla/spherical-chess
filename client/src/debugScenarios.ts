// Preset game states for eyeballing tricky UI (the check indicator, the
// game-over screen, etc.) without playing a whole game. Open with e.g.
//   ?scenario=check        ?scenario=checkmate
// They boot straight into a local game with the given position.
import {
  createInitialGameState, makeMove, posFromString, type GameState,
} from 'spherical-chess-shared';

/** Replay a list of [from, to] moves from the initial position. */
function play(moves: [string, string][]): GameState {
  let s = createInitialGameState();
  for (const [from, to] of moves) {
    const next = makeMove(s, { from: posFromString(from), to: posFromString(to) });
    if (next) s = next;
  }
  return s;
}

export const SCENARIOS: Record<string, () => GameState> = {
  // White queen captures e5 with check (black to move, in check, not mated).
  check: () => play([['e2', 'e4'], ['e7', 'e5'], ['d1', 'h5'], ['g7', 'g6'], ['h5', 'e5']]),
  // Fool's mate — black mates white.
  checkmate: () => play([['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]),
};

/** The scenario named in the URL (?scenario=...), or null. */
export function scenarioFromUrl(): GameState | null {
  if (typeof window === 'undefined') return null;
  const name = new URLSearchParams(window.location.search).get('scenario');
  return name && SCENARIOS[name] ? SCENARIOS[name]() : null;
}
