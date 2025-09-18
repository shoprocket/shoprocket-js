import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    emptyOutDir: true,
    outDir: 'dist-chunks',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Shoprocket',
      formats: ['es'], // ES modules for code splitting
      fileName: () => 'shoprocket-bundle.js'
    },
    rollupOptions: {
      output: {
        format: 'system', // SystemJS format works better for CDN chunks
        dir: 'dist-chunks',
        entryFileNames: 'shoprocket-bundle.js',
        chunkFileNames: '[name]-[hash].js',
        manualChunks(id) {
          // Force trackers into separate chunks
          if (id.includes('trackers/google-analytics')) return 'tracker-ga';
          if (id.includes('trackers/facebook-pixel')) return 'tracker-fb';
          if (id.includes('trackers/google-ads')) return 'tracker-gads';
        }
      }
    },
    minify: 'esbuild',
    target: 'es2020'
  }
});