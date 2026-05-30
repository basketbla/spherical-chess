# Testing

Unit tests for the parts that are easy to get subtly wrong: the **rules engine**
(spherical move generation, check/mate, castling, en passant) and the
**multiplayer trust boundary** (the server's move authorization).

Tests run only in dev/CI via [Vitest](https://vitest.dev). They are never bundled
into the client or shipped in the server runtime image (excluded in
`.dockerignore`).

## Running

```bash
npm test          # run the whole suite once
npm run test:watch  # re-run on change (good while editing the engine)
```

No build step is required: `tests/` import `spherical-chess-shared`, which
`vitest.config.ts` aliases to the workspace **source** (`shared/src`), so tests
exercise the live engine directly.

## Layout

```
tests/
├── engine.test.ts       # rules engine, grounded in docs/rules.md
└── multiplayer.test.ts  # server/src/game/GameManager authorization & reconnect
```

- `engine.test.ts` asserts the *stated* spherical rules: file wrapping (a↔h),
  pole mapping (a8↔e8 …), pieces sliding/jumping through the seam and poles,
  pawns promoting at the edge without wrapping, check through the pole, fool's
  mate, the 50-move draw, castling (including "can't castle through check"), and
  en passant across the file seam.
- `multiplayer.test.ts` pins the server's guarantees: a client can only send a
  move *intent*, and the server rejects out-of-turn moves, moves from
  non-seated players, illegal moves, and double-resignations; seats bind to a
  `playerId` so reconnection works and a stale socket can't knock a player
  offline; player ids never leak in the public room view. See the trust model in
  [architecture.md](./architecture.md).

## Adding tests

Co-locate new cases in the matching file (or add a new `tests/*.test.ts`).
Helpers in `engine.test.ts` (`blankState`, `put`, `sq`, `reaches`) make it easy
to set up a position and assert on generated moves.

**When to add a test:** see [AGENTS.md](../AGENTS.md). Short version — add one
when it earns its keep (locking in a fixed bug so it can't regress, or pinning a
tricky invariant). Don't add tests reflexively for every change.
