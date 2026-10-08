import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toastTimeout } from '../../src/lib/store.svelte';

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? sources(p) : /\.(ts|svelte)$/.test(n) ? [p] : [];
  });
}

describe('messages', () => {
  it('toasts stay 4 s, or 7 s when the text is longer than 60 characters', () => {
    expect(toastTimeout('Link copied')).toBe(4000);
    expect(toastTimeout('x'.repeat(60))).toBe(4000);
    expect(toastTimeout('x'.repeat(61))).toBe(7000);
  });

  it('never uses the browser prompt/alert/confirm dialogs', () => {
    const offenders = sources('src').filter((f) =>
      /(?<![\w.])(window\.)?(prompt|alert|confirm)\s*\(/.test(readFileSync(f, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
