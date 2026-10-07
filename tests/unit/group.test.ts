import { describe, expect, it } from 'vitest';
import { groupByHour, nextDay } from '../../src/lib/group';
import { data } from './fixture';

describe('groupByHour', () => {
  it('keeps every event and orders groups by time', () => {
    const fri = data.eventsByDay.get('2026-10-23')!;
    const groups = groupByHour(fri, false);
    expect(groups.reduce((n, g) => n + g.events.length, 0)).toBe(335);
    expect(groups.map((g) => g.label)).toEqual([...groups.map((g) => g.label)].sort());
    expect(groups[0].label).toMatch(/^\d\d:00$/);
  });

  it('labels with the day across days', () => {
    const groups = groupByHour(data.events.slice(0, 5), true);
    expect(groups[0].label).toMatch(/^Wed 21 · \d\d:00$/);
  });

  it('computes the next day', () => {
    expect(nextDay('2026-10-24')).toBe('2026-10-25');
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
  });
});
