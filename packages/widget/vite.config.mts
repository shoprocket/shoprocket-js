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
        assetFileNames: '[name][extname]',
        compact: true
      },
      // External dependencies we could load separately if needed
      external: [],
    },
    minify: 'esbuild', // esbuild is faster and sometimes produces smaller output
    target: 'es2020', // Modern browsers only - reduces polyfills
    sourcemap: false,
    // Inline CSS into JS
    cssCodeSplit: false,
    // Report bundle size
    reportCompressedSize: true,
    chunkSizeWarningLimit: 50
  },
  esbuild: {
    // More aggressive minification
    legalComments: 'none',
    minifyIdentifiers: true,
    minifyWhitespace: true,
    minifySyntax: true,
    treeShaking: true,
    drop: ['debugger'], // Keep console.error for error handling
    pure: ['console.log', 'console.info', 'console.debug', 'console.warn'],
    target: 'es2020'
  },
  server: {
    port: 3000,
    open: '/index.html'
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['lit', '@shoprocket/core'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
});