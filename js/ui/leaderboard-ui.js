import { GAMES } from '../games/index.js';
import { icon } from '../icons.js';
import { getState, subscribe } from '../account/account.js';
import { promptSignIn } from '../account/sign-in.js';
import {
  BOARDS, formatScore, getRankings, getPersonalBest, rankable, submitScore, subscribeLeaderboardChanges,
} from '../leaderboards.js';

const MEDALS = ['gold', 'silver', 'bronze'];

export function esc(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const directionNote = (board) => (BOARDS[board].direction === 'asc' ? 'Lower is better' : 'Higher is better');
const isMe = (username) => getState().status === 'authenticated' && getState().username === username;

/* ------------------------------------------------------------------ */
/* Personal best                                                       */
/* ------------------------------------------------------------------ */

/** Renders the signed-in visitor's best (or an invite) into `node`. Returns a cleanup. */
function personalCard(node, board, compact = false) {
  let controller = null;
  let shownFor = null;

  async function render() {
    const s = getState();
    const key = `${s.status}:${s.username || ''}`;
    if (key === shownFor) return;
    shownFor = key;
    controller?.abort();
    if (s.status === 'unknown' || s.status === 'error') {
      node.innerHTML = '';
      return;
    }
    if (s.status !== 'authenticated') {
      const copy = s.status === 'incomplete'
        ? 'Choose a username at retrac.space to get on the leaderboard.'
        : s.status === 'action'
          ? 'Action is required on your retrac.space account before you can rank.'
          : 'Sign in or create a free retrac.space account to put your best scores on the board.';
      node.innerHTML = `
        <div class="lb-invite${compact ? ' compact' : ''}">
          <img src="assets/retrac-space-icon.png" alt="" aria-hidden="true">
          <div><strong>Want your name up here?</strong><p>${copy}</p></div>
          <button type="button" class="btn btn-ghost" data-lb-signin>${s.status === 'guest' ? 'Sign in' : 'Open account'}</button>
        </div>`;
      node.querySelector('[data-lb-signin]').addEventListener('click', (e) => {
        promptSignIn({ trigger: e.currentTarget });
      });
      return;
    }
    controller = new AbortController();
    const mine = controller;
    node.innerHTML = `<div class="lb-me"><span class="lb-me-label">Your best</span><span class="lb-me-value">Loading…</span></div>`;
    try {
      const p = await getPersonalBest(board, s.username, mine.signal);
      if (mine !== controller) return;
      node.querySelector('.lb-me-value').innerHTML = p.personalBest === null
        ? 'No score yet — play to earn your place!'
        : `<strong>${esc(formatScore(board, p.personalBest))}</strong> <span class="lb-rank-pill">#${p.rank}</span>`;
    } catch {
      if (mine !== controller) return;
      node.querySelector('.lb-me-value').textContent = 'Couldn’t load your best right now.';
      shownFor = null;
    }
  }

  const unsub = subscribe(render);
  const unsubChanges = subscribeLeaderboardChanges((b) => { if (b === board) { shownFor = null; render(); } });
  render();
  return () => { unsub(); unsubChanges(); controller?.abort(); };
}

/* ------------------------------------------------------------------ */
/* Mini board on each game page                                        */
/* ------------------------------------------------------------------ */

export function mountMiniBoard(container, game) {
  const board = game.id;
  container.innerHTML = `
    <section class="mini-board" style="--accent:${game.color}" aria-labelledby="mini-board-title">
      <header>
        <h2 id="mini-board-title">${icon('trophy')} Top players</h2>
        <span class="lb-direction">${directionNote(board)}</span>
      </header>
      <ol class="mini-list" aria-busy="true"><li class="lb-loading">Loading rankings…</li></ol>
      <div class="mini-me"></div>
      <a class="mini-link" href="#/leaderboards/${board}">Full leaderboard ${icon('arrowRight')}</a>
    </section>`;
  const list = container.querySelector('.mini-list');
  let controller = null;

  async function load() {
    controller?.abort();
    controller = new AbortController();
    const mine = controller;
    try {
      const data = await getRankings(board, 0, mine.signal, 5);
      if (mine !== controller) return;
      list.innerHTML = data.entries.length
        ? data.entries.map((e) => `
          <li class="${e.rank <= 3 ? `medal-${MEDALS[e.rank - 1]}` : ''}${isMe(e.username) ? ' me' : ''}">
            <span class="lb-rank">${e.rank}</span>
            <span class="lb-name">${esc(e.username)}</span>
            <span class="lb-score">${esc(formatScore(board, e.score))}</span>
          </li>`).join('')
        : '<li class="lb-empty">No scores yet. Be the first!</li>';
    } catch {
      if (mine !== controller) return;
      list.innerHTML = '<li class="lb-empty">Rankings are unavailable right now.</li>';
    } finally {
      if (mine === controller) list.setAttribute('aria-busy', 'false');
    }
  }

  const cleanupMe = personalCard(container.querySelector('.mini-me'), board, true);
  const unsubChanges = subscribeLeaderboardChanges((b) => { if (b === board) load(); });
  const unsubAccount = subscribe(() => load());
  load();
  return () => { controller?.abort(); cleanupMe(); unsubChanges(); unsubAccount(); };
}

/* ------------------------------------------------------------------ */
/* Leaderboards page                                                   */
/* ------------------------------------------------------------------ */

export function renderLeaderboardPage(app, boardId) {
  const game = GAMES.find((g) => g.id === boardId) || GAMES[0];
  const board = game.id;

  app.innerHTML = `
  <section class="lb-page view" style="--accent:${game.color}">
    <a class="back" href="#/">${icon('arrowLeft')} All tests</a>
    <div class="lb-head">
      <div>
        <h1>Leaderboards</h1>
        <p>Personal bests from every retrac.space player. Sign in to claim your spot.</p>
      </div>
    </div>
    <nav class="lb-tabs" role="tablist" aria-label="Choose a test">
      ${GAMES.map((g) => `
        <a role="tab" href="#/leaderboards/${g.id}" style="--accent:${g.color}" aria-selected="${g.id === board}" ${g.id === board ? 'tabindex="0"' : 'tabindex="-1"'}>
          ${icon(g.icon)}<span>${g.name}</span>
        </a>`).join('')}
    </nav>
    <div class="lb-panel" role="tabpanel" aria-label="${game.name} rankings">
      <div class="lb-panel-head">
        <div class="game-id">
          <span class="card-icon">${icon(game.icon)}</span>
          <div><h2>${game.name}</h2><p>${directionNote(board)} · ranked by personal best</p></div>
        </div>
        <a class="btn btn-primary" href="#/${board}">${icon('play')} Play</a>
      </div>
      <div class="lb-personal"></div>
      <div class="lb-podium" hidden></div>
      <div class="lb-status" role="status" aria-live="polite"></div>
      <ol class="lb-list"></ol>
      <button type="button" class="btn btn-ghost lb-more" hidden>Load more</button>
    </div>
  </section>`;

  const podium = app.querySelector('.lb-podium');
  const list = app.querySelector('.lb-list');
  const status = app.querySelector('.lb-status');
  const more = app.querySelector('.lb-more');
  const tabs = [...app.querySelectorAll('.lb-tabs [role="tab"]')];
  app.querySelector('.lb-tabs [aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' });

  let entries = [];
  let nextOffset = null;
  let loading = false;
  let failed = false;
  let version = 0;
  let controller = null;

  function render() {
    const top = entries.filter((e) => e.rank <= 3).slice(0, 3);
    podium.hidden = !top.length;
    // Podium order: 2nd, 1st, 3rd.
    const order = [top.find((e) => e.rank === 2), top.find((e) => e.rank === 1), top.find((e) => e.rank === 3)].filter(Boolean);
    podium.innerHTML = order.map((e) => `
      <div class="podium-spot medal-${MEDALS[e.rank - 1]}${isMe(e.username) ? ' me' : ''}">
        <span class="podium-medal">${icon('trophy')}<b>${e.rank}</b></span>
        <span class="podium-name">${esc(e.username)}</span>
        <span class="podium-score">${esc(formatScore(board, e.score))}</span>
        <span class="podium-base"></span>
      </div>`).join('');
    const rest = entries.filter((e) => !top.includes(e));
    list.innerHTML = rest.map((e) => `
      <li class="${isMe(e.username) ? 'me' : ''}">
        <span class="lb-rank">${e.rank}</span>
        <span class="lb-name">${esc(e.username)}${isMe(e.username) ? ' <em>you</em>' : ''}</span>
        <span class="lb-score">${esc(formatScore(board, e.score))}</span>
      </li>`).join('');
    list.hidden = !rest.length;

    if (loading && !entries.length) status.innerHTML = '<p class="lb-loading">Loading rankings…</p>';
    else if (failed) {
      status.innerHTML = `<div class="lb-empty-state"><h3>The scoreboard is taking a timeout.</h3>
        <p>We couldn’t load the rankings right now. Try again in a moment.</p>
        <button type="button" class="btn btn-ghost" data-retry>Retry</button></div>`;
      status.querySelector('[data-retry]').addEventListener('click', () => load());
    } else if (!entries.length) {
      status.innerHTML = `<div class="lb-empty-state"><h3>The arena is empty.</h3>
        <p>No scores yet. Be the first to make your mark!</p></div>`;
    } else status.innerHTML = '';
    more.hidden = nextOffset === null || failed;
    more.disabled = loading;
    more.textContent = loading ? 'Loading…' : 'Load more';
  }

  async function load(append = false) {
    if (append && (loading || nextOffset === null)) return;
    if (!append) {
      version++;
      controller?.abort();
      entries = [];
      nextOffset = null;
    }
    const v = version;
    const offset = append ? nextOffset : 0;
    controller = new AbortController();
    loading = true;
    failed = false;
    render();
    try {
      const data = await getRankings(board, offset, controller.signal);
      if (v !== version) return;
      // Keep the server's order and real rank numbers, including any gaps.
      const seen = new Set(entries.map((e) => e.rank));
      entries.push(...data.entries.filter((e) => !seen.has(e.rank)));
      nextOffset = data.nextOffset;
    } catch {
      if (v !== version) return;
      failed = true;
    } finally {
      if (v === version) {
        loading = false;
        render();
      }
    }
  }

  more.addEventListener('click', () => load(true));
  app.querySelector('.lb-tabs').addEventListener('keydown', (e) => {
    const i = tabs.indexOf(e.target.closest('[role="tab"]'));
    if (i < 0 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    location.hash = tabs[next].getAttribute('href');
  });

  const cleanupMe = personalCard(app.querySelector('.lb-personal'), board);
  const unsubChanges = subscribeLeaderboardChanges((b) => { if (b === board) load(); });
  const unsubAccount = subscribe(() => render());
  load();
  return () => { version++; controller?.abort(); cleanupMe(); unsubChanges(); unsubAccount(); };
}

/* ------------------------------------------------------------------ */
/* Results screen                                                      */
/* ------------------------------------------------------------------ */

let guestPrompted = false;
let pendingGuestRun = null;

/** Called by main.js once a guest's sign-in has gone through. */
export function submitPendingGuestRun() {
  const run = pendingGuestRun;
  pendingGuestRun = null;
  if (run) run.submit();
}

export function clearPendingGuestRun() {
  pendingGuestRun = null;
}

/**
 * Shows where a finished run stands on the leaderboard inside `node`, submitting it when the
 * visitor is signed in. Guests get a sign-in pop-up (once per visit) and an invite card; if
 * they sign in from it, this run's score is submitted then.
 */
export function mountResultBoard(node, game, result) {
  const board = game.id;
  const score = result.score;
  let submitted = false;

  const set = (cls, html) => {
    if (!node.isConnected) return;
    node.className = `result-board ${cls}`;
    node.innerHTML = html;
  };

  const onUpdate = (u) => {
    const view = `<a href="#/leaderboards/${board}">View leaderboard ${icon('arrowRight')}</a>`;
    switch (u.status) {
      case 'submitting':
        set('busy', `<span class="rb-dot"></span><span>Saving your score to the leaderboard…</span>`);
        break;
      case 'retrying':
        set('busy', `<span class="rb-dot"></span><span>Score not confirmed yet. Retrying shortly…</span>`);
        break;
      case 'saved':
        set(u.improved ? 'best' : 'saved', u.improved
          ? `${icon('trophy')}<span><strong>New personal best!</strong> You’re <b>#${u.rank}</b> on the leaderboard.</span>${view}`
          : `${icon('trophy')}<span>Score recorded. Your best still stands: <b>${esc(formatScore(board, u.personalBest))}</b> (#${u.rank}).</span>${view}`);
        break;
      case 'auth':
        set('warn', `<span>Your session expired or changed. Sign in again to save future scores.</span>`);
        break;
      default:
        set('warn', `<span>Your score couldn’t be confirmed. If it reached the server, rankings may still update.</span>`);
    }
  };

  const submit = () => {
    if (submitted) return;
    submitted = true;
    if (!submitScore(board, score, onUpdate)) {
      submitted = false;
      render();
    }
  };

  function render() {
    if (!node.isConnected || submitted) return;
    const s = getState();
    if (!rankable(board, score)) {
      set('muted', `<span>Score at least one point to get on the leaderboard.</span>`);
      return;
    }
    if (s.status === 'authenticated') {
      submit();
      return;
    }
    if (s.status === 'unknown') {
      set('busy', `<span class="rb-dot"></span><span>Checking your retrac.space account…</span>`);
      return;
    }
    const copy = {
      guest: `Sign in to put <b>${esc(formatScore(board, score))}</b> on the leaderboard.`,
      incomplete: 'Choose a username at retrac.space to get on the leaderboard.',
      action: 'Action is required on your account before you can rank.',
      error: 'We couldn’t reach retrac.space to check your account.',
    }[s.status] || 'Sign in to get on the leaderboard.';
    set('invite', `<img src="assets/retrac-space-icon.png" alt="" aria-hidden="true"><span>${copy}</span>
      <button type="button" class="btn btn-ghost" data-rb-signin>${s.status === 'error' ? 'Try again' : 'Sign in'}</button>`);
    const button = node.querySelector('[data-rb-signin]');
    const open = () => {
      pendingGuestRun = { submit };
      promptSignIn({ purpose: 'score', trigger: button, onCancel: clearPendingGuestRun });
    };
    button.addEventListener('click', open);
    // The pop-up appears on its own once per visit, the first time a guest finishes a run.
    if (s.status === 'guest' && !guestPrompted) {
      guestPrompted = true;
      setTimeout(() => { if (node.isConnected && getState().status === 'guest') open(); }, 900);
    }
  }

  const unsub = subscribe(() => render());
  render();
  return () => unsub();
}
