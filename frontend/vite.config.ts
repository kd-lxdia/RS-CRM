import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: __dirname,
  cacheDir: path.resolve(__dirname, 'node_modules/.vite-slar2'),
  plugins: [react()],
  server: {
    port: 3005,
    strictPort: true,
    fs: { allow: [__dirname, path.resolve(__dirname, '../shared')] },
  },
  resolve: {
    // Keep workspace junctions inside this checkout. Without this, esbuild can
    // walk through the junction while searching for tsconfig files and fail on
    // restricted parent directories in hosted builds.
    preserveSymlinks: true,
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@slar-crm/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    // The shared workspace is imported only through the explicit source alias;
    // scanning its junction makes esbuild search outside the project sandbox.
    exclude: ['@slar-crm/shared'],
  },
});
