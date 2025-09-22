import { defineConfig } from 'vite';
import { resolve } from 'path';

// Simple replace plugin for version string
const replacePlugin = () => {
  return {
    name: 'replace-version',
    transform(code, id) {
      if (id.includes('loader.js')) {
        return code.replace(/__SHOPROCKET_VERSION__/g, Date.now().toString());
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