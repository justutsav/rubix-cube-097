import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react(), tailwind()],
  resolve: {
    alias: {
      // @rc097/core is consumed as TypeScript source, not as a built package. Vite transpiles it
      // in the same pass as the app, so the FSM the browser runs is byte-for-byte the code the
      // edge function and the telephony service run. No build step to forget, no stale dist/.
      '@rc097/core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  build: {
    // Capacitor serves from file:// inside the WebView, so assets must be relative.
    assetsDir: 'assets',
    target: 'es2020',
    sourcemap: true,
  },
  base: './',
  server: { port: 5173 },
});
