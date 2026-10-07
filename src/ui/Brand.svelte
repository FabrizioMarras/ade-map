<!-- Always-visible credit in the top-right corner, above the top bar (which starts 22px
     lower to make room) and above the sheet. -->
<a
  class="brand"
  href="https://fabriziomarras.com"
  target="_blank"
  rel="noopener"
  title="FM Consulting · fabriziomarras.com"
>
  © {new Date().getFullYear()} FM Consulting
</a>

<style>
  .brand {
    position: fixed;
    z-index: 25;
    top: calc(var(--safe-top) + 3px);
    right: 4px;
    padding: 1px 7px;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 88%, transparent);
    color: var(--fg);
    font-size: 10px;
    font-weight: 600;
    line-height: 16px;
    letter-spacing: 0.02em;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 1px 3px rgb(0 0 0 / 0.15);
  }
  .brand:hover {
    text-decoration: underline;
  }
</style>
