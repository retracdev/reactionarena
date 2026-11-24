import assert from 'node:assert/strict';
import test from 'node:test';
import { JSDOM } from 'jsdom';
import { API, accountRoutes, json, mockFetch, waitFor } from './helpers.mjs';

// A DOM for the UI modules. They only touch the DOM when called, so they can be imported after.
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://reaction.retrac.space/' });
const { window } = dom;
for (const key of ['window', 'document', 'HTMLElement', 'Node']) globalThis[key] = key === 'window' ? window : window[key];
// jsdom doesn't implement modal dialogs.
window.HTMLDialogElement.prototype.showModal = function showModal() { this.open = true; };
window.HTMLDialogElement.prototype.close = function close() { this.open = false; };
window.open = () => null;

const { GREETINGS, showWelcomePill } = await import('../js/account/welcome.js');
const { check } = await import('../js/account/account.js');
const { mountResultBoard } = await import('../js/ui/leaderboard-ui.js');
const { signIn } = await import('../js/account/sign-in.js');
const { GAMES } = await import('../js/games/index.js');

const reaction = GAMES.find((g) => g.id === 'reaction');
const BOARD = `${API}/v1/games/reactionarena/leaderboards/reaction`;

test('the welcome pill greets with the Reaction Arena line instead of the soundboard one', () => {
  const lines = GREETINGS.map((g) => g('carter'));
  assert.deepEqual(lines, ['Hey, hey, carter!', "How's it going, carter?", "Let's prove your skill, carter."]);
  assert.ok(lines.every((line) => !line.includes('noise')));
});

test('the welcome pill shows the retrac.space confirmation and never renders usernames as HTML', () => {
  const pill = showWelcomePill('<img src=x onerror=alert(1)>', document, () => 0.99);
  assert.equal(pill.querySelector('.brand-name').textContent, 'retrac.space');
  assert.equal(pill.querySelector('.message').textContent, "Let's prove your skill, <img src=x onerror=alert(1)>.");
  assert.equal(pill.querySelector('.message img'), null);
  assert.match(pill.querySelector('.login-confirmation').textContent, /Logged in with your retrac\.space account\./);
  pill.remove();
});

test('a guest finishing a run is invited to sign in, and the pop-up opens once', async () => {
  mockFetch(accountRoutes(null));
  await check();
  const node = document.createElement('div');
  document.body.append(node);
  const cleanup = mountResultBoard(node, reaction, { score: 231 });
  assert.equal(node.className, 'result-board invite');
  assert.match(node.textContent, /Sign in to put 231 ms on the leaderboard/);
  await waitFor(() => signIn.isOpen(), 3000);
  assert.match(document.querySelector('.signin-dialog h2').textContent, /Put this score on the board/);

  // Signing in from the pop-up submits the run that was just finished.
  let posted = null;
  mockFetch([
    ...accountRoutes('carter'),
    [`${BOARD}/me`, () => json({ data: { personalBest: null, rank: null } })],
    [`${BOARD}/scores`, (u, o) => { posted = JSON.parse(o.body); return json({ data: { personalBest: 231, rank: 1 } }); }],
  ]);
  await check();
  await waitFor(() => node.classList.contains('best'));
  assert.deepEqual(posted, { score: 231 });
  assert.match(node.textContent, /New personal best!.*#1/s);
  signIn.finish();
  cleanup();
  node.remove();

  // A second guest run doesn't pop up again by itself.
  mockFetch(accountRoutes(null));
  await check();
  const again = document.createElement('div');
  document.body.append(again);
  const cleanupAgain = mountResultBoard(again, reaction, { score: 260 });
  await new Promise((r) => setTimeout(r, 1100));
  assert.equal(signIn.isOpen(), false);
  assert.equal(again.className, 'result-board invite');
  cleanupAgain();
});

test('scores that cannot rank say so instead of submitting', async () => {
  mockFetch(accountRoutes('carter'));
  await check();
  const node = document.createElement('div');
  document.body.append(node);
  const sequence = GAMES.find((g) => g.id === 'sequence');
  const cleanup = mountResultBoard(node, sequence, { score: 0 });
  assert.equal(node.className, 'result-board muted');
  cleanup();
});
