import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    // No visualizer in production
  ],
  publicDir: 'public',
  define: {
    // Remove all dev checks at build time
    __DEV__: 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.DEV': 'false',
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
        // Single file output
        manualChunks: undefined,
        inlineDynamicImports: true,
        // Minify internal variable names
        minifyInternalExports: true,
      },
      external: [],
      treeshake: {
        preset: 'smallest',
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        // Remove unused code more aggressively
        unknownGlobalSideEffects: false,
      }
    },
    // Use terser for more aggressive minification
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
        passes: 3, // Multiple compression passes
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
        // Inline functions when possible
        inline: 3,
        // Remove unreachable code
        dead_code: true,
        // Evaluate constant expressions
        evaluate: true,
        // Join consecutive statements
        join_vars: true,
        // Optimize if-s and conditional expressions
        conditionals: true,
        // Optimize comparisons
        comparisons: true,
        // Optimize boolean expressions
        booleans: true,
        // Remove unused function arguments
        keep_fargs: false,
        // Remove unused function names
        keep_fnames: false,
        // Hoist functions
        hoist_funs: true,
        // Hoist variable declarations
        hoist_vars: true,
        // Optimize if-return and if-continue
        if_return: true,
        // Collapse single-use vars
        collapse_vars: true,
        // Reduce vars
        reduce_vars: true,
      },
      mangle: {
        toplevel: true,
        // Mangle private properties starting with _
        properties: {
          regex: /^_/,
          keep_quoted: true, // Don't mangle quoted properties
        }
      },
      format: {
        comments: false,
        ascii_only: true, // Better gzip compression
        // Remove quotes from property names where possible
        quote_style: 3,
      }
    },
    target: 'es2020',
    sourcemap: false,
    cssCodeSplit: false,
    reportCompressedSize: true,
    chunkSizeWarningLimit: 200, // Higher limit for production
  },
  esbuild: {
    legalComments: 'none',
    logLevel: 'error', // Only show errors
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