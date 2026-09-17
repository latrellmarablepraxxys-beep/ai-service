import js from '@eslint/js';
import checkFile from 'eslint-plugin-check-file';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'logs/**',
      'package.json',
      'package-lock.json',
      'vitest.config.ts'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {allowDefaultProject: ['eslint.config.js'],},
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' }
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'warn',
      'no-console': 'off',
    },
  },
  {
    files: [
      'src/services/**/*.ts',
      'src/api/http/controllers/**/*.ts',
      'src/api/http/routers/**/*.ts',
      'src/api/http/validators/**/*.ts',
      'src/api/http/middleware/**/*.ts',
      'src/api/sse/**/*.ts',
      'src/persistence/**/*.ts',
      'src/enums/**/*.ts',
      'src/graph/**/*.ts',
      'src/prompts/**/*.ts',
    ],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.ts': 'PASCAL_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  {
    files: [
      'src/*.ts',
      'src/config/**/*.ts',
      'src/interfaces/**/*.ts',
      'src/utils/**/*.ts',
      'src/api/http/routes.ts',
      'scripts/**/*.ts',
      'tests/**/*.ts',
    ],
    plugins: { 'check-file': checkFile },
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        { '**/*.ts': 'CAMEL_CASE' },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
  prettier,
  {
    // Column-aligned style: multiline arrays/objects. Placed after
    // eslint-config-prettier so these rules stay enabled.
    rules: {
      'array-element-newline': [
        'error',
        'always',
        { minItems: 2 }
      ],
      'object-curly-newline': [
        'error',
        {
          ObjectExpression: {
            multiline: true,
            minProperties: 2
          },
          ObjectPattern: {
            multiline: true,
            minProperties: 2
          },
          ImportDeclaration: {
            multiline: true,
            minProperties: 3
          },
          ExportDeclaration: {
            multiline: true,
            minProperties: 3
          },
        },
      ],
      'object-property-newline': [
        'error',
        { allowAllPropertiesOnSameLine: false }
      ],
      'array-bracket-newline': [
        'error',
        {
          multiline: true,
          minItems: 2
        }
      ],
      indent: [
        'error',
        2,
        { SwitchCase: 1 }
      ],
    },
  },
);