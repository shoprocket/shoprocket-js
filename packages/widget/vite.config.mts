import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    tailwindcss(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap' // treemap, sunburst, network
    })
  ],
  publicDir: 'public', // Copy test HTML files to dist/
  define: {
    // Preserve dev mode detection for localhost/test environments
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false',
  },
  build: {
    emptyOutDir: false, // Don't clear dist folder (loader is already there)
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Shoprocket',
      formats: ['iife'], // Single file for CDN
      fileName: () => 'bundle.shoprocket.js'
    },
    rollupOptions: {
      output: {
        // Single global variable
        name: 'Shoprocket',
        // Inline all CSS into JS
        assetFileNames: '[name][extname]',
        compact: true,
        // Prevent code splitting to avoid module duplication
        manualChunks: undefined,
        inlineDynamicImports: true
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
    // Removed pure console statements so we can debug
    target: 'es2020'
  },
  server: {
    port: 5173,
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
