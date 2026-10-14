import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FREE_TAGS as APP_FREE_TAGS } from '../../src/lib/facets';
import {
  FREE_TAGS,
  hasTicketButton,
  normaliseTicketUrl,
  raClubFor,
  raClubUrl,
  ticketLink,
  validRaClub,
  validTicketOverride,
  validVenueSite,
  venueSiteFor,
} from '../../scripts/tickets.mjs';

describe('normaliseTicketUrl', () => {
  it('keeps full URLs exactly as they are', () => {
    const u = 'https://shop.weeztix.com/abc/tickets?shop_code=x&a=%20b';
    expect(normaliseTicketUrl(u)).toBe(u);
    expect(normaliseTicketUrl('http://example.nl/t')).toBe('http://example.nl/t');
  });

  it.each([
    ['www.wax.radio', 'https://www.wax.radio/'],
    ['www.mojo.nl/unreal', 'https://www.mojo.nl/unreal'],
    ['  www.cafewu.nl ', 'https://www.cafewu.nl/'],
    ['ra.co/events/2000195', 'https://ra.co/events/2000195'],
    ['//tickets.example.com/x', 'https://tickets.example.com/x'],
    ['/en/tickets/', 'https://www.amsterdam-dance-event.nl/en/tickets/'],
  ])('adds the missing scheme: %s', (raw, url) => {
    expect(normaliseTicketUrl(raw)).toBe(url);
  });

  it.each(['RSVP only', 'Lovisa Andersson', 'mailto:rsvp@example.com', 'javascript:alert(1)', '', null])(
    'drops what is not a web link: %s',
    (raw) => {
      expect(normaliseTicketUrl(raw)).toBeNull();
    },
  );
});

describe('ticketLink', () => {
  const event = { id: 1, url: 'https://www.amsterdam-dance-event.nl/en/program/2026/x/1/' };
  const page = (ticketUrl = '', ticketText = '', adeCart = false) => ({ ticketUrl, ticketText, adeCart });
  const PARADISO = 'https://www.paradiso.nl/en/program/anjunadeep-amsterdam/2913607';

  it("uses ADE's link, cleaned up", () => {
    expect(ticketLink(event, page('www.wax.radio', 'RSVP'))).toEqual({
      ticketUrl: 'https://www.wax.radio/',
      ticketText: 'RSVP',
      notes: [],
    });
  });

  it("links the event page when the party sells in ADE's own shop", () => {
    expect(ticketLink(event, page('', 'Buy Tickets', true))).toMatchObject({
      ticketUrl: event.url,
      ticketText: 'Buy Tickets',
    });
  });

  it('reports text that is not a link, and shows no button for it', () => {
    expect(ticketLink(event, page('RSVP only', 'RSVP'))).toEqual({
      ticketUrl: null,
      ticketText: null,
      notes: [{ kind: 'notALink', text: 'RSVP only' }],
    });
  });

  it('uses a hand-set link when ADE has none', () => {
    expect(ticketLink(event, page(), { ticketUrl: PARADISO })).toEqual({
      ticketUrl: PARADISO,
      ticketText: 'Buy Tickets',
      notes: [],
    });
    expect(
      ticketLink(event, page(), { ticketUrl: PARADISO, ticketText: 'Tickets at Paradiso' }).ticketText,
    ).toBe('Tickets at Paradiso');
  });

  it("prefers ADE's link once it has one, and says the override can go", () => {
    const r = ticketLink(event, page('https://ra.co/events/1', 'Buy Tickets'), { ticketUrl: PARADISO });
    expect(r.ticketUrl).toBe('https://ra.co/events/1');
    expect(r.notes).toEqual([{ kind: 'redundantOverride', text: 'ADE now links https://ra.co/events/1' }]);
  });

  it('ignores a hand-set link that is not https', () => {
    const r = ticketLink(event, page(), { ticketUrl: 'www.paradiso.nl' });
    expect(r.ticketUrl).toBeNull();
    expect(r.notes[0].kind).toBe('badOverride');
    expect(validTicketOverride(PARADISO)).toBe(true);
    expect(validTicketOverride('http://paradiso.nl')).toBe(false);
  });
});

