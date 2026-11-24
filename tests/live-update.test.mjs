import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://reaction.retrac.space/';
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8').split('\r\n').join('\n');
const CLASSIC = ['live-update.js', 'splash.js', 'toasts.js', 'updates.js'];

function publishedVersion() {
  return /^version:\s*"([^"]+)"/m.exec(read('version.yml'))[1];
}

/** A page with live-update.js running in it. */
function liveUpdatePage(t) {
  const dom = new JSDOM(`<!doctype html><head><meta name="reactionarena-version" content="${publishedVersion()}"></head><body></body>`,
    { url: SITE, runScripts: 'outside-only' });
  t.after(() => dom.window.close());
  dom.window.eval(read('js/live-update.js'));
  return dom.window;
}

test('index.html carries the version from version.yml', () => {
  const version = publishedVersion();
  assert.match(version, /^\d+(\.\d+){0,3}(-[0-9A-Za-z.-]+)?$/);
  assert.ok(read('index.html').includes(`<meta name="reactionarena-version" content="${version}">`));
});

test('set-version writes the version to version.yml and index.html together', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'arena-version-'));
  try {
    fs.mkdirSync(path.join(dir, 'scripts'));
    fs.copyFileSync(path.join(ROOT, 'scripts/set-version.cjs'), path.join(dir, 'scripts/set-version.cjs'));
    fs.copyFileSync(path.join(ROOT, 'version.yml'), path.join(dir, 'version.yml'));
    fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(dir, 'index.html'));
    execFileSync(process.execPath, [path.join(dir, 'scripts/set-version.cjs'), 'v2.3.4'], { stdio: 'pipe' });
    assert.match(fs.readFileSync(path.join(dir, 'version.yml'), 'utf8'), /^version: "2\.3\.4"$/m);
    assert.ok(fs.readFileSync(path.join(dir, 'index.html'), 'utf8').includes('<meta name="reactionarena-version" content="2.3.4">'));
    assert.throws(() => execFileSync(process.execPath, [path.join(dir, 'scripts/set-version.cjs'), 'banana'], { stdio: 'pipe' }));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the page loads the updater first and marks the loading screen for updates', () => {
  const doc = new JSDOM(read('index.html')).window.document;
  const headScripts = [...doc.head.querySelectorAll('script')];
  assert.equal(headScripts[0].getAttribute('src'), 'js/live-update.js');
  assert.ok(headScripts[0].hasAttribute('data-live-update'));
  assert.equal(doc.querySelector('script[type="module"]').getAttribute('src'), 'js/main.js');
  assert.ok(doc.documentElement.classList.contains('is-splashing'));
  const splash = doc.querySelector('#splash');
  assert.ok(splash.hasAttribute('data-update-splash'));
  assert.equal(splash.querySelector('.splash__icon').getAttribute('src'), 'assets/logo-mark.svg');
  assert.deepEqual([...doc.body.querySelectorAll('script')].map((s) => s.getAttribute('src')),
    ['js/splash.js', 'js/toasts.js', 'js/updates.js']);
  assert.ok(doc.querySelector('#checkUpdates'));
});

test('versions compare like the soundboard', (t) => {
  const { compareVersions } = liveUpdatePage(t).ReactionArenaLiveUpdate.internals;
  assert.equal(compareVersions('1.0.1', '1.0.0'), 1);
  assert.equal(compareVersions('1.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.2.0-beta', '1.2.0'), -1);
  assert.equal(compareVersions('1.2.0-beta.2', '1.2.0-beta.10'), -1);
  assert.equal(compareVersions('v2.0.0', '1.99.0'), 1);
});

