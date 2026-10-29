import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'scripts/playtest/**/*.test.ts'],
    testTimeout: 120000,
  },
});
