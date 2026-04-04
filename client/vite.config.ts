import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@chatapp/shared': path.resolve(__dirname, '../shared/types/index.ts'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Makes all SCSS partials available without relative paths
        // e.g. @use 'variables' works from any .scss file
        loadPaths: [path.resolve(__dirname, 'src/styles')],
      },
    },
  },
});