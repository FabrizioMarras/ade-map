import { afterEach, describe, expect, it, vi } from 'vitest';
import { UA, adeRequestCount, get } from '../../scripts/lib.mjs';

describe('requests to the ADE site', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('send the identifying User-Agent and are counted, retries included', async () => {
    const statuses = [503, 200, 200];
    const fetch = vi.fn(async () => new Response('', { status: statuses.shift() }));
    vi.stubGlobal('fetch', fetch);
    vi.useFakeTimers();
    const before = adeRequestCount();

    const list = get('https://www.amsterdam-dance-event.nl/api/program/filter/?page=1');
    await vi.runAllTimersAsync(); // the retry back-off
    expect((await list).status).toBe(200);
    await get('https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=x'); // not ADE: not counted
    vi.useRealTimers();

    expect(adeRequestCount() - before).toBe(2);
    expect(UA).toBe(
      'ADE2026-Map/1.0 (unofficial fan map; https://fabriziomarras.github.io/ade-map/; contact@fmconsulting.dev)',
    );
    for (const [, init] of fetch.mock.calls as unknown as [string, RequestInit][])
      expect((init.headers as Record<string, string>)['User-Agent']).toBe(UA);
  });
});
