import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path';

export default defineConfig({
  plugins: [react(),
    tailwindcss()
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Forward all backend API paths to the local backend container.
      // Matches /auth, /users, /posts, /folders, /library, /reports,
      //          /canvas, /workspace, /oauth, /stickers, /binders, /health, /internal
      '^/(auth|users|posts|folders|library|reports|canvas|workspace|oauth|stickers|binders|health|internal)(/|$)': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    exclude: ['node_modules', 'e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
