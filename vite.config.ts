/// <reference types="vitest/config" />
import { createHash } from 'node:crypto';
import { readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

/** Static files from public/ that belong to the app shell (data is cached separately). */
function publicShellFiles(dir = 'public'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...publicShellFiles(p));
    else out.push(relative('public', p).split('\\').join('/'));
  }
  return out.filter((f) => !f.startsWith('data/') && !f.startsWith('.'));
}

/**
 * Builds src/sw.ts to /sw.js and injects the precache list (hashed assets + public
 * shell files) and a version derived from it.
 */
function serviceWorker(): Plugin {
  return {
    name: 'ade-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const sw = bundle['sw.js'];
      if (!sw || sw.type !== 'chunk') return;
      const files = [
        './',
        'index.html',
        ...Object.keys(bundle).filter((f) => f !== 'sw.js' && !f.endsWith('.map')),
        ...publicShellFiles(),
      ];
      const version = createHash('sha256').update(files.join('\n')).digest('hex').slice(0, 12);
      sw.code = sw.code
        .replace(/__PRECACHE__/g, JSON.stringify(files))
        .replace(/__VERSION__/g, JSON.stringify(version));
    },
  };
}

// Relative base so the build works from any GitHub Pages sub-path.
export default defineConfig({
  base: './',
  plugins: [svelte(), serviceWorker()],
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      input: { index: 'index.html', sw: 'src/sw.ts' },
      output: {
        entryFileNames: (chunk) => (chunk.name === 'sw' ? 'sw.js' : 'assets/[name]-[hash].js'),
      },
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
