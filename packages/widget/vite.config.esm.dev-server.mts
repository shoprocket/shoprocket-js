import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// ESM build for the AWS dev server (dev-cdn.shoprocket.io)
// Reverb runs behind nginx at wss://dev.shoprocket.io/app/...

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  publicDir: 'public',
  define: {
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
  },
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.ts')
      },
      output: {
        format: 'es',
        entryFileNames: 'main.shoprocket.js',
        chunkFileNames: '[name]-[hash].shoprocket.js',
        manualChunks(id) {
          if (id.includes('analytics/trackers/google-analytics')) return 'tracker-ga';
          if (id.includes('analytics/trackers/facebook-pixel')) return 'tracker-fb';
          if (id.includes('analytics/trackers/google-ads')) return 'tracker-gads';
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020',
    sourcemap: false,
    modulePreload: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 50
  },
  esbuild: {
    legalComments: 'none',
    minifyIdentifiers: true,
    minifyWhitespace: true,
    minifySyntax: true,
    treeShaking: true,
    drop: ['console', 'debugger'],
    target: 'es2020'
  },
  optimizeDeps: {
    include: ['lit', '@shoprocket/core'],
    esbuildOptions: {
      target: 'es2020'
    }
  }
});
