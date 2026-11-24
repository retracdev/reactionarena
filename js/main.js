import { GAMES } from './games/index.js';
import { icon } from './icons.js';
import { fmt } from './util.js';

const app = document.getElementById('app');
const DEFAULT_TITLE = 'Reaction Arena — test your reflexes & memory';
let teardown = null;

/* ------------------------------------------------------------------ */
/* Session: a sandbox for one run of a game. Everything a game schedules
   or listens to goes through here so it can be torn down cleanly.      */
/* ------------------------------------------------------------------ */
function createSession(stage, hudEl, onDone) {
  const ac = new AbortController();
  const timers = new Set();
  const frames = new Set();
  let done = false;

  const ctx = {
    stage,
    signal: ac.signal,
    get alive() { return !done; },
    hud(items) {
      if (done) return;
      hudEl.innerHTML = items
        .map((i) => `<div class="hud-item"><span>${i.label}</span><strong>${i.value}</strong></div>`)
        .join('');
    },
    after(ms, fn) {
      const id = setTimeout(() => { timers.delete(id); if (!done) fn(); }, ms);
      timers.add(id);
      return id;
    },
    every(ms, fn) {
      const id = setInterval(() => { if (!done) fn(); }, ms);
      timers.add(id);
      return id;
    },
    cancel(id) {
      clearTimeout(id);
      clearInterval(id);
      timers.delete(id);
    },
    frame(fn) {
      const id = requestAnimationFrame((t) => { frames.delete(id); if (!done) fn(t); });
      frames.add(id);
      return id;
    },
    wait(ms) {
      // Never resolves once the session is destroyed, which halts async game loops.
      return new Promise((resolve) => ctx.after(ms, resolve));
    },
    on(target, type, fn, opts = {}) {
      target.addEventListener(type, fn, { ...opts, signal: ac.signal });
    },
    finish(result) {
      if (done) return;
      destroy();
      onDone(result);
    },
  };

  function destroy() {
    if (done) return;
    done = true;
    ac.abort();
    timers.forEach((id) => { clearTimeout(id); clearInterval(id); });
    frames.forEach((id) => cancelAnimationFrame(id));
    timers.clear();
    frames.clear();
  }

  return { ctx, destroy };
}

/* ------------------------------------------------------------------ */
/* Home                                                                */
/* ------------------------------------------------------------------ */
function card(g, i) {
  return `
  <a class="card" href="#/${g.id}" style="--accent:${g.color}">
    <div class="card-top">
      <span class="card-icon">${icon(g.icon)}</span>
      <span class="card-num">${String(i + 1).padStart(2, '0')}</span>
    </div>
    <h3>${g.name}</h3>
    <p>${g.tagline}</p>
    <div class="card-foot">
      <span class="tag">${g.category}</span>
      <span class="card-go">Play ${icon('arrowRight')}</span>
    </div>
  </a>`;
}

