import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.tsx'),
      name: 'ShoprocketReact',
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'mjs' : 'js'}`
    },
    rollupOptions: {
      external: ['react', 'react-dom', '@shoprocket/core'],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          '@shoprocket/core': 'ShoprocketCore'
        },
        exports: 'named'
      }
    },
    minify: 'terser',
    sourcemap: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 15
  },
  resolve: {
    alias: {
      '@shoprocket/core': resolve(__dirname, '../core/src')
    }
  }
});