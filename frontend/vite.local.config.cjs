const { defineConfig } = require('vite');
const path = require('path');

module.exports = defineConfig({
  root: __dirname,
  cacheDir: path.resolve(__dirname, 'node_modules/.vite-slar2'),
  plugins: [],
  server: {
    host: '127.0.0.1',
    port: 3005,
    strictPort: true,
  },
  resolve: {
    dedupe: ['react', 'react-dom', '@tanstack/react-query'],
    alias: {
      '@slar-crm/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
