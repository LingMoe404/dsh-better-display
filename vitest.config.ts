import { defineConfig } from 'vitest/config'

// Browser *.tsx files are pinned Harness fixtures, not vitest tests.
const browserFixtures = [
  'tests/browser-*.tsx',
  'tests/fixtures/**',
]

// Vitest 5 replaces the default exclude when a project sets its own, so keep
// the defaults beside the fixture globs.
const testExclude = [
  '**/node_modules/**',
  '**/.git/**',
  ...browserFixtures,
]

export default defineConfig({
  test: {
    fileParallelism: true,
    retry: 0,
    // Flag tests slower than half a second. CI runs the verbose reporter so each duration is visible.
    slowTestThreshold: 500,
    // No root include. Vitest 5 concatenates inherited include arrays, which
    // would pull every unit file into the browser-runtime project.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}', 'tools/**/*.js'],
      exclude: [...browserFixtures, '**/*.d.ts'],
      reporter: ['text', 'json-summary'],
      // Measured v8 totals: statements 25.53, branches 24.01, functions 21.77, lines 26.98.
      // Thresholds are those integers minus one point.
      thresholds: {
        statements: 24,
        branches: 23,
        functions: 20,
        lines: 25,
      },
    },
    projects: [
      {
        test: {
          name: 'unit',
          include: ['tests/**/*.test.ts'],
          exclude: [...testExclude, 'tests/reader-official-users.test.ts'],
          retry: 0,
          fileParallelism: true,
        },
      },
      {
        // This file already skips when the pinned Chromium runtime or the
        // Harness source tree is missing. With the runtime present, the
        // headless launch failed once in this worktree and passed on the next
        // try, so only this project uses retry 1. Unit tests stay at retry 0.
        test: {
          name: 'browser-runtime',
          include: ['tests/reader-official-users.test.ts'],
          exclude: testExclude,
          retry: 1,
          fileParallelism: true,
        },
      },
    ],
  },
})
