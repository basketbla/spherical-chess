# Backend image for Fly.io: builds the shared + server workspaces and runs the
# socket.io/Express server. The client is hosted separately on Netlify.
FROM node:22-slim
WORKDIR /app
# pnpm via corepack, pinned by the "packageManager" field in package.json.
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile \
 && pnpm --filter spherical-chess-shared build \
 && pnpm --filter spherical-chess-server build
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
