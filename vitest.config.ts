import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'text', 'lcov'],
      reportsDirectory: './coverage',
      // Escopo do gate: lógica de negócio (lib) + boundary de API.
      include: ['lib/**/*.ts', 'app/api/**/*.ts'],
      // Shim de tipos não tem código executável.
      exclude: ['lib/**/*.d.ts'],
      thresholds: { lines: 100, functions: 100, branches: 100, statements: 100 },
    },
  },
});
