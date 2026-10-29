import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Tests run against core sources; the build and smoke test exercise the compiled packages.
    alias: {
      '@wrpguard/core': fileURLToPath(new URL('./packages/core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
});
