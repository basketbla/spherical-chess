# Spherical Chess

A complete implementation of **Spherical Chess** — a chess variant played on a board that wraps around a sphere. Features a 3D interactive board, multiplayer matchmaking, and clients for web and mobile.

Based on the [Spherical Chess variant](https://www.chessvariants.com/boardrules.dir/spherical.html) (standard board wrapping, not the pentagons version).

## How It Works

The standard 8x8 chessboard is mapped onto a sphere:

- **Files wrap horizontally**: The a-file connects to the h-file (like a cylinder)
- **Ranks wrap through poles**: Going off rank 8 brings you back on rank 8, shifted 4 files. Going off rank 1 does the same at the south pole.

```
    North Pole: a8↔e8, b8↔f8, c8↔g8, d8↔h8
    South Pole: a1↔e1, b1↔f1, c1↔g1, d1↔h1
```

This means there are no "edges" — every piece has full mobility everywhere on the board.

## Features

- **3D spherical board** — interactive, spinnable, zoomable view using Three.js
- **Full rules engine** — all piece movements with spherical wrapping, check/checkmate detection, castling, en passant, promotion
- **Online multiplayer** — real-time matchmaking with Socket.IO
- **Private games** — create a room and share the code with a friend
- **Local play** — two players on the same device
- **Web client** — React + Three.js with responsive design
- **Mobile client** — React Native Expo with 2D board + 3D preview
- **Move history** — algebraic notation for all moves

## Quick Start

```bash
# Install all dependencies
pnpm install

# Build the shared game engine
pnpm --filter spherical-chess-shared build

# Start server + web client
pnpm dev
```

Then open http://localhost:5173 in your browser.

## Project Structure

| Package | Description | Tech |
|---------|-------------|------|
| `shared/` | Game engine, rules, types | TypeScript |
| `server/` | Multiplayer server | Express + Socket.IO |
| `client/` | Web client with 3D board | React + Three.js |
| `mobile/` | Mobile client | React Native Expo |

## Documentation

- **[Rules](docs/rules.md)** — Complete spherical chess rules with diagrams
- **[Architecture](docs/architecture.md)** — System design, communication protocol, technology stack
- **[Setup Guide](docs/setup.md)** — Development setup, building, deployment

## Controls (Web Client)

| Action | Control |
|--------|---------|
| Rotate board | Click + drag |
| Zoom | Scroll wheel / pinch |
| Select piece | Click on piece |
| Move piece | Click highlighted square |
| Deselect | Click empty square |

## Game Modes

### Quick Match
Join the matchmaking queue and get paired with another player. Colors are assigned randomly.

### Private Game
Create a room and share the 8-character room code. Your opponent enters the code to join.

### Local Play
Both players take turns on the same device. The board shows whose turn it is.

## Spherical Chess Strategy Tips

1. **No safe corners or edges** — every square has full connectivity
2. **Bishops are stronger** — they can reach more squares through pole wrapping
3. **Back ranks are vulnerable** — attacks can come "from behind" through the poles
4. **Rooks control circular files** — a rook's file wraps around the entire board
5. **Knights always have 8 moves** — no edge restrictions anywhere

## License

MIT
