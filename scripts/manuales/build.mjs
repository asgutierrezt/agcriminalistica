// Builds the free manuals (PDF) from their HTML sources into public/manuales/.
// Usage: node scripts/manuales/build.mjs   (needs Playwright + Chromium)
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../public/manuales');
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const name of ['manual-dactiloscopia', 'manual-identificacion-forense-de-la-voz']) {
  await page.goto(pathToFileURL(path.join(here, `${name}.html`)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: path.join(out, `${name}.pdf`), format: 'A4', printBackground: true, preferCSSPageSize: true });
  console.log(name, Math.round(fs.statSync(path.join(out, `${name}.pdf`)).size / 1024) + ' KB');
}
await browser.close();
