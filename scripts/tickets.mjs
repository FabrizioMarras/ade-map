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
    ticketText = fix.ticketText || 'Buy Tickets';
  }
  return { ticketUrl, ticketText, notes };
}
