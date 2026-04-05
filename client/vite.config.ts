import { defineConfig } from 'vite';
import react            from '@vitejs/plugin-react';
import path             from 'path';
import fs               from 'fs';

const variablesContent = fs.readFileSync(
  path.resolve(__dirname, 'src/styles/_variables.scss'), 'utf-8'
);
const mixinsContent = fs.readFileSync(
  path.resolve(__dirname, 'src/styles/_mixins.scss'), 'utf-8'
);

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // expose to network
    port: 5173,
  },
  resolve: {
    alias: {
      '@chatapp/shared': path.resolve(__dirname, '../shared/types/index.ts'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `${variablesContent}\n${mixinsContent}`,
      },
    },
  },
});
