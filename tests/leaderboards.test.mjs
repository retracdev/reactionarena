import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { API, accountRoutes, json, mockFetch, waitFor } from './helpers.mjs';
import { check } from '../js/account/account.js';
import {
  BOARDS, GAME_ID, formatScore, getRankings, getPersonalBest, rankable, submitScore, validScore, subscribeLeaderboardChanges,
} from '../js/leaderboards.js';
import { GAMES } from '../js/games/index.js';

const BOARD_URL = (b) => `${API}/v1/games/${GAME_ID}/leaderboards/${b}`;

test('every test has a board, and nothing else does', () => {
  assert.deepEqual(Object.keys(BOARDS).sort(), GAMES.map((g) => g.id).sort());
});

test('the backend setup SQL registers exactly the boards the site uses', () => {
  const doc = fs.readFileSync(new URL('../docs/backend-setup.md', import.meta.url), 'utf8');
  const sql = doc.split('<!-- reactionarena-sql:start -->')[1].split('<!-- reactionarena-sql:end -->')[0];
  assert.match(sql, /INSERT INTO games \(id, name, save_slots\) VALUES \('reactionarena', 'Reaction Arena', ([1-9]|1\d|20)\);/);
  const rows = [...sql.matchAll(/\('reactionarena', '([a-z0-9-]+)', '[^']+', '(asc|desc)', '(integer|number)', (-?\d+), (-?\d+)\)/g)];
  assert.equal(rows.length, Object.keys(BOARDS).length);
  for (const [, id, direction, type, min, max] of rows) {
    const b = BOARDS[id];
    assert.ok(b, `unknown board ${id}`);
    assert.equal(direction, b.direction, `${id} direction`);
    assert.equal(type, 'integer', `${id} type`);
    assert.equal(Number(min), b.min, `${id} min`);
    assert.equal(Number(max), b.max, `${id} max`);
  }
});

test('scores are validated against each board', () => {
  assert.ok(validScore('reaction', 250));
  assert.equal(validScore('reaction', 20), false); // faster than humanly possible
  assert.equal(validScore('reaction', 250.5), false);
  assert.equal(validScore('typing', 301), false);
  assert.equal(validScore('nope', 1), false);
  assert.ok(rankable('time', 0)); // a perfect stop is a real score on a lower-wins board
  assert.equal(rankable('sequence', 0), false); // but zero on a higher-wins board isn't worth ranking
  assert.ok(rankable('sequence', 1));
});

test('scores are formatted the way each test shows them', () => {
  assert.equal(formatScore('reaction', 1234), '1,234 ms');
  assert.equal(formatScore('clicks', 47), '9.4 cps');
  assert.equal(formatScore('precision', 873), '87.3 / 100');
  assert.equal(formatScore('sequence', 1), '1 step');
  assert.equal(formatScore('visual', 7), '7 levels');
});

test('rankings are fetched without cookies and malformed responses are rejected', async () => {
  const entries = [{ rank: 1, username: 'ada', score: 180 }, { rank: 3, username: 'bo', score: 210 }];
  const calls = mockFetch([[BOARD_URL('reaction'), () => json({ data: { entries, nextOffset: 25 } })]]);
  const data = await getRankings('reaction', 0);
  assert.deepEqual(data, { entries, nextOffset: 25 });
  assert.equal(calls[0].options.credentials, 'omit');
  assert.match(calls[0].url, /\?limit=25&offset=0$/);

  mockFetch([[BOARD_URL('reaction'), () => json({ data: { entries: [{ rank: 1, username: 'x', score: 1 }], nextOffset: null } })]]);
  await assert.rejects(getRankings('reaction'), (e) => e.status === 503); // score out of range

  mockFetch([[BOARD_URL('reaction'), () => json({ data: { entries: [], nextOffset: 99999 } })]]);
  assert.equal((await getRankings('reaction')).nextOffset, null);

  mockFetch([[BOARD_URL('reaction'), () => json({}, 429, { 'Retry-After': '10' })]]);
  await assert.rejects(getRankings('reaction'), (e) => e.status === 429 && e.retryable);
});

test('a signed-in run is submitted with a fresh token and reports a new personal best', async () => {
  let best = null;
  const calls = mockFetch([
    ...accountRoutes('ada'),
    [(u, o) => u === `${BOARD_URL('reaction')}/me`, () => json({ data: best === null ? { personalBest: null, rank: null } : { personalBest: best, rank: 4 } })],
    [(u, o) => u === `${BOARD_URL('reaction')}/scores` && o.method === 'POST', (u, o) => {
      const { score } = JSON.parse(o.body);
      best = best === null ? score : Math.min(best, score);
      return json({ data: { personalBest: best, rank: 2 } });
    }],
  ]);
  await check();
  const changed = [];
  const unsub = subscribeLeaderboardChanges((b) => changed.push(b));

  const updates = [];
  assert.equal(submitScore('reaction', 240, (u) => updates.push(u)), true);
  await waitFor(() => updates.find((u) => u.status === 'saved'));
  assert.deepEqual(updates, [{ status: 'submitting' }, { status: 'saved', improved: true, personalBest: 240, rank: 2 }]);
  assert.deepEqual(changed, ['reaction']);

  const post = calls.find((c) => c.options.method === 'POST');
  assert.equal(post.options.credentials, 'omit');
  assert.match(post.options.headers.Authorization, /^Bearer header\./);
  assert.equal(post.options.body, '{"score":240}');

  // A slower run on a lower-wins board is recorded but isn't a new best.
  const second = [];
  submitScore('reaction', 300, (u) => second.push(u));
  await waitFor(() => second.find((u) => u.status === 'saved'));
  assert.deepEqual(second.at(-1), { status: 'saved', improved: false, personalBest: 240, rank: 2 });
  unsub();
});

test('a run is never saved to a different account than the one that finished it', async () => {
  mockFetch(accountRoutes('ada'));
  await check();
  const updates = [];
  // The visitor switched accounts in another tab before the write happened.
  mockFetch(accountRoutes('mallory'));
  submitScore('typing', 80, (u) => updates.push(u));
  await waitFor(() => updates.find((u) => u.status === 'auth'));
  assert.deepEqual(updates.map((u) => u.status), ['submitting', 'auth']);
});

test('nothing is submitted for guests or for scores that cannot rank', async () => {
  const calls = mockFetch(accountRoutes(null));
  await check();
  const updates = [];
  assert.equal(submitScore('typing', 80, (u) => updates.push(u)), false);
  mockFetch(accountRoutes('ada'));
  await check();
  assert.equal(submitScore('typing', 0, (u) => updates.push(u)), false);
  assert.equal(submitScore('typing', 9999, (u) => updates.push(u)), false);
  assert.deepEqual(updates, []);
  assert.ok(calls.every((c) => !c.url.includes('/scores')));
});

test('personal bests are read with a bearer token', async () => {
  const calls = mockFetch([
    ...accountRoutes('ada'),
    [`${BOARD_URL('math')}/me`, () => json({ data: { personalBest: 22, rank: 7 } })],
  ]);
  await check();
  assert.deepEqual(await getPersonalBest('math', 'ada'), { personalBest: 22, rank: 7 });
  const me = calls.find((c) => c.url.endsWith('/me'));
  assert.match(me.options.headers.Authorization, /^Bearer /);
  await assert.rejects(getPersonalBest('math', 'someone-else'), (e) => e.status === 401);
});
