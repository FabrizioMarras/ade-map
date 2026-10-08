import { describe, expect, it } from 'vitest';
import { dueReminders, reminderText } from '../../src/lib/reminders';
import { parseWall } from '../../src/lib/time';
import type { AdeEvent } from '../../src/lib/types';

const ev = (id: number, start: string) =>
  ({ id, title: `E${id}`, startMs: parseWall(start), venue: { name: 'Paradiso' } }) as AdeEvent;

describe('reminders', () => {
  const a = ev(1, '2026-10-23 23:00');
  const b = ev(2, '2026-10-23 23:20');
  const c = ev(3, '2026-10-24 01:00');

  it('are due from 30 minutes before the start until it starts', () => {
    const at = (t: string) => dueReminders([c, b, a], parseWall(t), new Set()).map((e) => e.id);
    expect(at('2026-10-23 22:29')).toEqual([]);
    expect(at('2026-10-23 22:30')).toEqual([1]);
    expect(at('2026-10-23 22:55')).toEqual([1, 2]);
    expect(at('2026-10-23 23:00')).toEqual([2]); // started: too late to remind
  });

  it('are sent once', () => {
    expect(dueReminders([a, b], parseWall('2026-10-23 22:55'), new Set([1])).map((e) => e.id)).toEqual([2]);
  });

  it('say how soon and where', () => {
    expect(reminderText(a, parseWall('2026-10-23 22:35'))).toEqual({
      title: 'E1',
      body: 'Starts in 25 min at Paradiso',
    });
  });
});
