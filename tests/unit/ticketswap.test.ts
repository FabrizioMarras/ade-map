import { describe, expect, it } from 'vitest';
import { MAX_QUERY, TICKETSWAP_SEARCH, ticketswapQuery, ticketswapUrl } from '../../src/lib/ticketswap';
import { data } from './fixture';

describe('ticketswapQuery', () => {
  it.each([
    // [title, venue, subtitle, expected]
    [
      'SYNTROPY - Design The Future of Sound (Day 1)',
      'Bierfabriek',
      '',
      'SYNTROPY Design The Future of Sound',
    ],
    ['Lobster invites Bisque, Kyra Khaldi [techno set]', 'BRET', '', 'Lobster invites Bisque, Kyra Khaldi'],
    ['WAX 100H LIVE RADIO @ STUDIO ZEEDIJK', 'Studio Zeedijk', '', 'WAX 100H LIVE RADIO'],
    [
      'LASTER presents KLOCKWORKS 20 YEARS at TILLATEC',
      'TILLATEC',
      '',
      'LASTER presents KLOCKWORKS 20 YEARS',
    ],
    ['POWER HIT RADIO — SUPPERCLUB @ ADE', 'SUPPER', '', 'POWER HIT RADIO SUPPERCLUB'],
    ['Het Danspaleis - Huis van de Tijd ', 'Huis van de Tijd', '', 'Het Danspaleis'],
    ['PIV Tower Takeover | Loft', 'The Loft Amsterdam', '', 'PIV Tower Takeover Loft'],
    ['DEEWEE: 2manydjs - ADE', 'Paradiso', '', 'DEEWEE: 2manydjs'],
    ['Night Shift - Warehouse Edition', 'X', 'Warehouse Edition', 'Night Shift'],
    ['THE ROOM ®', 'Palladium Amsterdam', '', 'THE ROOM'],
    ['🔥 Fuego 🔥 Night ✨', 'Club', '', 'Fuego Night'],
    ['Bordello Aperitivo', 'Bordello Aperitivo', '', 'Bordello Aperitivo'],
  ])('%s → %s', (title, venue, subtitle, expected) => {
    expect(ticketswapQuery(title, { venue, subtitle })).toBe(expected);
  });

  it('keeps accents and punctuation inside the name (URL-encoded later)', () => {
    expect(ticketswapQuery('Ciara Cuvé & Friends: Ünïcode Nacht!')).toBe(
      'Ciara Cuvé & Friends: Ünïcode Nacht!',
    );
  });

  it('caps very long titles at a word boundary', () => {
    const long =
      'No One Vinyl Release: Queer Sounds from Philadelphia by Kevin JZ Prodigy, DJ Delish, Precolumbian, and local talents';
    const q = ticketswapQuery(long);
    expect(q.length).toBeLessThanOrEqual(MAX_QUERY);
    expect(long.startsWith(q)).toBe(true);
    expect(q.endsWith(' ')).toBe(false);
    expect(q).toBe('No One Vinyl Release: Queer Sounds from Philadelphia by');
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
