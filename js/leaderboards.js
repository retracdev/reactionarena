/*
 * Leaderboards on the retrac.space API, following BasketSmash's client.
 *
 * Reads are public. Every write fetches a fresh short-lived token, and only after the live
 * session still belongs to the username that finished the run, so a score can never be
 * saved to someone else's account. Tokens are never stored.
 */
import { check, fetchToken, getState, subscribe } from './account/account.js';

export const API = 'https://space-api.retrac-space.workers.dev';
export const GAME_ID = 'reactionarena';
export const PAGE_SIZE = 25;
const MAX_OFFSET = 10000;
const SUBMIT_WINDOW_MS = 180000;

const num = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

/*
 * One board per test. These must match the boards registered on the API (see
 * docs/backend-setup.md). Scores are always integers; `format` turns one into display text.
 * `asc` means lower wins.
 */
export const BOARDS = {
  reaction: { direction: 'asc', min: 50, max: 5000, format: (s) => `${num(s)} ms` },
  aim: { direction: 'asc', min: 50, max: 10000, format: (s) => `${num(s)} ms` },
  typing: { direction: 'desc', min: 0, max: 300, format: (s) => `${num(s)} wpm` },
  sequence: { direction: 'desc', min: 0, max: 1000, format: (s) => `${num(s)} ${s === 1 ? 'step' : 'steps'}` },
  // Total clicks in 5 seconds, shown as clicks per second.
  clicks: { direction: 'desc', min: 0, max: 250, format: (s) => `${num(s / 5, 1)} cps` },
  time: { direction: 'asc', min: 0, max: 60000, format: (s) => `${num(s)} ms off` },
  color: { direction: 'desc', min: 0, max: 1000, format: (s) => `${num(s)} ${s === 1 ? 'level' : 'levels'}` },
  math: { direction: 'desc', min: 0, max: 500, format: (s) => `${num(s)} solved` },
  // Total points over 10 shots, shown as the average out of 100.
  precision: { direction: 'desc', min: 0, max: 1000, format: (s) => `${num(s / 10, 1)} / 100` },
  visual: { direction: 'desc', min: 0, max: 1000, format: (s) => `${num(s)} ${s === 1 ? 'level' : 'levels'}` },
};

export function validScore(board, score) {
  const b = BOARDS[board];
  return !!b && Number.isSafeInteger(score) && score >= b.min && score <= b.max;
}

/** A score worth ranking: valid, and not a zero on a higher-wins board. */
export function rankable(board, score) {
  return validScore(board, score) && !(BOARDS[board].direction === 'desc' && score <= 0);
}

export function formatScore(board, score) {
  return BOARDS[board] ? BOARDS[board].format(score) : num(score);
}

export class RequestError extends Error {
  constructor(status, retryAfter = 0) {
    super('Leaderboard request failed');
    this.status = status;
    this.retryable = status === 0 || status === 429 || status >= 500;
    this.retryAfter = retryAfter;
  }
}

function boardPath(board) {
  if (!BOARDS[board]) throw new RequestError(400);
  return `${API}/v1/games/${GAME_ID}/leaderboards/${board}`;
}

async function requestJson(url, options, signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 8000);
  try {
    const response = await fetch(url, { cache: 'no-store', ...options, signal: controller.signal });
    if (!response.ok) {
      const delay = Math.min(60000, Math.max(0, Number(response.headers.get('Retry-After')) * 1000 || 0));
      throw new RequestError(response.status, response.status === 429 ? delay || 60000 : delay);
    }
    const body = await response.json();
    if (controller.signal.aborted) throw new RequestError(0);
    return body;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(0);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}

async function freshToken(username, signal) {
  const session = await check();
  if (session.status === 'error') throw new RequestError(503);
  if (session.status !== 'authenticated' || session.username !== username) throw new RequestError(401);
  try {
    return await fetchToken(signal);
  } catch (error) {
    throw new RequestError(error.status ?? 0, (error.retryAfter || 0) * 1000);
  }
}

function personalResult(board, data) {
  if (data?.personalBest === null && data?.rank === null) return { personalBest: null, rank: null };
  if (!validScore(board, data?.personalBest) || !Number.isSafeInteger(data?.rank) || data.rank < 1) {
    throw new RequestError(503);
  }
  return { personalBest: data.personalBest, rank: data.rank };
}

