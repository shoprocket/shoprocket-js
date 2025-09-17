import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/loader.js'),
      formats: ['iife'],
      fileName: () => 'shoprocket.js',
      name: 'ShoprocketLoader'
    },
    rollupOptions: {
      output: {
        compact: true,
        minifyInternalExports: true
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        pure_funcs: ['console.log', 'console.warn', 'console.error'],
        unsafe: true,
        unsafe_arrows: true,
        unused: true,
        dead_code: true,
        conditionals: true,
        comparisons: true,
        booleans: true,
        if_return: true,
        join_vars: true,
        reduce_vars: true,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
        ascii_only: true,
      }
    },
    target: 'es5', // Loader should work everywhere
    sourcemap: false
  }
});