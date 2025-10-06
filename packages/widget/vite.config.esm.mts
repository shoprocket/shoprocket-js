import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    tailwindcss(),
    visualizer({
      filename: './dist/stats-esm.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap'
    })
  ],
  publicDir: 'public',
  define: {
    'import.meta.env.DEV': 'true',
    'import.meta.env.PROD': 'false',
  },
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    // NOT using lib mode - this enables real code splitting!
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.ts')
      },
      output: {
        format: 'es',
        entryFileNames: 'main.shoprocket.js',
        chunkFileNames: '[name]-[hash].shoprocket.js',
        // Manual chunking for analytics - only chunk these, everything else in main
        manualChunks(id) {
          // Force trackers into separate chunks (lazy-loaded)
          if (id.includes('analytics/trackers/google-analytics')) {
            return 'tracker-ga';
          }
          if (id.includes('analytics/trackers/facebook-pixel')) {
            return 'tracker-fb';
          }
          if (id.includes('analytics/trackers/google-ads')) {
            return 'tracker-gads';
          }

          // Everything else stays in main bundle to prevent singleton duplication
          // Lazy-loaded components will still be chunked automatically via dynamic imports
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    modulePreload: false, // Don't preload chunks
    reportCompressedSize: true,
    chunkSizeWarningLimit: 50
  },
  esbuild: {
    legalComments: 'none',
    minifyIdentifiers: true,
    minifyWhitespace: true,
    minifySyntax: true,
    treeShaking: true,
    drop: ['debugger'],
    target: 'es2020'
  },
  server: {
    port: 5173,
    open: '/index.html'
  },
  optimizeDeps: {
    include: ['lit', '@shoprocket/core'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
});