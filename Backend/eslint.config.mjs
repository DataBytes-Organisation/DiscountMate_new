import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

const nodeGlobals = {
  Buffer: 'readonly',
  __dirname: 'readonly',
  __filename: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  exports: 'writable',
  global: 'readonly',
  module: 'writable',
  process: 'readonly',
  require: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
};

export default [
  {
    ignores: [
      'node_modules/**',
      'logs/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: nodeGlobals,
    },
    plugins: {
      import: importPlugin,
    },
    settings: {
      'import/resolver': {
        node: {
          extensions: ['.js', '.jsx'],
        },
      },
    },
    rules: {
      ...importPlugin.configs.errors.rules,
      ...importPlugin.configs.warnings.rules,
      'array-bracket-newline': ['error', 'consistent'],
      'arrow-spacing': 'error',
      'comma-dangle': [
        'error',
        {
          arrays: 'always-multiline',
          exports: 'always-multiline',
          functions: 'always-multiline',
          imports: 'always-multiline',
          objects: 'always-multiline',
        },
      ],
      'comma-spacing': ['error', {}],
      indent: ['error', 2, { SwitchCase: 1 }],
      'key-spacing': 'warn',
      'keyword-spacing': ['error', { after: true, before: true }],
      'linebreak-style': ['error', 'unix'],
      'no-multi-spaces': [
        'error',
        {
          exceptions: {
            Property: false,
          },
          ignoreEOLComments: false,
        },
      ],
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
          maxBOF: 0,
          maxEOF: 0,
        },
      ],
      'no-trailing-spaces': [
        'warn',
        {
          ignoreComments: false,
          skipBlankLines: false,
        },
      ],
      'no-useless-escape': 'off',
      'object-curly-spacing': ['warn', 'always'],
      'padded-blocks': ['error', 'never'],
      'padding-line-between-statements': [
        'error',
        {
          blankLine: 'always',
          next: ['multiline-block-like'],
          prev: ['*'],
        },
        {
          blankLine: 'never',
          next: ['const', 'let', 'var'],
          prev: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          next: ['multiline-block-like'],
          prev: ['const', 'let', 'var'],
        },
        {
          blankLine: 'always',
          next: ['const', 'let', 'var'],
          prev: ['multiline-block-like', 'multiline-const'],
        },
        {
          blankLine: 'always',
          next: 'return',
          prev: '*',
        },
      ],
      quotes: ['error', 'single'],
      semi: ['error', 'always'],
      'semi-spacing': ['error', { after: true, before: false }],
      'space-before-blocks': ['error', 'always'],
      'space-infix-ops': 'warn',
      'template-curly-spacing': ['warn', 'never'],
    },
  },
];
