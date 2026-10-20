import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

const naming = [
  'error',
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow'
  },
  {
    selector: 'import',
    format: ['camelCase', 'PascalCase', 'UPPER_CASE']
  },
  {
    selector: 'variable',
    format: ['camelCase', 'PascalCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow'
  },
  {
    selector: 'function',
    format: ['camelCase', 'PascalCase']
  },
  {
    selector: 'parameter',
    format: ['camelCase', 'PascalCase'],
    leadingUnderscore: 'allow'
  },
  {
    selector: 'typeLike',
    format: ['PascalCase']
  },
  {
    selector: 'enumMember',
    format: ['PascalCase', 'UPPER_CASE']
  },
  {
    selector: ['objectLiteralProperty', 'typeProperty', 'objectLiteralMethod'],
    format: ['camelCase', 'PascalCase', 'UPPER_CASE', 'snake_case'],
    leadingUnderscore: 'allow'
  },
  {
    selector: ['objectLiteralProperty', 'typeProperty'],
    format: null,
    modifiers: ['requiresQuotes']
  },
  {
    selector: 'objectLiteralProperty',
    format: null,
    filter: { regex: '[-./]', match: true }
  }
];

export default tseslint.config(
  {
    ignores: ['lib/**', 'node_modules/**', 'artifacts/**', '.evidence/**', '.delivery/**']
  },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true }
      }
    },
    rules: {
      '@typescript-eslint/naming-convention': naming,
      complexity: ['error', { max: 55 }],
      'max-lines': ['error', { max: 955, skipBlankLines: false, skipComments: false }],
      // Core rule false-positives on types; @typescript-eslint/no-unused-vars stays error.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          ignoreRestSiblings: true
        }
      ]
    }
  },
  {
    files: ['src/client/markdown/**/*.{ts,tsx}', 'src/client/native/**/*.{ts,tsx}'],
    rules: {
      // Upstream micromark tokenizers bind `this` to a local on purpose.
      '@typescript-eslint/no-this-alias': 'off'
    }
  }
);
