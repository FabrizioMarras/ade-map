import { describe, expect, it } from 'vitest';
import { refreshDue } from '../../scripts/refresh-due.mjs';

/** Due at `now` (UTC ISO) for a programme generated `ageMin` minutes earlier? */
const due = (now: string, ageMin: number, manual = false) => {
  const at = new Date(now);
  return refreshDue({ generated: new Date(at.getTime() - ageMin * 60_000).toISOString(), now: at, manual })
    .due;
};

describe('refreshDue (staleness gate of the refresh workflow)', () => {
  it('before ADE week: refreshes a programme older than 20 h', () => {
    expect(due('2026-10-09T12:00:00Z', 19 * 60)).toBe(false);
    expect(due('2026-10-09T12:00:00Z', 20 * 60 + 1)).toBe(true);
    // The live data that went stale for a day when every scheduled run was skipped.
    expect(refreshDue({ generated: '2026-10-08T10:36:00Z', now: new Date('2026-10-09T12:00:00Z') }).due).toBe(
      true,
    );
  });

  it('19–26 Oct: refreshes a programme older than 2 h', () => {
    expect(due('2026-10-18T21:30:00Z', 180)).toBe(false); // Sun 18 Oct 23:30 Amsterdam: still daily
    expect(due('2026-10-18T22:30:00Z', 180)).toBe(true); // Mon 19 Oct 00:30 Amsterdam
    expect(due('2026-10-23T20:00:00Z', 91)).toBe(false); // the old 90-min limit no longer applies
    expect(due('2026-10-23T20:00:00Z', 119)).toBe(false);
    expect(due('2026-10-23T20:00:00Z', 121)).toBe(true);
    expect(due('2026-10-26T22:30:00Z', 121)).toBe(true); // Mon 26 Oct 23:30 Amsterdam (CET)
  });

  it('from 27 Oct: never, however old', () => {
    expect(due('2026-10-26T23:30:00Z', 10_000)).toBe(false); // Tue 27 Oct 00:30 Amsterdam
    expect(due('2026-11-15T12:00:00Z', 10_000)).toBe(false);
  });

  it('a manual run always goes ahead', () => {
    expect(due('2026-10-09T12:00:00Z', 5, true)).toBe(true);
    expect(due('2026-11-15T12:00:00Z', 5, true)).toBe(true);
  });

  it('refreshes when nothing has been published yet', () => {
    expect(refreshDue({ generated: null, now: new Date('2026-10-09T12:00:00Z') }).due).toBe(true);
    expect(refreshDue({ generated: 'garbage', now: new Date('2026-10-09T12:00:00Z') }).due).toBe(true);
  });
});
