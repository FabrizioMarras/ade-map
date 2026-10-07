// Renders the app icons from an inline SVG with Playwright (dev-only helper).
// Usage: node scripts/make-icons.mjs
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#ffd400"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 512})">
    <path d="M256 70c-82 0-148 64-148 146 0 104 148 226 148 226s148-122 148-226c0-82-66-146-148-146z" fill="#000"/>
    <text x="256" y="262" text-anchor="middle" font-family="Arial Narrow, Arial, Helvetica, sans-serif"
      font-weight="900" font-size="112" letter-spacing="-4" fill="#ffd400">ADE</text>
  </g>
</svg>`;

const targets = [
  { file: 'icon-192.png', size: 192, pad: 24 },
  { file: 'icon-512.png', size: 512, pad: 24 },
  { file: 'icon-maskable-512.png', size: 512, pad: 90 },
  { file: 'apple-touch-icon.png', size: 180, pad: 40 },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(
    `<style>html,body{margin:0}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${svg(t.pad)}`,
  );
  writeFileSync(`public/icons/${t.file}`, await page.screenshot({ type: 'png' }));
}
writeFileSync('public/icons/icon.svg', svg(24).trim() + '\n');
await browser.close();
console.log('icons written');
