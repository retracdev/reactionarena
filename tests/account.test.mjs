import assert from 'node:assert/strict';
import test from 'node:test';
import { ACCOUNTS, json, mockFetch } from './helpers.mjs';
import { readSession, safeUrl, check, getState, subscribe, fetchToken, isSignedIn } from '../js/account/account.js';

test('readSession understands every shape accounts can return', () => {
  assert.deepEqual(readSession(null), { status: 'guest' });
  assert.deepEqual(readSession({ user: { username: 'ada' } }), { status: 'authenticated', username: 'ada' });
  assert.deepEqual(readSession({ user: { username: '   ' } }), { status: 'incomplete' });
  assert.deepEqual(readSession({ user: {} }), { status: 'incomplete' });
  assert.equal(readSession({}), null);
  assert.deepEqual(
    readSession({ user: { username: 'ada' }, actionRequired: { required: true, reason: 'account_review', url: 'https://accounts.retrac.space/review' } }),
    { status: 'action', reason: 'account_review', url: 'https://accounts.retrac.space/review' },
  );
});

test('safeUrl only allows https links', () => {
  assert.equal(safeUrl('https://accounts.retrac.space/x'), 'https://accounts.retrac.space/x');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('http://example.com'), null);
  assert.equal(safeUrl(42), null);
});

test('check publishes the session, and a failed recheck keeps a signed-in visitor signed in', async () => {
  const seen = [];
  const unsub = subscribe((s) => seen.push(s.status));

  mockFetch([[`${ACCOUNTS}/api/auth/get-session`, () => json({ user: { username: 'ada' } })]]);
  assert.deepEqual(await check(), { status: 'authenticated', username: 'ada' });
  assert.ok(isSignedIn());

  mockFetch([]); // offline
  assert.deepEqual(await check(), { status: 'authenticated', username: 'ada' });

  mockFetch([[`${ACCOUNTS}/api/auth/get-session`, () => json(null)]]);
  assert.deepEqual(await check(), { status: 'guest' });
  assert.equal(isSignedIn(), false);

  mockFetch([]);
  assert.deepEqual(await check(), { status: 'error' });
  assert.equal(getState().status, 'error');

  unsub();
  assert.deepEqual(seen, ['authenticated', 'guest', 'error']);
});

test('simultaneous checks share one request and cookies are always sent', async () => {
  const calls = mockFetch([[`${ACCOUNTS}/api/auth/get-session`, () => json(null)]]);
  await Promise.all([check(), check(), check()]);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.credentials, 'include');
});

test('fetchToken returns the token, and reports refusals with their status', async () => {
  mockFetch([[`${ACCOUNTS}/api/auth/token`, () => json({ token: 'a.b.c' })]]);
  assert.equal(await fetchToken(), 'a.b.c');

  mockFetch([[`${ACCOUNTS}/api/auth/token`, () => json({}, 401)]]);
  await assert.rejects(fetchToken(), (e) => e.status === 401);

  mockFetch([[`${ACCOUNTS}/api/auth/token`, () => json({}, 429, { 'Retry-After': '30' })]]);
  await assert.rejects(fetchToken(), (e) => e.status === 429 && e.retryAfter === 30);

  mockFetch([]);
  await assert.rejects(fetchToken(), (e) => e.status === 0);

  mockFetch([[`${ACCOUNTS}/api/auth/token`, () => json({ token: '' })]]);
  await assert.rejects(fetchToken(), (e) => e.status === 401);
});
