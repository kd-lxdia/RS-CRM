import { defineConfig } from 'vite';

// Keep the deploy config dependency-free. The browser bundle uses relative
// imports, so Vite does not need to traverse the workspace package junction.
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  optimizeDeps: { exclude: ['@slar-crm/shared'] },
});
