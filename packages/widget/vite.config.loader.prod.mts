import { defineConfig } from 'vite';
import { resolve } from 'path';

// Simple replace plugin for version string
const replacePlugin = () => {
  return {
    name: 'replace-version',
    transform(code, id) {
      if (id.includes('loader.js')) {
        return code.replace(/__SHOPROCKET_VERSION__/g, process.env.SHOPROCKET_VERSION || Date.now().toString());
      }
      return code;
    }
  };
};

export default defineConfig({
  plugins: [replacePlugin()],
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