describe('Resident Advisor', () => {
  const event = { id: 1, url: 'https://www.amsterdam-dance-event.nl/en/program/2026/x/1/' };
  const none = { ticketUrl: '', ticketText: '', adeCart: false };

  it('a hand-set RA event link reads "Tickets on RA" unless a text is given', () => {
    expect(ticketLink(event, none, { ticketUrl: 'https://ra.co/events/2555504' }).ticketText).toBe(
      'Tickets on RA',
    );
    expect(ticketLink(event, none, { ticketUrl: 'https://nl.ra.co/events/2555504' }).ticketText).toBe(
      'Tickets on RA',
    );
    expect(
      ticketLink(event, none, { ticketUrl: 'https://ra.co/events/2555504', ticketText: 'Buy on RA' })
        .ticketText,
    ).toBe('Buy on RA');
  });

  it('finds the club page by venue id or the id of a merged duplicate', () => {
    const clubs = { '2590176': 'https://ra.co/clubs/12345', '77': 'https://ra.co/clubs/999' };
    expect(raClubFor({ id: '2590176' }, clubs)).toBe('https://ra.co/clubs/12345');
    expect(raClubFor({ id: '1', aliases: ['77'] }, clubs)).toBe('https://ra.co/clubs/999');
    expect(raClubFor({ id: '2' }, clubs)).toBeNull();
    // The form manual-fixes.json uses: the name only helps whoever edits the file.
    expect(raClubFor({ id: '1576' }, { '1576': { name: 'Paradiso', url: 'https://ra.co/clubs/2695' } })).toBe(
      'https://ra.co/clubs/2695',
    );
  });

  it('only accepts https://ra.co/clubs/<n>', () => {
    expect(validRaClub('https://ra.co/clubs/12345')).toBe(true);
    for (const bad of [
      'https://nl.ra.co/clubs/1',
      'https://ra.co/clubs/1/events',
      'https://ra.co/events/1',
      'ra.co/clubs/1',
    ])
      expect(validRaClub(bad)).toBe(false);
    expect(raClubFor({ id: '3' }, { '3': 'https://ra.co/events/1' })).toBeNull();
  });
});

describe('scripts/manual-fixes.json', () => {
  const fixes = JSON.parse(readFileSync('scripts/manual-fixes.json', 'utf8'));

  it('every RA club entry is a valid https://ra.co/clubs/<n> page', () => {
    for (const [id, entry] of Object.entries(fixes.raClubs ?? {}))
      expect(validRaClub(raClubUrl(entry)), `venue ${id}`).toBe(true);
  });

  it("every venue site is an https page on the venue's own site", () => {
    for (const [id, entry] of Object.entries(fixes.venueSites ?? {}))
      expect(validVenueSite(raClubUrl(entry)), `venue ${id}`).toBe(true);
  });

  it('every hand-set ticket link is https', () => {
    for (const [id, fix] of Object.entries<{ ticketUrl?: string }>(fixes.events ?? {}))
      if (fix.ticketUrl) expect(validTicketOverride(fix.ticketUrl), `event ${id}`).toBe(true);
  });
});

describe("venue's own agenda page", () => {
  const sites = { '1576': { name: 'Paradiso', url: 'https://www.paradiso.nl/en/program' } };

  it('is found by venue id or a merged duplicate id', () => {
    expect(venueSiteFor({ id: '1576' }, sites)).toBe('https://www.paradiso.nl/en/program');
    expect(venueSiteFor({ id: '9', aliases: ['1576'] }, sites)).toBe('https://www.paradiso.nl/en/program');
    expect(venueSiteFor({ id: '9' }, sites)).toBeNull();
  });

  it('must be https and not RA or ADE', () => {
    expect(validVenueSite('https://www.paradiso.nl/en/program')).toBe(true);
    for (const bad of [
      'http://www.paradiso.nl/',
      'https://ra.co/clubs/2695',
      'https://nl.ra.co/clubs/2695',
      'https://www.amsterdam-dance-event.nl/en/venues/paradiso/1576/',
      'www.paradiso.nl',
    ])
      expect(validVenueSite(bad), bad).toBe(false);
  });
});

describe('hasTicketButton (run summary: parties with no way in)', () => {
  const party = (o = {}) => ({ ticketUrl: null, soldOut: false, interests: ['House'], ...o });
  it('a ticket link, sold out (TicketSwap) or free entry counts', () => {
    expect(hasTicketButton(party({ ticketUrl: 'https://t.example' }), {})).toBe(true);
    expect(hasTicketButton(party({ soldOut: true }), {})).toBe(true);
    expect(hasTicketButton(party({ interests: ['Free Festival Events'] }), {})).toBe(true);
  });
  it("so does the venue's agenda or RA page", () => {
    expect(hasTicketButton(party(), { siteUrl: 'https://www.paradiso.nl/en/program' })).toBe(true);
    expect(hasTicketButton(party(), { raUrl: 'https://ra.co/clubs/2695' })).toBe(true);
  });
  it('otherwise none', () => {
    expect(hasTicketButton(party(), {})).toBe(false);
  });
  it('uses the same free tags as the app', () => {
    expect(new Set(FREE_TAGS)).toEqual(APP_FREE_TAGS);
  });
});
