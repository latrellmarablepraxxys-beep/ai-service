import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (...segments: string[]): string => path.join(root, 'src', ...segments);

export default defineConfig({
  resolve: {
    alias: {
      '@api': src('api'),
      '@config': src('config'),
      '@enums': src('enums'),
      '@fakes': path.join(root, 'tests', 'fakes'),
      '@graph': src('graph'),
      '@interfaces': src('interfaces'),
      '@jobs': src('jobs'),
      '@persistence': src('persistence'),
      '@prompts': src('prompts'),
      '@services': src('services'),
      '@utils': src('utils'),
      '@src': src(),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'tests/**/*.test.ts',
      'src/**/*.test.ts'
    ],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    coverage: {
      provider: 'v8',
      reporter: [
        'text',
        'html'
      ],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.d.ts',
        'src/config/**',
        'src/interfaces/**',
        'scripts/**'
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80
      },
    },
  },
});
