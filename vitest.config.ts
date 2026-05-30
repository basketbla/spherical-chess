import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

// Tests run only in dev/CI — they are never bundled into the client or the
// server runtime image (see .dockerignore). `spherical-chess-shared` resolves
// to the workspace source so tests exercise the live engine without a build.
export default defineConfig({
  resolve: {
    alias: {
      'spherical-chess-shared': resolve(__dirname, 'shared/src/index.ts'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
