import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const repository = process.env.GITHUB_REPOSITORY?.split('/')[1];
const isUserPage = repository?.endsWith('.github.io');

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || (repository && !isUserPage ? `/${repository}/` : '/'),
  build: { rollupOptions: { output: { manualChunks: { formulas: ['katex'], editor: ['mathlive'] } } } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
