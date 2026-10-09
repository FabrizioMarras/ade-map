import { describe, expect, it } from 'vitest';
import {
  MAX_QUERY,
  MAX_WORDS,
  TICKETSWAP_SEARCH,
  ticketswapQuery,
  sellsTickets,
  ticketswapUrl,
} from '../../src/lib/ticketswap';
import { data } from './fixture';

describe('ticketswapQuery', () => {
  it.each([
    // [title, venue, subtitle, expected]
    ['SYNTROPY - Design The Future of Sound (Day 1)', 'Bierfabriek', '', 'SYNTROPY'],
    ['Lobster invites Bisque, Kyra Khaldi [techno set]', 'BRET', '', 'Lobster invites Bisque'],
    ['WAX 100H LIVE RADIO @ STUDIO ZEEDIJK', 'Studio Zeedijk', '', 'WAX 100H LIVE RADIO'],
    [
      'LASTER presents KLOCKWORKS 20 YEARS at TILLATEC',
      'TILLATEC',
      '',
      'LASTER presents KLOCKWORKS 20 YEARS',
    ],
    ['POWER HIT RADIO — SUPPERCLUB @ ADE', 'SUPPER', '', 'POWER HIT RADIO'],
    ['Het Danspaleis - Huis van de Tijd ', 'Huis van de Tijd', '', 'Het Danspaleis'],
    ['PIV Tower Takeover | Loft', 'The Loft Amsterdam', '', 'PIV Tower Takeover'],
    ['DEEWEE: 2manydjs - ADE', 'Paradiso', '', 'DEEWEE'],
    // TicketSwap needs every word to match: the core name only (seen on a phone, Oct 2026).
    ['Swan Lake Remixed for ADE - Extra show', 'Royal Theatre Carré', '', 'Swan Lake Remixed'],
    ['Techno Kitchen ADE 2026 Showcase', 'X', '', 'Techno Kitchen'],
    ['Night Fever Extra Show', 'X', '', 'Night Fever'],
    ['Awakenings Day 2', 'Gashouder', '', 'Awakenings'],
    ['SONA Presents: Reznik', 'X', '', 'SONA Reznik'],
    ['Copacabana Club with Mary Olivetti & Marcos Tocae', 'X', '', 'Copacabana Club'],
    [
      'Cord Room x Interzeak x Noxpax x Hostile Takeover - Studio Room',
      'X',
      '',
      'Cord Room x Interzeak x Noxpax',
    ],
    ['Música Que Não Toca Por Aí', 'X', '', 'Música Que Não Toca Por Aí'],
    ['Night Shift - Warehouse Edition', 'X', 'Warehouse Edition', 'Night Shift'],
    ['THE ROOM ®', 'Palladium Amsterdam', '', 'THE ROOM'],
    ['🔥 Fuego 🔥 Night ✨', 'Club', '', 'Fuego Night'],
    ['Bordello Aperitivo', 'Bordello Aperitivo', '', 'Bordello Aperitivo'],
  ])('%s → %s', (title, venue, subtitle, expected) => {
    expect(ticketswapQuery(title, { venue, subtitle })).toBe(expected);
  });

  it('keeps accents and punctuation inside the name (URL-encoded later)', () => {
    expect(ticketswapQuery('Ciara Cuvé & Friends! Ünïcode Nacht')).toBe(
      'Ciara Cuvé & Friends! Ünïcode Nacht',
    );
  });

  it('caps very long titles to a few words', () => {
    const long =
      'No One Vinyl Release: Queer Sounds from Philadelphia by Kevin JZ Prodigy, DJ Delish, Precolumbian, and local talents';
    const q = ticketswapQuery(long);
    expect(q.length).toBeLessThanOrEqual(MAX_QUERY);
    expect(long.startsWith(q)).toBe(true);
    expect(q.endsWith(' ')).toBe(false);
    expect(q).toBe('No One Vinyl Release');
    expect(q.split(' ').length).toBeLessThanOrEqual(MAX_WORDS);
  });

  it('never returns an empty query', () => {
    expect(ticketswapQuery('(TBA)', { venue: 'Paradiso' })).toBe('Paradiso');
    expect(ticketswapQuery('🎉', { venue: 'Shelter' })).toBe('Shelter');
  });

  it('gives every real party a non-empty query of bounded length', () => {
    for (const e of data.events) {
      const q = ticketswapQuery(e.title, { venue: e.venue.name, subtitle: e.subtitle });
      expect(q.length, e.title).toBeGreaterThan(0);
      expect(q.length, e.title).toBeLessThanOrEqual(MAX_QUERY);
    }
  });
});

describe('ticketswapUrl', () => {
  it('builds an encoded search URL', () => {
    expect(ticketswapUrl({ title: 'Café & Co (Live)', venue: { name: 'Paradiso' } })).toBe(
      TICKETSWAP_SEARCH + 'Caf%C3%A9%20%26%20Co',
    );
  });
  it('prefers a URL set in the data', () => {
    const url = 'https://www.ticketswap.com/event/deewee-at-paradiso/abc';
    expect(ticketswapUrl({ title: 'DEEWEE', ticketswapUrl: url })).toBe(url);
  });
});

describe('sellsTickets (the "Resale on TicketSwap" link)', () => {
  const ev = (ticketText: string | null, ticketUrl: string | null = 'https://t.example', free = false) => ({
    ticketText,
    ticketUrl,
    free,
  });
  it('is shown for parties with a ticket link', () => {
    expect(sellsTickets(ev('Buy Tickets'))).toBe(true);
  });
  it('is hidden for free, RSVP-only and ticketless parties', () => {
    expect(sellsTickets(ev('RSVP'))).toBe(false);
    expect(sellsTickets(ev('Free'))).toBe(false);
    expect(sellsTickets(ev('Buy Tickets', 'https://t.example', true))).toBe(false);
    expect(sellsTickets(ev(null, null))).toBe(false);
  });
});
