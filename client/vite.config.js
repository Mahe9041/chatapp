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
                // Auto-prepend variables + mixins to every SCSS file
                // This removes the need for @use imports in every module file
                additionalData: `
  @use "${path.resolve(__dirname, 'src/styles/_variables.scss').replace(/\\/g, '/')}" as *;
  @use "${path.resolve(__dirname, 'src/styles/_mixins.scss').replace(/\\/g, '/')}" as *;
`,
            },
        },
    },
});
