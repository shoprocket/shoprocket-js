import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/loader.js'),
      formats: ['iife'],
      fileName: () => 'shoprocket.js',
      name: 'ShoprocketLoader' // Required for IIFE format even though not used
    },
    rollupOptions: {
      output: {
        compact: true
      }
    },
    minify: 'esbuild',
    target: 'es5', // Loader should work everywhere
    sourcemap: false
  },
  esbuild: {
    legalComments: 'none',
    minifyIdentifiers: true,
    minifyWhitespace: true,
    minifySyntax: true,
    target: 'es5'
  }
});