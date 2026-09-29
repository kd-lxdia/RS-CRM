import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const spaFallback = () => ({
  name: 'slar-2-spa-fallback',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url || '/';
      const isAssetRequest = path.extname(url.split('?')[0]) !== '';
      const isInternalRequest =
        url.startsWith('/@vite') ||
        url.startsWith('/@react-refresh') ||
        url.startsWith('/src/') ||
        url.startsWith('/node_modules/') ||
        url.startsWith('/api/');
      if (req.method === 'GET' && !isAssetRequest && !isInternalRequest) {
        req.url = '/index.html';
      }
      next();
    });
  },
});

export default defineConfig({
  root: __dirname,
  cacheDir: path.resolve(__dirname, 'node_modules/.vite-slar2'),
  plugins: [spaFallback(), react()],
  server: {
    host: '127.0.0.1',
    port: 3005,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@mui/material/utils/createSvgIcon': path.resolve(
        __dirname,
        '../node_modules/@mui/material/utils/createSvgIcon.mjs'
      ),
      '@slar-crm/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime',
      '@tanstack/react-query',
      'antd',
    ],
    needsInterop: ['mapbox-gl'],
  },
});
