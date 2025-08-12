// npx rollup -c
import { terser } from 'rollup-plugin-terser';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { string } from 'rollup-plugin-string';
import copy from 'rollup-plugin-copy';

export default {
  input: 'quelora.js',
  output: {
    file: 'dist/quelora.min.js',
    format: 'iife',
    name: 'Quelora',
    sourcemap: true,
    inlineDynamicImports: true,  // This forces everything into a single file
    // Option to ignore circular dependency warnings
    onwarn: (warning, warn) => {
      // Specifically ignore circular dependency warnings
      if (warning.code === 'CIRCULAR_DEPENDENCY') {
        return;
      }
      warn(warning); // Show other warnings normally
    }
  },
  external: ['sw.js'],
  plugins: [
    resolve({
      // Additional configuration to better handle dependencies
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      ignoreDynamicRequires: true // Helps with some circularity cases
    }),
    string({
      include: ['**/queloraWorker.js']
    }),
    copy({
      targets: [
        { src: 'locales/**/*', dest: 'dist/locales' }
      ]
    }),
    terser()
  ]
};