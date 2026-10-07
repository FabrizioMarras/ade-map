/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