test('an update downloads the whole module graph, dependencies first', async (t) => {
  const { loadModuleGraph, moduleOrder, moduleImports, rewriteImports } = liveUpdatePage(t).ReactionArenaLiveUpdate.internals;
  const loads = [];
  const load = async (url) => {
    loads.push(url);
    return read(new URL(url).pathname.slice(1));
  };
  const entry = new URL('js/main.js', SITE).href;
  const graph = await loadModuleGraph(entry, load);

  // Every module the site has is reached from main.js, and each was fetched once.
  const allModules = fs.readdirSync(path.join(ROOT, 'js'), { recursive: true })
    .map((f) => f.split(path.sep).join('/'))
    .filter((f) => f.endsWith('.js') && !CLASSIC.includes(f))
    .map((f) => new URL(`js/${f}`, SITE).href)
    .sort();
  assert.deepEqual([...graph.keys()].sort(), allModules);
  assert.equal(loads.length, allModules.length);

  const order = moduleOrder(entry, graph);
  assert.equal(order.at(-1), entry);
  for (const url of order) {
    for (const dep of moduleImports(graph.get(url), url)) {
      assert.ok(order.indexOf(dep) < order.indexOf(url), `${dep} must load before ${url}`);
    }
  }

  // Every relative import is pointed at its fresh copy.
  for (const [url, code] of graph) {
    const rewritten = rewriteImports(code, url, (dep) => `blob:${SITE}${encodeURIComponent(dep)}`);
    assert.equal(moduleImports(rewritten, url).length, 0, `${url} still has relative imports`);
    assert.equal((rewritten.match(/blob:/g) || []).length, moduleImports(code, url).length);
  }
});

test('a circular import is refused instead of half-loading', (t) => {
  const { moduleOrder } = liveUpdatePage(t).ReactionArenaLiveUpdate.internals;
  const a = `${SITE}js/a.js`;
  const b = `${SITE}js/b.js`;
  const graph = new Map([[a, "import { b } from './b.js';"], [b, "import { a } from './a.js';"]]);
  assert.throws(() => moduleOrder(a, graph), /Circular import/);
  assert.throws(() => moduleOrder(a, new Map([[a, "import './missing.js';"]])), /Missing module/);
});

test('the loading bar fills in 0.3 to 1 second, then waits for the app', async (t) => {
  for (const [random, fillMs] of [[0, 300], [0.999, 1000]]) {
    const dom = new JSDOM(`<!doctype html><html class="is-splashing"><body>
      <div class="splash" id="splash"><div class="splash__track"><div class="splash__fill"></div></div></div>
      <main id="app"></main></body></html>`, { url: SITE, runScripts: 'outside-only', pretendToBeVisual: true });
    t.after(() => dom.window.close());
    const { window } = dom;
    window.matchMedia = () => ({ matches: true }); // Reduced motion: a short exit.
    window.Math.random = () => random;
    window.eval(read('js/splash.js'));
    const started = Date.now();
    const done = new Promise((resolve) => window.ReactionArenaSplash.whenDone(resolve));

    // The bar fills on time, but the screen stays until the app is ready.
    await new Promise((r) => setTimeout(r, fillMs + 400));
    assert.equal(window.document.querySelector('#splash').getAttribute('aria-valuenow'), '100');
    assert.equal(window.ReactionArenaSplash.isDone(), false);
    assert.ok(window.document.querySelector('main').inert, 'the page is inert behind the screen');

    window.ReactionArenaSplash.appReady();
    await done;
    const total = Date.now() - started;
    assert.ok(total < fillMs + 400 + 180 + 200 + 400, `took ${total}ms`);
    assert.equal(window.document.querySelector('#splash'), null);
    assert.equal(window.document.documentElement.classList.contains('is-splashing'), false);
    assert.equal(window.document.querySelector('main').inert, false);
  }
});

test('Check for Updates appears only when the updater is there, and asks it to refresh', async (t) => {
  const page = () => new JSDOM(`<!doctype html><body>
    <button id="checkUpdates" hidden><span id="checkUpdatesLabel">Check for Updates</span></button></body>`,
    { url: SITE, runScripts: 'outside-only' });

  const without = page();
  t.after(() => without.window.close());
  without.window.eval(read('js/updates.js'));
  assert.equal(without.window.document.querySelector('#checkUpdates').hidden, true);

  const withUpdater = page();
  t.after(() => withUpdater.window.close());
  let refreshed = 0;
  withUpdater.window.ReactionArenaLiveUpdate = { refresh: async () => { refreshed++; } };
  withUpdater.window.eval(read('js/updates.js'));
  const button = withUpdater.window.document.querySelector('#checkUpdates');
  assert.equal(button.hidden, false);
  button.click();
  assert.equal(withUpdater.window.document.querySelector('#checkUpdatesLabel').textContent, 'Checking for updates…');
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(refreshed, 1);
  assert.equal(withUpdater.window.document.querySelector('#checkUpdatesLabel').textContent, 'Check for Updates');
});
