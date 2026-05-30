# Architecture

## Overview

Spherical Chess is a monorepo with four packages:

```
spherical-chess/
├── shared/      # Game engine, types, move validation
├── server/      # Node.js game server with matchmaking
├── client/      # React + Three.js web client
└── mobile/      # React Native Expo mobile client
```

## Package Details

### `shared/` - Game Engine

The core game logic, used by both server and clients.

**Key files:**
- `src/types.ts` - All TypeScript types and interfaces (pieces, positions, moves, game state, socket events)
- `src/board.ts` - Board representation, coordinate wrapping (pole/file logic), position utilities
- `src/moves.ts` - Move generation, validation, check detection, legal move filtering

**Board Model:**
- 8x8 array indexed by `[file][rank]` (0-indexed)
- `wrapPosition(file, rank)` handles spherical coordinate wrapping
- `wrapFile(file)` handles horizontal cylinder wrapping

**Move Generation:**
1. `pseudoLegalMovesForPiece()` generates all moves without checking for leaving king in check
2. `getLegalMoves()` / `getLegalMovesForPiece()` filters out moves that leave the king in check
3. `makeMove()` validates and applies a move, returning the new game state
4. `isSquareAttacked()` checks if any opponent piece attacks a square (used for check detection and castling)

### `server/` - Game Server

Express + Socket.IO server handling multiplayer games.

**Key files:**
- `src/index.ts` - Server entry point, socket event handlers
- `src/game/GameManager.ts` - Room creation, move processing, player management
- `src/matchmaking/Matchmaker.ts` - Queue-based matchmaking with random color assignment

**Game Flow:**
1. Player connects via WebSocket
2. Player joins matchmaking queue or creates/joins private room
3. When matched, both players receive `gameStart` event with initial state
4. Players send `makeMove` events; server validates and broadcasts updates
5. Game ends on checkmate, stalemate, draw, or resignation

**API Endpoints:**
- `GET /api/health` - Server health check
- `GET /api/games` - List active games

### `client/` - Web Client

React application with Three.js 3D rendering.

**Key files:**
- `src/App.tsx` - Main app component, screen management, game logic coordination
- `src/three/ChessSphere.tsx` - 3D sphere board rendering with interactive squares
- `src/components/Lobby.tsx` - Main menu with quick match, private games, local play
- `src/components/GameUI.tsx` - HUD overlay showing game status, move history
- `src/components/WaitingRoom.tsx` - Room code display while waiting for opponent
- `src/hooks/useSocket.ts` - Socket.IO connection management

**3D Rendering:**
- Board squares are subdivided quads mapped onto a sphere surface using spherical coordinates
- `boardToSphere(file, rank)` converts grid positions to 3D sphere coordinates
- `createSquareGeometry()` creates curved geometry that follows the sphere surface
- Pieces rendered as HTML overlays positioned at square centers via `@react-three/drei`'s `<Html>` component
- `OrbitControls` from drei provides mouse/touch rotation, zoom, with damping

**Coordinate Mapping:**
- Rank maps to latitude (phi): rank 0 = south pole, rank 7 = north pole
- File maps to longitude (theta): 0-7 maps to 0-360 degrees
- Each square is a curved patch on the sphere, subdivided for smooth curvature

### `mobile/` - Mobile Client

React Native Expo application for iOS and Android.

**Key files:**
- `App.tsx` - Complete mobile application

**Features:**
- 2D interactive board for precise piece selection on touchscreens
- 3D sphere preview using expo-gl and expo-three (auto-rotating view)
- Wrapping indicators showing pole connections
- Socket.IO integration for online play
- Local play support

## Communication Protocol

All real-time communication uses Socket.IO. On connection the client passes a
persistent `playerId` (random, stored in `localStorage`) via the handshake
`auth` field; the server binds game seats to this id so players can reconnect.

### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `joinQueue` | `playerName: string` | Join matchmaking queue |
| `leaveQueue` | - | Leave matchmaking queue |
| `createPrivateGame` | `playerName: string` | Create a private game room |
| `joinPrivateGame` | `roomId, playerName` | Join an existing private room |
| `makeMove` | `roomId, move` | Submit a move |
| `requestValidMoves` | `roomId, position` | Get legal moves for a piece |
| `resign` | `roomId` | Resign the game |

### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `matchFound` | `roomId, color` | Matched with an opponent |
| `gameStart` | `GameRoom` | Game is starting |
| `gameUpdate` | `GameState, Move` | A move was made |
| `gameOver` | `GameState` | Game has ended |
| `validMoves` | `Move[]` | Legal moves for requested piece |
| `error` | `string` | Error message |
| `opponentDisconnected` | - | Opponent's connection dropped (grace period running) |
| `opponentReconnected` | - | Opponent reconnected within the grace period |
| `rejoinedGame` | `GameRoom, color` | Sent to a reconnecting player to restore their in-progress game |

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Language | TypeScript |
| Build tool | pnpm workspaces |
| Server runtime | Node.js |
| Server framework | Express |
| WebSocket | Socket.IO |
| Web UI | React 18 |
| 3D rendering | Three.js via @react-three/fiber |
| 3D utilities | @react-three/drei |
| Web bundler | Vite |
| Mobile framework | React Native (Expo) |
| Mobile 3D | expo-gl + expo-three |

## Online Multiplayer: Trust Model & Known Limitations

### What's solid

The server is **authoritative**. Clients never send game state — only *move
intents* (`makeMove(roomId, move)` where a `Move` is `{from, to, promotion}`).
The server keeps the canonical `GameState` per room and broadcasts the result.

A submitted move passes four server-side gates (`GameManager.makeMove`):
1. Room exists.
2. The socket's identity maps to a seat (white/black) in that room.
3. It is that color's turn.
4. The move is in the legal-move set recomputed from the server's own state
   (shared `makeMove` → `getLegalMovesForPiece`), including check/mate/promotion.

So you **cannot** inject an arbitrary game state — there is no event that
accepts one — and you cannot make an illegal move or move out of turn or as the
other player. Forging the move object doesn't help: an illegal one is dropped, a
legal one yields the same state the server would have computed anyway.

### Known limitations / gaps

Ordered roughly by priority for the online feature.

1. **Identity & reconnection** — *(partially addressed: persistent player ID)*.
   Players now carry a random `playerId` persisted in `localStorage`, sent via
   the Socket.IO handshake (`auth.playerId`). Seats are bound to `playerId`, so a
   dropped player can reconnect (new socket, same id) and resume. On disconnect
   the opponent is notified and a grace timer auto-resigns the absent player only
   if they don't return within the window.
   **Still missing:** the `playerId` is unauthenticated and trivially
   spoofable — anyone who obtains another player's id can impersonate them. Real
   security needs accounts/auth (deferred). It is identity, not authentication.

2. **Durability — state is in-memory on a single instance.** `GameManager` holds
   rooms in a plain `Map`. Active WebSocket connections keep the Fly machine
   awake, but **any redeploy (every push, via CI) restarts the machine and wipes
   all in-progress games.** No persistence (no DB/Redis), no crash recovery.

3. **No horizontal scaling.** Socket.IO rooms + an in-memory `Map` only work on
   one instance (`fly.toml` runs a single machine, `--ha=false`). Two machines
   would mean two players in one game could land on different instances with
   different state. Scaling out needs a Socket.IO adapter (e.g. Redis) plus a
   shared/persistent game store, or sticky per-game routing.

4. **No rate limiting / abuse controls.** `requestValidMoves` and `makeMove` each
   run `getLegalMoves`, which simulates every pseudo-legal move and tests for
   check — not free. A client can spam these (and `joinQueue`); easy DoS.

5. **Rules engine is the entire trusted computing base.** Server safety equals
   the correctness of the shared move generator (which has already had at least
   one serious bug — the notation/`applyMove` recursion stack overflow). The
   spherical move-gen needs a real test suite; a legality bug is a cheating vector.

6. **No game clocks/timers**, no server-side enforcement of draw-by-repetition or
   the 50-move rule, no spectator model, and no stored game history.

7. **Minor:** `playerName` is unauthenticated (cosmetic impersonation); private
   room IDs are an 8-char UUID slice (~32 bits — fine against casual guessing,
   not cryptographically strong); a single `playerId` connecting from two tabs is
   not handled specially (last connection wins the seat).
