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
    'import.meta.env.VITE_REVERB_HOST': JSON.stringify('dev.shoprocket.io'),
    'import.meta.env.VITE_REVERB_PORT': JSON.stringify('443'),
    'import.meta.env.VITE_REVERB_SCHEME': JSON.stringify('https'),
    'import.meta.env.VITE_REVERB_APP_KEY': JSON.stringify('9657355c3453f629bf9a0691404729d5'),
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
