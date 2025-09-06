import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  publicDir: 'public',
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Shoprocket',
      formats: ['iife'], // Single file for CDN
      fileName: () => 'shoprocket.js'
    },
    rollupOptions: {
      output: {
        // Single global variable
        name: 'Shoprocket',
        // Inline all CSS into JS
        assetFileNames: '[name][extname]'
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false, // Keep console for debugging
        drop_debugger: true
      },
      format: {
        comments: false // Remove comments
      }
    },
    sourcemap: false,
    // Inline CSS into JS
    cssCodeSplit: false,
    // Report bundle size
    reportCompressedSize: true,
    chunkSizeWarningLimit: 50
  },
  server: {
    port: 3000,
    open: '/index.html'
  }
});