function renderHome() {
  app.innerHTML = `
  <section class="hero view">
    <div class="hero-rings" aria-hidden="true"><span></span><span></span><span></span></div>
    <div class="hero-badge"><span class="pulse-dot"></span> ${GAMES.length} tests · no sign-up · runs in your browser</div>
    <h1 class="hero-title">How quick is your <span class="grad">mind</span>, really?</h1>
    <p class="hero-sub">Bite-sized challenges for reflexes, memory, focus and precision. Pick a test, beat the clock, then go again.</p>
    <div class="hero-cta">
      <a class="btn btn-primary btn-lg" href="#/${GAMES[0].id}">${icon('play')} Start with ${GAMES[0].name}</a>
      <button class="btn btn-ghost btn-lg" type="button" data-scroll>Browse all tests</button>
    </div>
  </section>

  <section class="tests view" id="tests">
    <div class="section-head">
      <h2>Choose your challenge</h2>
      <p>Each test takes about a minute or less.</p>
    </div>
    <div class="grid">${GAMES.map(card).join('')}</div>
  </section>

  <section class="features view">
    <div class="feature">
      <span class="feature-icon">${icon('zap')}</span>
      <h3>Instant</h3>
      <p>No accounts, no installs. Open a test and you're playing in a second.</p>
    </div>
    <div class="feature">
      <span class="feature-icon">${icon('grid')}</span>
      <h3>Ten disciplines</h3>
      <p>Reflexes, aim, typing, memory, timing, color vision, arithmetic and more.</p>
    </div>
    <div class="feature">
      <span class="feature-icon">${icon('cloud')}</span>
      <h3>Records, soon</h3>
      <p>Personal bests with cloud sync across the retrac.space collection are on the way.</p>
    </div>
  </section>`;

  app.querySelector('[data-scroll]').addEventListener('click', () => {
    document.getElementById('tests').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // Cursor-follow glow on cards.
  const grid = app.querySelector('.grid');
  grid.addEventListener('pointermove', (e) => {
    const c = e.target.closest('.card');
    if (!c) return;
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  });
}

/* ------------------------------------------------------------------ */
/* Game shell                                                          */
/* ------------------------------------------------------------------ */
function countUp(node, to, decimals) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !Number.isFinite(to)) { node.textContent = fmt(to, decimals); return; }
  const dur = 900;
  const t0 = performance.now();
  const step = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const eased = 1 - Math.pow(1 - p, 4);
    node.textContent = fmt(to * eased, decimals);
    if (p < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function renderGame(g) {
  const idx = GAMES.indexOf(g);
  const prev = GAMES[(idx - 1 + GAMES.length) % GAMES.length];
  const next = GAMES[(idx + 1) % GAMES.length];

  app.innerHTML = `
  <section class="game view" style="--accent:${g.color}">
    <a class="back" href="#/">${icon('arrowLeft')} All tests</a>
    <div class="game-bar">
      <div class="game-id">
        <span class="card-icon">${icon(g.icon)}</span>
        <div>
          <h1>${g.name}</h1>
          <p>${g.tagline}</p>
        </div>
      </div>
      <div class="hud" aria-live="polite"></div>
    </div>
    <div class="stage"></div>
    <nav class="game-pager" aria-label="More tests">
      <a href="#/${prev.id}" style="--accent:${prev.color}">
        ${icon('arrowLeft')}
        <span><small>Previous</small><strong>${prev.name}</strong></span>
      </a>
      <a href="#/${next.id}" style="--accent:${next.color}">
        <span><small>Next</small><strong>${next.name}</strong></span>
        ${icon('arrowRight')}
      </a>
    </nav>
  </section>`;

  const stage = app.querySelector('.stage');
  const hud = app.querySelector('.hud');
  let session = null;
  let state = 'intro';
  let resultAt = 0;

  function endSession() {
    session?.destroy();
    session = null;
  }

  function intro() {
    endSession();
    state = 'intro';
    hud.innerHTML = '';
    stage.dataset.state = 'intro';
    stage.innerHTML = `
      <div class="screen intro">
        <div class="intro-icon">${icon(g.icon)}</div>
        <h2>${g.name}</h2>
        <p>${g.howTo}</p>
        <button class="btn btn-primary btn-lg" type="button" data-start>${icon('play')} Start</button>
        <p class="hint">or press <kbd>Space</kbd></p>
      </div>`;
    stage.querySelector('[data-start]').addEventListener('click', start);
  }

  function start() {
    endSession();
    state = 'play';
    stage.innerHTML = '';
    stage.dataset.state = 'play';
    hud.innerHTML = '';
    session = createSession(stage, hud, showResult);
    g.run(session.ctx);
    const r = stage.getBoundingClientRect();
    if (r.bottom > window.innerHeight || r.top < 0) {
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function showResult(r) {
    session = null;
    state = 'result';
    resultAt = performance.now();
    hud.innerHTML = '';
    stage.dataset.state = 'result';
    const stats = (r.stats || [])
      .map((s) => `<div><span>${s.label}</span><strong>${s.value}</strong></div>`)
      .join('');
    stage.innerHTML = `
      <div class="screen result">
        <div class="result-label">${r.label}</div>
        <div class="result-value"><span class="num">0</span><span class="unit">${r.unit || ''}</span></div>
        <div class="rating">${icon('zap')} ${r.rating}</div>
        ${r.blurb ? `<p class="blurb">${r.blurb}</p>` : ''}
        ${stats ? `<div class="result-stats">${stats}</div>` : '<div class="result-gap"></div>'}
        <div class="result-actions">
          <button class="btn btn-primary btn-lg" type="button" data-again>${icon('refresh')} Try again</button>
          <a class="btn btn-ghost btn-lg" href="#/${next.id}">Next: ${next.name} ${icon('arrowRight')}</a>
        </div>
        <p class="hint">Press <kbd>Enter</kbd> to play again</p>
      </div>`;
    countUp(stage.querySelector('.num'), r.value, r.decimals || 0);
    stage.querySelector('[data-again]').addEventListener('click', start);
  }

  function onKey(e) {
    if (e.repeat) return;
    if (state === 'play') {
      if (e.key === 'Escape') { e.preventDefault(); intro(); }
      return;
    }
    if (e.target.closest && e.target.closest('input, textarea, button, a, select')) return;
    const go = e.code === 'Space' || e.key === 'Enter';
    if (!go) return;
    if (state === 'intro' || (state === 'result' && performance.now() - resultAt > 900)) {
      e.preventDefault();
      start();
    }
  }

  document.addEventListener('keydown', onKey);
  intro();

  return () => {
    endSession();
    document.removeEventListener('keydown', onKey);
  };
}

/* ------------------------------------------------------------------ */
/* Router                                                              */
/* ------------------------------------------------------------------ */
function route() {
  teardown?.();
  teardown = null;
  const id = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  const game = GAMES.find((g) => g.id === id);
  if (game) {
    document.title = `${game.name} · Reaction Arena`;
    teardown = renderGame(game);
  } else {
    document.title = DEFAULT_TITLE;
    renderHome();
  }
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', route);
route();
