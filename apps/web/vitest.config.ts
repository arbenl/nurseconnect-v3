import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/components/**/*.test.{ts,tsx}',
      'src/lib/**/*.test.{ts,tsx}',
      'src/hooks/**/*.test.{ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/out/**',
      '**/tests/emu/**',
      '**/*.emu.test.ts',
      '**/*.emu.test.tsx',
      'src/**/emu/',
      '**/*.db.test.ts',
      '**/*.db.test.tsx',
      'src/server/**',
      'src/app/api/**',
    ],
  },
});
