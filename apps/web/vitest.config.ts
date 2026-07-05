import path from 'node:path';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      '@nurseconnect/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    include: [
      'src/app/**/*.test.{ts,tsx}',
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
    ],
  },
});
