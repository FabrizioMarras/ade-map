import { describe, expect, it } from 'vitest';
import { parseEventPage } from '../../scripts/fetch-event-pages.mjs';
import { normaliseAddress, validHit } from '../../scripts/geocode.mjs';

describe('address normalisation', () => {
  it.each([
    ['NDSM Plein 102, Amsterdam', '', 'NDSM Plein 102, Amsterdam'],
    ['2 Linnaeusstraat, Amsterdam', '', 'Linnaeusstraat 2, Amsterdam'],
    ['Rhoneweg, 6, Amsterdam', '', 'Rhoneweg 6, Amsterdam'],
    ['Camperstraat, 26 h, Amsterdam', '', 'Camperstraat 26h, Amsterdam'],
    ['Paradiso, Weteringschans 6-8, Amsterdam', 'Paradiso', 'Weteringschans 6-8, Amsterdam'],
    ['Singel, Amsterdam', '', null],
  ])('%s → %s', (input, venue, expected) => {
    expect(normaliseAddress(input, venue)).toBe(expected);
  });
});

describe('geocode validation', () => {
  const doc = (name: string, point: string) => ({ weergavenaam: name, centroide_ll: point });
  it('accepts a matching street inside Amsterdam', () => {
    expect(
      validHit(
        'NDSM Plein 102, Amsterdam',
        doc('NDSM-plein 102, 1033WB Amsterdam', 'POINT(4.89694778 52.39959633)'),
      ),
    ).toEqual({ lat: 52.39959633, lng: 4.89694778, geo: 'NDSM-plein 102, 1033WB Amsterdam' });
  });
  it('rejects another street or a point outside the box', () => {
    expect(
      validHit('Rhoneweg 6, Amsterdam', doc('Kalverstraat 1, Amsterdam', 'POINT(4.89 52.37)')),
    ).toBeNull();
    expect(
      validHit('Hemkade 48, Amsterdam', doc('Hemkade 48, 1506PS Zaandam', 'POINT(4.80 52.46)')),
    ).toBeNull();
  });
});

describe('event page parser', () => {
  const html = `<html><head><meta property="og:image" content="https://cdn/x.webp"></head><body><main>
    <a class="link link__line-up" href="/a/1/">DJ One (NL)</a><a class="link link__line-up" href="/a/2/">DJ Two</a>
    <a class="link link__line-up" href="/a/2/">DJ Two</a>
    <a class="ade-info-bar__data-link" href="https://www.amsterdam-dance-event.nl/en/venues/paradiso/1576/">Paradiso</a>
    <a class="ade-info-bar__data-link" href="https://www.google.com/maps/search/?api=1&query=x">Weteringschans 6-8, Amsterdam</a>
    <a class="ade-info-bar__data-link" href="/filter/?category=1">House</a> / <a class="ade-info-bar__data-link" href="/filter/?category=2">Techno</a>
    <a class="ade-info-bar__data-link" href="/filter/?category=1">House</a>
    <a class="ade-button ade-info-bar__button" href="https://tickets/x"><span><?xml version="1.0"?><svg></svg></span> Buy Tickets </a>
    <p>DJ One (NL) / DJ Two</p>
    <p>A long description line that is clearly longer than forty characters.<br/>Second sentence here.</p>
  </main></body></html>`;

  it('extracts every field', () => {
    expect(parseEventPage(html)).toEqual({
      venueId: '1576',
      venueUrl: 'https://www.amsterdam-dance-event.nl/en/venues/paradiso/1576/',
      venueName: 'Paradiso',
      address: 'Weteringschans 6-8, Amsterdam',
      lineup: ['DJ One (NL)', 'DJ Two'],
      ticketUrl: 'https://tickets/x',
      ticketText: 'Buy Tickets',
      tags: ['House', 'Techno'],
      image: 'https://cdn/x.webp',
      description:
        'A long description line that is clearly longer than forty characters. Second sentence here.',
    });
  });
});