export async function getRankings(board, offset = 0, signal, limit = PAGE_SIZE) {
  const body = await requestJson(`${boardPath(board)}?limit=${limit}&offset=${offset}`, { credentials: 'omit' }, signal);
  const data = body?.data;
  const entriesOk = Array.isArray(data?.entries) && data.entries.every((entry) =>
    Number.isSafeInteger(entry?.rank) && entry.rank > 0 &&
    typeof entry.username === 'string' && validScore(board, entry.score));
  const nextOk = data && (data.nextOffset === null || (Number.isSafeInteger(data.nextOffset) && data.nextOffset > offset));
  if (!entriesOk || !nextOk) throw new RequestError(503);
  // The API permits offsets up to 10,000, even if its final page advertises another.
  return { entries: data.entries, nextOffset: data.nextOffset > MAX_OFFSET ? null : data.nextOffset };
}

export async function getPersonalBest(board, username, signal) {
  const token = await freshToken(username, signal);
  const body = await requestJson(`${boardPath(board)}/me`, {
    credentials: 'omit', headers: { Authorization: `Bearer ${token}` },
  }, signal);
  return personalResult(board, body?.data);
}

/* ---------------------------------------------------------------- */
/* Submitting                                                        */
/* ---------------------------------------------------------------- */

const pending = new Set();
const changeListeners = new Set();
let chain = Promise.resolve();

// The account that finished the run. A brief failed recheck doesn't forget it, but a real
// sign-out does. Every write still rechecks the live session and the matching username.
let recognized = getState().status === 'authenticated' ? getState().username : null;
subscribe((s) => {
  if (s.status === 'authenticated') recognized = s.username;
  else if (s.status === 'guest' || s.status === 'incomplete' || s.status === 'action') recognized = null;
});

export function subscribeLeaderboardChanges(listener) {
  changeListeners.add(listener);
  return () => changeListeners.delete(listener);
}

/*
 * Submits a finished run's score. onUpdate receives, over time:
 *   { status: 'submitting' | 'retrying' | 'auth' | 'unconfirmed' }
 *   { status: 'saved', improved, personalBest, rank }
 * Returns false (and calls nothing) when there's no signed-in account or the score can't rank.
 */
export function submitScore(board, score, onUpdate = () => {}) {
  if (!rankable(board, score) || !recognized) return false;
  if (pending.size >= 16) {
    onUpdate({ status: 'unconfirmed' });
    return true;
  }
  const item = { board, score, username: recognized, attempts: 0, created: Date.now(), onUpdate };
  pending.add(item);
  onUpdate({ status: 'submitting' });
  queue(item);
  return true;
}

function queue(item, delay = 0) {
  setTimeout(() => {
    chain = chain.then(() => attempt(item)).catch(() => {
      pending.delete(item);
      item.onUpdate({ status: 'unconfirmed' });
    });
  }, delay);
}

async function attempt(item) {
  if (Date.now() - item.created > SUBMIT_WINDOW_MS) {
    pending.delete(item);
    item.onUpdate({ status: 'unconfirmed' });
    return;
  }
  item.attempts++;
  try {
    const token = await freshToken(item.username);
    const headers = { Authorization: `Bearer ${token}` };
    if (item.initialBest === undefined) {
      const before = await requestJson(`${boardPath(item.board)}/me`, { credentials: 'omit', headers });
      item.initialBest = personalResult(item.board, before?.data).personalBest;
    }
    const body = await requestJson(`${boardPath(item.board)}/scores`, {
      method: 'POST',
      credentials: 'omit',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: item.score }),
    });
    const confirmed = personalResult(item.board, body?.data);
    if (confirmed.personalBest === null) throw new RequestError(503);
    const asc = BOARDS[item.board].direction === 'asc';
    const atLeastAsGood = asc ? confirmed.personalBest <= item.score : confirmed.personalBest >= item.score;
    if (!atLeastAsGood) throw new RequestError(503);
    const improved = confirmed.personalBest === item.score &&
      (item.initialBest === null || (asc ? item.score < item.initialBest : item.score > item.initialBest));
    pending.delete(item);
    item.onUpdate({ status: 'saved', improved, ...confirmed });
    for (const listener of changeListeners) {
      try { listener(item.board); } catch { /* A UI failure must never cause another POST. */ }
    }
  } catch (error) {
    if (!pending.has(item)) return;
    const delay = Math.max(error.retryAfter || 0, item.attempts === 1 ? 3000 : 12000);
    if (error.retryable && item.attempts < 3 && Date.now() - item.created + delay < SUBMIT_WINDOW_MS) {
      item.onUpdate({ status: 'retrying' });
      queue(item, delay);
    } else {
      pending.delete(item);
      item.onUpdate({ status: error.status === 401 || error.status === 403 ? 'auth' : 'unconfirmed' });
    }
  }
}
