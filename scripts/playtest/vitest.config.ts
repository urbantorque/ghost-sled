// Vitest config for the play-test harness's own checks (scripts/playtest/*.test.ts):
//   npx vitest run -c scripts/playtest/vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    include: ['scripts/playtest/**/*.test.ts'],
    testTimeout: 180000,
  },
});
