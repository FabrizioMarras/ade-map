<script lang="ts">
  import Icon from '../../ui/Icon.svelte';

  // Links are relative to /insights/help/: Insights is one level up, the map two.
  const INSIGHTS = '../';
  /** The JSON the Insights page loads (`../data/insights.json` from /insights/). */
  const RAW = '../../data/insights.json';
</script>

<header class="bar">
  <div class="bar-row">
    <a class="back" href={INSIGHTS} aria-label="Back to Insights"><Icon name="back" size={18} />Back</a>
    <h1><span>ADE</span>Insights guide</h1>
  </div>
  <nav class="toc" aria-label="Sections">
    <a href="#what">What it is</a><a href="#charts">The six charts</a><a href="#method">Method</a><a
      href="#caveats">Caveats</a
    ><a href="#use">Using it</a>
  </nav>
</header>

<main class="wrap">
  <div class="intro">
    <p>
      Insights shows how ADE 2026 spreads across Amsterdam and across the week: when the city is busiest,
      which neighbourhoods carry the night, how genres cluster, how much is free. It is computed from the same
      programme the map uses and refreshed with it.
    </p>
    <span class="unofficial">Unofficial · derived from ADE's public programme</span>
  </div>

  <section id="what">
    <h2>What it is<small>And who it is for</small></h2>
    <p>
      The map answers "where do I go tonight?". Insights answers the organiser's questions: where the
      programme is dense and where it is thin, which hours are saturated, how the free arts-and-culture
      programme sits next to the paid clubs. Every chart has one sentence under it written from the numbers,
      so you can read the page in two minutes and dig into a chart when something surprises you.
    </p>
    <p>
      Numbers update automatically: the "Programme as of" line at the top is the time of the last refresh of
      ADE's programme, every two hours during the festival.
    </p>
  </section>

  <section id="charts">
    <h2>The six charts<small>How to read each one, in page order</small></h2>

    <div class="step">
      <div class="fig"><Icon name="pulse" size={34} /></div>
      <div>
        <h3>Parties live, hour by hour</h3>
        <p>
          One line across the whole week, from Wednesday 12:00 to Monday 08:00, one point per hour: how many
          parties are running at that moment (not starting: running). The peaks are the nights, the dips the
          mornings. Drag across the chart, tap it or use the arrow keys for the exact count at each hour;
          during the festival an orange marker shows "now". The sentence names the overall peak and the
          quietest day;
          <span class="ui">Show table</span> lists every hour.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="pin" size={34} /></div>
      <div>
        <h3>Where the parties are at 23:00</h3>
        <p>
          A snapshot at prime time, each night: a table with one row per neighbourhood and one column per day,
          shaded by how many parties are live there at 23:00. The ten neighbourhoods are Centrum, Jordaan, De
          Pijp, Oost, Noord, NDSM, Westerpark, Sloterdijk, Zuid and Zuidoost. Dark cells mean concentration;
          the sentence tells you whether the same neighbourhood leads every night or the centre of gravity
          moves.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="clock" size={34} /></div>
      <div>
        <h3>Clusters: same half hour, same neighbourhood</h3>
        <p>
          The crowd-flow view. For three hotspots (within 1 km of Rembrandtplein, of Noord and of Zuidoost) it
          finds the half hour in which the most parties start, and shows that peak with its time and the
          hotspot's total for the week. Many simultaneous starts in one small area mean queues, full trams and
          ferries at the same time; the comparison between hotspots is the point.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="filter" size={34} /></div>
      <div>
        <h3>Genre mix by neighbourhood</h3>
        <p>
          A table with one row per neighbourhood and one column for each of the week's six most common genres,
          using the tags promoters give their parties on ADE. Each cell is the share of that neighbourhood's
          parties tagged with the genre (a party can carry several), shaded by size. It shows character rather
          than volume: a neighbourhood with few parties can still be sharply defined. The sentence names which
          genre leads where.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="ticket" size={34} /></div>
      <div>
        <h3>Free vs paid, by day</h3>
        <p>
          Per day, a bar split into free and paid parties. Free means ADE tags the party as a free festival
          event or a free arts-and-culture event; everything else counts as paid. The sentence and
          <span class="ui">Show table</span> give the free share as a percentage. Useful for seeing where the open,
          accessible programme sits in the week.
        </p>
      </div>
    </div>
    <div class="step">
      <div class="fig"><Icon name="map" size={34} /></div>
      <div>
        <h3>Venue size, by day</h3>
        <p>
          The mix of intimate, mid-size, large venues and warehouses per day, from ADE's own venue-size tags.
          Only venues ADE has tagged are in the bars; the rest are shown as "untagged" next to each day, and
          the sentence states what share of parties is tagged, so you know how complete the picture is.
        </p>
      </div>
    </div>
  </section>

  <section id="method">
    <h2>Method<small>The definitions behind the numbers</small></h2>
    <ul class="meth">
      <li>
        <b>Live</b> means from a party's published start until its end. Parties without a published end count for
        six hours.
      </li>
      <li>
        <b>Day</b> is the calendar day a party starts on, as ADE lists it; a 01:00 Sunday party counts for Sunday.
      </li>
      <li>
        <b>Neighbourhood</b>: each venue is assigned to the nearest of ten neighbourhood centres, the same
        labels shown on the map. Boundaries are therefore approximate, especially between Centrum and Jordaan.
      </li>
      <li>
        <b>Genre, size, free</b> come from the tags promoters set on ADE; nothing is guessed. A party without a
        free tag counts as paid, one at a venue without a size tag is shown as untagged, and genre shares are of
        all the neighbourhood's parties, tagged or not.
      </li>
      <li>
        <b>Hotspot clusters</b> use straight-line distance (1 km) from a fixed point and 30-minute bins on start
        times (:00–:29 and :30–:59).
      </li>
    </ul>
  </section>

  <section id="caveats">
    <h2>Caveats<small>What this does not tell you</small></h2>
    <p>
      It counts parties, not people: a 5,000-capacity hall and a record shop in-store each count once.
      Sold-out status is not part of these charts. A handful of ADE listings are duplicates or installations
      running all day, which inflates "live" counts slightly at a few venues (the ADE Lab Village at Westergas
      is the obvious one). The programme changes daily until the festival, so numbers move; the "as of" line
      is your reference.
    </p>
  </section>

  <section id="use">
    <h2>Using it<small>Questions it answers well</small></h2>
    <p class="q">
      Where would one more venue help most on Saturday night? Which hours are over-programmed in the centre
      while Noord is quiet? How visible is the free programme on each day? Where will people be leaving at the
      same time?
    </p>
    <p>
      Each chart is drawn in your browser from the data, so you can screenshot it or print the page as it is.
      For the raw numbers behind a chart, the JSON the page loads is linked in the footer.
    </p>
    <a class="btn primary cta" href={INSIGHTS}><Icon name="pulse" />Back to the charts</a>
  </section>

  <footer>
    <p>
      Unofficial. Not affiliated with Amsterdam Dance Event. Programme data © Amsterdam Dance Event, personal
      planning only · Geocoding: PDOK Locatieserver · Map data ©
      <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors.
    </p>
    <p>Raw numbers: <a href={RAW}>insights.json</a>, the file the Insights page loads.</p>
    <p>Looking for the app guide instead? See <a href="../../help/">how to use the map</a>.</p>
    <p class="copyright">
      © {new Date().getFullYear()} FM Consulting ·
      <a href="https://fabriziomarras.com" target="_blank" rel="noopener">fabriziomarras.com</a>
    </p>
  </footer>
</main>
