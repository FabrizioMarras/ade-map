import { describe, expect, it } from 'vitest';
import { normaliseTicketUrl, ticketLink, validTicketOverride } from '../../scripts/tickets.mjs';

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
