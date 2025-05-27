import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Shuffle/',
  server: {
    host: '0.0.0.0'
  },
  build: {
    // Use legacy format for better compatibility with GitHub Pages
    rollupOptions: {
      output: {
        format: 'iife'
      }
    }
  }
})
