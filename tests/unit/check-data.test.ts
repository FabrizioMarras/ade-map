import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkData } from '../../scripts/check-data.mjs';

const GEN = '2026-10-09T10:05:59.439Z';
const venue = { id: 'v1', name: 'Paradiso', lat: 52.362, lng: 4.884 };
const event = { id: 1, venueId: 'v1', title: 'A party' };

/** A data directory with these files (objects are written as JSON, strings as they are). */
function dir(files: Record<string, unknown>) {
  const d = mkdtempSync(join(tmpdir(), 'ade-data-'));
  for (const [name, body] of Object.entries(files))
    writeFileSync(join(d, name), typeof body === 'string' ? body : JSON.stringify(body));
  return d;
}
const good = () => ({
  'ade-2026.meta.json': { generated: GEN, events: 1, venues: 1 },
  'ade-2026.core.json': { generated: GEN, venues: [venue], events: [event] },
  'ade-2026.text.json': { generated: GEN, descriptions: { 1: 'About' } },
});

describe('checkData (data-only deploy sanity check)', () => {
  it('passes a complete programme', () => {
    expect(checkData(dir(good()))).toEqual([]);
  });

  it('passes the snapshot on main', () => {
    expect(checkData('public/data')).toEqual([]);
  });

  it('rejects an empty programme', () => {
    const p = checkData(dir({ ...good(), 'ade-2026.meta.json': { generated: GEN, events: 0 } }));
    expect(p.join()).toMatch(/events is 0/);
  });

  it('rejects files that are missing or do not parse', () => {
    const files: Record<string, unknown> = good();
    delete files['ade-2026.text.json'];
    expect(checkData(dir(files)).join()).toMatch(/text\.json: missing/);
    expect(checkData(dir({ ...good(), 'ade-2026.core.json': '{"events": [' })).join()).toMatch(
      /core\.json: does not parse/,
    );
  });

  it('rejects events whose venue is unknown or has no coordinates', () => {
    const files = good();
    files['ade-2026.meta.json'].events = 2;
    files['ade-2026.core.json'] = {
      generated: GEN,
      venues: [venue, { id: 'v2', name: 'Nowhere', lat: null, lng: null }],
      events: [
        { ...event, venueId: 'v2' },
        { ...event, id: 2, venueId: 'gone' },
      ],
    } as never;
    expect(checkData(dir(files)).join()).toMatch(/2 events without a venue with coordinates: 1, 2/);
  });

  it('rejects core and meta files from different refreshes', () => {
    const files = good();
    files['ade-2026.core.json'].generated = '2026-10-08T10:36:55.223Z';
    expect(checkData(dir(files)).join()).toMatch(/core\.json generated/);
  });
});
