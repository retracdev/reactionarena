import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { CARDS_DIR, homeMetaBlock, sharePageHtml, sharePages } from '../scripts/social/pages.mjs';
import { GAMES } from '../js/games/index.js';
import { SITE, testShareUrl } from '../js/share.js';

const read = (rel) => fs.readFileSync(new URL(`../${rel}`, import.meta.url));
// Git may check text files out with CRLF line endings on Windows; compare content, not endings.
const readText = (rel) => read(rel).toString().split('\r\n').join('\n');

/** Width and height from a JPEG's start-of-frame marker. */
function jpegSize(buf) {
  assert.equal(buf.readUInt16BE(0), 0xffd8, 'not a JPEG');
  let i = 2;
  while (i < buf.length) {
    const marker = buf.readUInt16BE(i);
    const length = buf.readUInt16BE(i + 2);
    if (marker >= 0xffc0 && marker <= 0xffc3) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + length;
  }
  throw new Error('No frame header');
}

test('every test, the home page and the leaderboards have a share page', () => {
  const files = sharePages().map((p) => p.file);
  assert.deepEqual(files, ['index.html', 'leaderboards/index.html', ...GAMES.map((g) => `test/${g.id}/index.html`)]);
});

test('committed share pages and index.html tags are up to date (run `npm run build:pages`)', () => {
  for (const page of sharePages()) {
    if (page.file === 'index.html') {
      assert.ok(readText('index.html').includes(homeMetaBlock()), 'index.html social tags are stale');
    } else {
      assert.equal(readText(page.file), sharePageHtml(page), `${page.file} is stale`);
    }
  }
});

test('every card is a 1200×630 JPEG at an absolute URL', () => {
  for (const page of sharePages()) {
    assert.deepEqual(jpegSize(read(`${CARDS_DIR}/${page.image}`)), { width: 1200, height: 630 }, page.image);
    const html = page.file === 'index.html' ? homeMetaBlock() : sharePageHtml(page);
    assert.ok(html.includes(`<meta property="og:image" content="${SITE}/${CARDS_DIR}/${page.image}">`));
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  }
});

test('share pages send visitors to the matching place in the app', () => {
  for (const g of GAMES) {
    const html = readText(`test/${g.id}/index.html`);
    assert.ok(html.includes(`location.replace("/#/${g.id}")`));
    assert.ok(html.includes(`<meta http-equiv="refresh" content="0; url=/#/${g.id}">`));
    assert.ok(html.includes(`<meta property="og:url" content="${testShareUrl(g.id)}">`));
  }
  assert.ok(readText('leaderboards/index.html').includes('location.replace("/#/leaderboards")'));
});

test('the guided sign-in art is a 960×1200 JPEG', () => {
  assert.deepEqual(jpegSize(read(`${CARDS_DIR}/guided-setup.jpg`)), { width: 960, height: 1200 });
});
