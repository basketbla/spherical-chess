# Backend image for Fly.io: builds the shared + server workspaces and runs the
# socket.io/Express server. The client is hosted separately on Netlify.
FROM node:22-slim
WORKDIR /app
COPY . .
RUN npm ci \
 && npm run build --workspace=shared \
 && npm run build --workspace=server
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
