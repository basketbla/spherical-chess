# AGENTS.md

Guidance for AI agents (and humans) working in this repo.

## Orientation

Monorepo (pnpm workspaces): `shared/` (game engine + types), `server/` (Express +
Socket.IO), `client/` (React + Three.js), `mobile/` (Expo). The client imports
the engine as `spherical-chess-shared` (resolves to `shared/dist`, a build
artifact — rebuild `shared` after editing it). See [docs/architecture.md](docs/architecture.md)
for the full picture, including the online-multiplayer trust model and known
limitations, and [docs/rules.md](docs/rules.md) for the spherical rules.

Deploy: frontend on Netlify (sphericalchess.org), backend on Fly.io; both
auto-deploy on push to `main`.

## Testing policy

Tests live in `tests/` and run with `pnpm test` (Vitest). See
[docs/testing.md](docs/testing.md).

**Write a new test for a feature or bugfix ONLY IF IT ACTUALLY MAKES SENSE.**
Tests are for things worth protecting, not a box to tick on every change. Add one
when:

- You fixed a real bug and want to guarantee it can't silently regress (e.g. the
  notation/`applyMove` recursion that broke all moves, or both players being
  assigned white).
- You're adding/relying on a non-obvious invariant that's easy to break later
  (tricky spherical move-gen cases, the server's move-authorization rules).
- The behavior is hard to verify by hand but cheap to assert in code.

Do **not** add tests when:

- The change is trivial, cosmetic, or purely visual (styling, copy, 3D/material
  tweaks — there's no meaningful assertion to make).
- It would just restate the implementation or pin an arbitrary current value.
- A test would be flaky or need heavy mocking for little confidence gained.

When in doubt, prefer a small, high-signal test over none — but skipping a test
is the right call for plenty of changes. If you skip, that's fine; don't
apologize for it or add a hollow test to compensate.

## Conventions

- Match the style of surrounding code; keep comments at the existing density.
- Rebuild `shared` after editing it, or server/client type-check against stale
  types.
- Don't commit `dist/` or `*.tsbuildinfo` (gitignored; the latter also breaks the
  Docker build if shipped — see `.dockerignore`).
