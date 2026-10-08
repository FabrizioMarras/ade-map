import type { AdeEvent } from './types';

/**
 * iCalendar (RFC 5545) export of starred parties. Times are Amsterdam wall-clock times with
 * TZID=Europe/Amsterdam and a VTIMEZONE, so calendars place them right in any time zone.
 */

const TZ = 'Europe/Amsterdam';

// Central European Time with EU summer time rules.
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${TZ}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
];

/** Wall-clock ms (as used throughout the app) → "20261023T183000". */
export function icsLocal(wall: number): string {
  return new Date(wall).toISOString().slice(0, 19).replace(/[-:]/g, '');
}

/** UTC instant → "20261008T101500Z". */
export function icsUtc(date: Date): string {
  return date.toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

/** Escape text values (RFC 5545 §3.3.11). */
export function icsText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Fold lines longer than 75 octets (UTF-8), continuation lines start with a space. */
export function fold(line: string): string {
  const bytes = new TextEncoder();
  if (bytes.encode(line).length <= 75) return line;
  const out: string[] = [];
  let cur = '';
  for (const ch of line) {
    const limit = out.length ? 74 : 75; // continuation lines spend one octet on the space
    if (bytes.encode(cur + ch).length > limit) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function eventsToIcs(events: AdeEvent[], now = new Date(), host = 'fabriziomarras.github.io'): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FM Consulting//ADE 2026 Map//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:ADE 2026 · My list',
    `X-WR-TIMEZONE:${TZ}`,
    ...VTIMEZONE,
  ];
  for (const e of [...events].sort((a, b) => a.startMs - b.startMs)) {
    const location = [e.venue.name, e.venue.address].filter(Boolean).join(', ');
    const description = [e.subtitle, e.lineup.length ? `Line-up: ${e.lineup.join(', ')}` : '', e.url]
      .filter(Boolean)
      .join('\n');
    lines.push(
      'BEGIN:VEVENT',
      `UID:ade2026-${e.id}@${host}`,
      `DTSTAMP:${icsUtc(now)}`,
      `DTSTART;TZID=${TZ}:${icsLocal(e.startMs)}`,
      `DTEND;TZID=${TZ}:${icsLocal(e.endMs)}`,
      `SUMMARY:${icsText(e.title)}`,
      `LOCATION:${icsText(location)}`,
      `DESCRIPTION:${icsText(description)}`,
      `URL:${e.url}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** Offer the calendar as a file download (on phones this opens the calendar import). */
export function downloadIcs(text: string, filename = 'ade-2026-my-list.ics') {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
