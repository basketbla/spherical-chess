# Setup & Development Guide

## Prerequisites

- Node.js 18+
- pnpm 10+ (via corepack)
- For mobile development: Expo CLI (`npm install -g expo-cli`)

## Quick Start

### 1. Install dependencies

From the root directory:

```bash
pnpm install
```

This installs all dependencies for all workspaces (shared, server, client, mobile).

### 2. Build the shared package

```bash
pnpm --filter spherical-chess-shared build
```

### 3. Start the server

```bash
pnpm dev:server
```

The server starts on `http://localhost:3001`.

### 4. Start the web client

In a new terminal:

```bash
pnpm dev:client
```

The web client starts on `http://localhost:5173`.

### 5. Start the mobile client (optional)

In a new terminal:

```bash
pnpm dev:mobile
```

Scan the QR code with Expo Go on your phone, or press `i` for iOS simulator / `a` for Android emulator.

### Run everything at once

```bash
pnpm dev
```

This starts both the server and web client concurrently.

## Environment Variables

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |

### Web Client

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_SERVER_URL` | `http://localhost:3001` | Server URL for Socket.IO |

### Mobile Client

The server URL is configured in the app UI.

## Building for Production

### Server

```bash
pnpm --filter spherical-chess-shared build
pnpm --filter spherical-chess-server build
pnpm --filter spherical-chess-server start
```

### Web Client

```bash
pnpm --filter spherical-chess-shared build
pnpm --filter spherical-chess-client build
pnpm --filter spherical-chess-client preview  # to test the build
```

The built files are in `client/dist/`.

### Mobile Client

```bash
cd mobile
expo build:ios     # iOS
expo build:android # Android
```

Or use EAS Build:

```bash
npx eas-cli build --platform all
```

## Project Structure

```
spherical-chess/
├── package.json          # Root workspace config
├── tsconfig.base.json    # Shared TypeScript config
├── shared/               # Game engine
│   ├── src/
│   │   ├── types.ts      # Type definitions
│   │   ├── board.ts      # Board model & wrapping logic
│   │   ├── moves.ts      # Move generation & validation
│   │   └── index.ts      # Barrel export
│   └── package.json
├── server/               # Game server
│   ├── src/
│   │   ├── index.ts      # Entry point
│   │   ├── game/
│   │   │   └── GameManager.ts
│   │   └── matchmaking/
│   │       └── Matchmaker.ts
│   └── package.json
├── client/               # Web client
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── three/
│   │   │   └── ChessSphere.tsx
│   │   ├── components/
│   │   │   ├── Lobby.tsx
│   │   │   ├── GameUI.tsx
│   │   │   └── WaitingRoom.tsx
│   │   └── hooks/
│   │       └── useSocket.ts
│   └── package.json
├── mobile/               # Mobile client
│   ├── App.tsx
│   ├── app.json
│   └── package.json
└── docs/                 # Documentation
    ├── rules.md
    ├── architecture.md
    └── setup.md
```

## Troubleshooting

### Shared package not found

Make sure to build the shared package first:
```bash
pnpm --filter spherical-chess-shared build
```

### Socket connection fails

Check that the server is running and the client is configured to connect to the right URL. The Vite dev server proxies `/socket.io` requests to `localhost:3001`.

### 3D rendering issues

Ensure WebGL is supported in your browser. The 3D sphere view requires hardware-accelerated graphics. On mobile, make sure `expo-gl` is properly installed.

### Mobile build issues

If the mobile app fails to find the shared package, ensure the workspace link is set up:
```bash
pnpm install  # from root
```
