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
    sourcemap: false,
    inlineDynamicImports: true,
    globals: {},
    strict: false
  },
  plugins: [
    resolve({
      browser: true,
      jsnext: true,
      preferBuiltins: false
    }),
    commonjs(),
    string({
      include: ['**/queloraWorker.js']
    }),
    copy({
      targets: [
        { src: 'locales/**/*', dest: 'dist/locales' }
      ]
    }),
    terser({
      compress: {
        ecma: 2015,
        drop_console: true,
        drop_debugger: true,
        passes: 2,
        unsafe: true
      },
      format: {
        comments: false,
        preamble: '/* Quelora v1 - MIT License */'
      }
    }),
    {
      name: 'clean-html-strings',
      renderChunk(code) {
        return {
          code: code.replace(/([ \t]*\\n[ \t]*)+/g, ''),
          map: null
        };
      }
    }
  ],
  external: ['fs', 'path', 'http', 'stream', 'zlib'],
  onwarn: (warning, warn) => {
    if (warning.code === 'CIRCULAR_DEPENDENCY') {
      console.warn(`⚠️  Dependencia circular: ${warning.cycle.join(' -> ')}`);
      return;
    }
    warn(warning);
  }
};
