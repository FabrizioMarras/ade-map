<script lang="ts">
  import Icon from '../ui/Icon.svelte';

  // Links are relative to /help/: the map is one level up.
  const MAP = '../';
</script>

<header class="bar">
  <div class="bar-row">
    <a class="back" href={MAP}><Icon name="back" size={18} />Map</a>
    <h1><span>ADE</span>Map guide</h1>
  </div>
  <nav class="toc" aria-label="Sections">
    <a href="#find">Find a party</a><a href="#narrow">Day &amp; filters</a><a href="#area">Area</a><a
      href="#night">My night</a
    ><a href="#onthenight">On the night</a><a href="#pulse">Pulse</a><a href="#data">About the data</a>
  </nav>
</header>

<main class="wrap">
  <div class="intro">
    <p>
      Every ADE 2026 festival party on one map of Amsterdam, 21–25 October. Tap a pin to see what's on, build
      your night, and find a plan B when the queue is too long.
    </p>
    <span class="unofficial">Unofficial · built from ADE's public programme</span>
  </div>

  <section id="find">
    <h2>Find a party<small>The map, the pins and what's behind them</small></h2>
    <div class="step">
      <div class="fig"><Icon name="pin" size={34} /><b class="count">3</b></div>
      <div>
        <h3>One pin per venue</h3>
        <p>
          A pin is a place, not a party. The number on it is how many parties are on there for the selected
          day (a pin without a number has one). Faded pins have nothing that matches your search or filters.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="list" size={34} /></div>
      <div>
        <h3>Tap a pin, then a party</h3>
        <p>
          The sheet at the bottom shows the venue, its address and that day's parties in order. Tap one for
          the full picture: time, line-up, genres, description, <span class="ui">ADE page</span>,
          <span class="ui">Add to calendar</span>, <span class="ui">Directions</span> and
          <span class="ui">Share</span>.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="ticket" size={34} /></div>
      <div>
        <h3>Tickets</h3>
        <p>
          The yellow button goes to the official shop. <span class="badge so">Sold out</span> parties show
          <span class="ui">Check TicketSwap</span> instead, which opens a TicketSwap search for that party
          (fan-to-fan resale, prices capped). Parties that still sell tickets also have a small
          <span class="ui">Resale on TicketSwap</span> link.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="pin" size={34} /><b class="count">3</b><i class="pin2"></i></div>
      <div>
        <h3>Several venues, one address</h3>
        <p>
          Some buildings house several venues (Rembrandtplein 17, the A'DAM tower). Tapping there first shows
          a short list of venues to pick from.
        </p>
      </div>
    </div>
  </section>

  <section id="narrow">
    <h2>Pick your day, narrow it down<small>Day chips, search, filters and the list</small></h2>
    <div class="step">
      <div class="fig"><span class="day-chip demo">Fri 23</span></div>
      <div>
        <h3>Day chips</h3>
        <p>
          <span class="ui">★ My list</span> for your starred parties, <span class="ui">Wed 21</span> to
          <span class="ui">Sun 25</span>, and <span class="ui">All</span>. A party belongs to the day it
          starts on, so a 01:00 Sunday party is under Sun 25 (and in Saturday's <em>After midnight</em>
          group). During the festival a <span class="ui">Now</span> chip appears before the days and shows only
          what is running or starts within the next two hours.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="search" size={34} /></div>
      <div>
        <h3>Search</h3>
        <p>
          Type a party, a venue or an artist. The map moves to the matches and the list shows them. Matching
          artists appear under <span class="ui">Artists</span> at the top of the list; tap one to see every set
          they play that week.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="filter" size={34} /><b class="count">2</b></div>
      <div>
        <h3>Filters</h3>
        <p>
          Genre, time of day, venue type, area and event type, plus <span class="ui">Free events only</span>.
          For sold-out parties you choose: <span class="ui">Show all</span>,
          <span class="ui">Hide sold out</span>, or <span class="ui">Sold out, check TicketSwap</span>, which
          keeps them visible with a <span class="badge rs">Sold out · TicketSwap</span> badge for when you're willing
          to hunt for a ticket.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="map" size={34} /></div>
      <div>
        <h3>List instead of map</h3>
        <p>
          Pull the sheet up and switch between the parties list (<span class="ico"
            ><Icon name="list" size={14} /></span
          >, by start hour, with an <em>After midnight</em> group for the late ones) and the venues list (<span
            class="ico"><Icon name="pin" size={14} /></span
          >). Tapping an item moves the map and opens it.
        </p>
      </div>
    </div>
  </section>

  <section id="area">
    <h2>Explore an area<small>Draw on the map</small></h2>
    <div class="step">
      <div class="fig"><Icon name="lasso" size={34} /></div>
      <div>
        <h3>Lasso or box</h3>
        <p>
          Tap the area tool on the right of the map, pick <span class="ui">Lasso</span> or
          <span class="ui">Box</span>, then draw around the part of town you care about with one finger (a
          second finger hands the gesture back to the map). The list shows every party inside your shape for
          the selected day; pins outside fade. Switch the day and the same shape is re-used.
          <span class="ui">Clear area</span> removes it.
        </p>
      </div>
    </div>
    <p class="tip"><b>Tip</b>On a laptop, hold shift and drag to draw a box.</p>
  </section>

  <section id="night">
    <h2>Build your night<small>Stars, My list, sharing and a route</small></h2>
    <div class="step">
      <div class="fig star"><Icon name="star" size={34} filled /></div>
      <div>
        <h3>Star what you like</h3>
        <p>
          Every card and detail has a star. Your stars are <span class="ui">★ My list</span>: grouped by day,
          with a note when two of them overlap. They are saved on this phone only.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="route" size={34} /></div>
      <div>
        <h3>Plan my night</h3>
        <p>
          In My list, <span class="ui">Plan my night</span> puts the starred parties of a day in order and
          draws the route on the map, with <span class="ui">Walk</span> or <span class="ui">Bike</span> times,
          a warning when a leg can't be made, a ferry note for Noord and NDSM (<span class="ui"
            >GVB ferry times</span
          >) and a <span class="ui">Night bus</span> hint when you leave after 00:30.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="share" size={34} /></div>
      <div>
        <h3>Share your plan</h3>
        <p>
          <span class="ui">Share list</span> sends a link that holds your whole list. Whoever opens it sees your
          parties on their own map and can keep them or just look. Every party and venue has a share button too.
          No account, no name, nothing stored anywhere but in the link.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="calendar" size={34} /></div>
      <div>
        <h3>Calendar, export, import</h3>
        <p>
          <span class="ui">Calendar (.ics)</span> adds your list to your phone's calendar.
          <span class="ui">Export list</span> and <span class="ui">Import list</span> move your stars between
          devices as a short text code. Tick <em>Remind me 30 minutes before each starred party</em> for a notification
          (most reliable on Android with the app installed).
        </p>
      </div>
    </div>
  </section>

  <section id="onthenight">
    <h2>On the night<small>When the plan falls apart</small></h2>
    <div class="step">
      <div class="fig"><span class="map-ctl planb demo"><span>Plan<br />B</span></span></div>
      <div>
        <h3>Plan B</h3>
        <p>
          Queue too long, party sold out, friends gone elsewhere? Tap <span class="ui y">Plan B</span>. It
          uses your location (or the map centre if that isn't available) and the time right now, and lists
          parties within a 15-minute walk that are running or start within the hour;
          <span class="badge free">Free</span>
          ones first. Sold-out parties stay in the list with a
          <span class="badge rs">Sold out · TicketSwap</span> badge. Nothing close? One tap widens it to 30 minutes.
          Outside the festival it previews Friday 23:30 so you can see how it works.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="locate" size={34} /></div>
      <div>
        <h3>Where am I</h3>
        <p>
          <span class="ui">Locate me</span> centres the map on you;
          <span class="ui">Zoom to fit results</span>
          shows everything that matches. The app never asks for your location until you tap Locate me or Plan B.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="phone" size={34} /></div>
      <div>
        <h3>Install it, use it offline</h3>
        <p>
          In Chrome on Android, choose <em>Install app</em> (or <em>Add to Home screen</em>). It opens full
          screen with its own icon. The whole programme works without signal; only the map background needs to
          have been seen once.
        </p>
      </div>
    </div>
    <p class="tip">
      <b>Tip</b>Dark mode is designed for the street at night; the sun/moon button in the top bar switches.
      The guide itself opens from the <span class="ui">?</span> button next to it.
    </p>
  </section>

  <section id="pulse">
    <h2>Pulse<small>The festival as a time-lapse</small></h2>
    <div class="step">
      <div class="fig"><Icon name="pulse" size={34} /></div>
      <div>
        <h3>Watch the city light up</h3>
        <p>
          Tap <span class="ui">Pulse</span> on the map controls. A timeline appears: drag it or press play and
          every venue glows when a party is on, grows with the number of parties and fades when they end. The
          strip under the slider is the heartbeat of the week: how many parties are live at each moment. Tap a
          lit venue to see what's on at that time; <span class="ui">Now</span> jumps to the present (during
          ADE).
          <span class="ui">Exit Pulse</span> brings the normal map back.
        </p>
      </div>
    </div>
  </section>

  <section id="data">
    <h2>About the data<small>What the app knows and what it can't</small></h2>
    <dl>
      <dt>Source</dt>
      <dd>
        ADE's public programme: 1,200+ festival parties at 300+ venues. The conference (ADE Pro) is not
        included.
      </dd>
      <dt>Freshness</dt>
      <dd>Refreshed automatically every two hours during the festival. The date in the footer says when.</dd>
      <dt>Sold out</dt>
      <dd>
        Means what ADE reports. Promoters update it with some delay, and a shop can be sold out while still
        selling lockers or tokens. If in doubt, TicketSwap is one tap away.
      </dd>
      <dt>Addresses</dt>
      <dd>Geocoded from the venue address; a few are placed by hand and may be off by about 50 m.</dd>
      <dt>Your data</dt>
      <dd>
        Stars and settings live only in this browser. There is no account, no tracking and nothing sent
        anywhere.
      </dd>
    </dl>
    <a class="btn primary cta" href={MAP}><Icon name="map" />Open the map</a>
  </section>

  <footer>
    <p>
      Unofficial. Not affiliated with Amsterdam Dance Event. Programme data © Amsterdam Dance Event, personal
      planning only · Geocoding: PDOK Locatieserver · Map data ©
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>
      contributors · Tiles: <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>.
    </p>
    <p>Reading the charts instead? See the <a href="../insights/help/">Insights guide</a>.</p>
    <p class="copyright">
      © {new Date().getFullYear()} FM Consulting ·
      <a href="https://fabriziomarras.com" target="_blank" rel="noopener">fabriziomarras.com</a>
    </p>
  </footer>
</main>
