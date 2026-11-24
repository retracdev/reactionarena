/*
 * Builds everything link previews need:
 *
 *   test/<id>/index.html, leaderboards/index.html   share pages with their own cards
 *   the Open Graph block in index.html               the home page's card
 *   assets/social/*.jpg                              the 1200×630 card images
 *
 * Card images are rendered with a locally installed Chrome (or Edge) through playwright-core,
 * the same way Simple Soundboard does it. Pass --pages-only to skip the images.
 *
 *   npm run build:social
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CARDS_DIR, META_END, META_START, homeMetaBlock, sharePageHtml, sharePages } from './social/pages.mjs';
import { cardHtml } from './social/card.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagesOnly = process.argv.includes('--pages-only');

function write(rel, contents) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
  console.log(`  wrote ${rel}`);
}

// Share pages, plus the home page's tags in index.html.
const pages = sharePages();
for (const page of pages) {
  if (page.file === 'index.html') {
    const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const start = index.indexOf(`  ${META_START}`);
    const end = index.indexOf(META_END);
    if (start < 0 || end < 0) throw new Error('index.html is missing the social:start / social:end markers');
    const next = index.slice(0, start) + homeMetaBlock() + index.slice(end + META_END.length);
    if (next !== index) write('index.html', next);
    continue;
  }
  write(page.file, sharePageHtml(page));
}

if (pagesOnly) process.exit(0);

// Card images.
const { chromium } = await import('playwright-core');
let browser = null;
for (const channel of ['chrome', 'msedge', undefined]) {
  try {
    browser = await chromium.launch({ channel, headless: true });
    break;
  } catch {
    // Try the next browser.
  }
}
if (!browser) throw new Error('Rendering cards needs Chrome or Edge installed.');

try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  for (const share of pages) {
    await page.setContent(cardHtml(share.card), { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(ROOT, CARDS_DIR, share.image);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
    console.log(`  rendered ${CARDS_DIR}/${share.image}`);
  }
} finally {
  await browser.close();
}
