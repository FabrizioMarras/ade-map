// Ticket links as organisers type them into ADE: mostly full URLs, but also bare domains
// ("www.wax.radio", "www.mojo.nl/unreal") and plain text ("RSVP only", a name). The app opens
// the link as is, so a bare domain became a broken link on our own site.

const ADE = 'https://www.amsterdam-dance-event.nl';
const BARE_DOMAIN = /^(?:[a-z0-9-]+\.)+[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?$/i;

/** A usable https/http link, or null when the value isn't one. */
export function normaliseTicketUrl(raw) {
  const s = (raw ?? '').trim();
  if (!s) return null;
  let url = s;
  if (s.startsWith('//')) url = 'https:' + s;
  else if (s.startsWith('/'))
    url = ADE + s; // a path on the ADE site
  else if (!/^[a-z][a-z0-9+.-]*:/i.test(s)) {
    if (!BARE_DOMAIN.test(s)) return null; // plain text, not a link
    url = 'https://' + s;
  }
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    return url === s ? s : u.href; // full URLs stay exactly as ADE has them
  } catch {
    return null;
  }
}

/** A hand-set ticket link from manual-fixes.json: a full https URL only. */
export function validTicketOverride(raw) {
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * The ticket link a party gets: ADE's (cleaned up; the event page itself when it sells in
 * ADE's own shop), else a hand-set one from manual-fixes.json. ADE's wins once it has one.
 * `notes` explains anything to report: text that isn't a link, a bad or redundant override.
 */
export function ticketLink(event, details, fix = {}) {
  const notes = [];
  let ticketUrl = details.adeCart ? event.url : normaliseTicketUrl(details.ticketUrl);
  let ticketText = ticketUrl ? details.ticketText || 'Buy Tickets' : null;
  if (details.ticketUrl && !ticketUrl) notes.push({ kind: 'notALink', text: details.ticketUrl });
  if (fix.ticketUrl && !validTicketOverride(fix.ticketUrl))
    notes.push({ kind: 'badOverride', text: `ticketUrl is not an https URL: ${fix.ticketUrl}` });
  else if (fix.ticketUrl && ticketUrl)
    notes.push({ kind: 'redundantOverride', text: `ADE now links ${ticketUrl}` });
  else if (fix.ticketUrl) {
    ticketUrl = fix.ticketUrl;
    ticketText = fix.ticketText || (isRaUrl(fix.ticketUrl) ? 'Tickets on RA' : 'Buy Tickets');
  }
  return { ticketUrl, ticketText, notes };
}

const isRaUrl = (url) => /^https:\/\/([a-z]{2}\.)?ra\.co\//.test(url);
const RA_CLUB = /^https:\/\/ra\.co\/clubs\/\d+$/;

/** A raClubs / venueSites entry: the URL, or `{ name, url }` (the name helps whoever edits it). */
export const raClubUrl = (entry) => (typeof entry === 'string' ? entry : (entry?.url ?? null));
export const entryUrl = raClubUrl;

/** A venue's page on Resident Advisor ("https://ra.co/clubs/<n>"), as set in manual-fixes.json. */
export const validRaClub = (url) => RA_CLUB.test(url ?? '');

/** A venue's own agenda/tickets page: https, and not RA or ADE (those have their own rules). */
export function validVenueSite(url) {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !/(^|\.)(ra\.co|amsterdam-dance-event\.nl)$/.test(u.hostname);
  } catch {
    return false;
  }
}

/** The mapped URL for a venue, by its ADE id or the ids of duplicate records merged into it. */
function mappedFor(venue, map, valid) {
  for (const id of [venue.id, ...(venue.aliases ?? [])]) {
    const url = entryUrl(map[id]);
    if (url && valid(url)) return url;
  }
  return null;
}

/**
 * The RA club page for a venue. Parties at the venue without a ticket link point there when the
 * venue has no agenda page of its own: it lists what's on.
 */
export const raClubFor = (venue, raClubs) => mappedFor(venue, raClubs, validRaClub);

/** The venue's own agenda/tickets page: the first place to look for a party without a link. */
export const venueSiteFor = (venue, venueSites) => mappedFor(venue, venueSites, validVenueSite);

/** ADE's tags for free parties (same as FREE_TAGS in src/lib/facets.ts). */
export const FREE_TAGS = ['Free Festival Events', 'Free A&C Events'];

/**
 * Whether the app shows a button to get in for this party: a ticket link, TicketSwap (sold
 * out), free entry, or the venue's agenda or RA page. Parties without one are listed in the run
 * summary so a link can be set by hand.
 */
export function hasTicketButton(event, venue) {
  if (event.ticketUrl || event.soldOut) return true;
  if ((event.interests ?? []).some((t) => FREE_TAGS.includes(t))) return true;
  return !!(venue?.siteUrl || venue?.raUrl);
}
