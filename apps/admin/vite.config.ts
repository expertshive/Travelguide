import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@traveler-guide/api-client': path.resolve(__dirname, '../../packages/api-client/src/index.ts'),
      '@traveler-guide/validation': path.resolve(__dirname, '../../packages/validation/src/index.ts'),
      '@traveler-guide/types': path.resolve(__dirname, '../../packages/types/src/index.ts'),
    },
  },
  server: {
    port: 3002,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, '/v1'),
      },
    },
  },
});
