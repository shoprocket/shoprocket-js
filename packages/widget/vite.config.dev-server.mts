import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

// Build config for the AWS dev server (dev.shoprocket.io / dev-cdn.shoprocket.io)
// Reverb runs behind nginx at wss://dev.shoprocket.io/app/...

export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  publicDir: 'public',
  define: {
    __DEV__: 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
    'import.meta.env.VITE_REVERB_HOST': JSON.stringify('dev.shoprocket.io'),
    'import.meta.env.VITE_REVERB_PORT': JSON.stringify('443'),
    'import.meta.env.VITE_REVERB_SCHEME': JSON.stringify('https'),
    'import.meta.env.VITE_REVERB_APP_KEY': JSON.stringify('9657355c3453f629bf9a0691404729d5'),
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'Shoprocket',
      formats: ['iife'],
      fileName: () => 'shoprocket-bundle.js'
    },
    rollupOptions: {
      output: {
        name: 'Shoprocket',
        assetFileNames: '[name][extname]',
        compact: true,
        manualChunks: undefined,
        inlineDynamicImports: true,
        minifyInternalExports: true,
      },
      external: [],
      treeshake: {
        preset: 'smallest',
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: [
          'console.log',
          'console.debug',
          'console.warn',
          'console.error',
          'console.info',
          'console.trace',
          'console.time',
          'console.timeEnd'
        ],
        passes: 3,
        unsafe: true,
        unsafe_arrows: true,
        unsafe_comps: true,
        unsafe_Function: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
        unused: true,
        inline: 3,
        dead_code: true,
        evaluate: true,
        join_vars: true,
        conditionals: true,
        comparisons: true,
        booleans: true,
        keep_fargs: false,
        keep_fnames: false,
        hoist_funs: true,
        hoist_vars: true,
        if_return: true,
        collapse_vars: true,
        reduce_vars: true,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
          keep_quoted: true,
        }
      },
      format: {
        comments: false,
        ascii_only: true,
        quote_style: 3,
      }
    },
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 200,
  },
  esbuild: {
    legalComments: 'none',
    logLevel: 'error',
    logOverride: {
      'this-is-undefined-in-esm': 'silent'
    }
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
