/*
 * The small sign-in dialog, following Simple Soundboard's flow. Its main button goes to the
 * retrac.space guided sign-in page in this tab, which sends the visitor back here with
 * ?signed-in, and a "You're signed in" popup greets them. The other screens still open
 * accounts in a new tab, and this page notices when the visitor comes back and checks their
 * session again.
 */
import { ACCOUNTS_URL, check, getState } from './account.js';
import { SITE } from '../share.js';
import { formatScore, rankable } from '../leaderboards.js';
import { GAMES } from '../games/index.js';

const GUIDED_URL = `${ACCOUNTS_URL}/guided-setup`;
const SITE_URL = `${SITE}/`;
// 960x1200, made by `npm run build:social`. Guided setup only shows art from retrac.space.
const GUIDED_IMAGE = `${SITE}/assets/social/guided-setup.jpg`;
const RETURN_PARAM = 'signed-in';
// A guest's finished run, kept for this tab while they're away at guided setup.
const CARRY_KEY = 'reaction-arena:run-after-sign-in';
const CARRY_MAX_AGE_MS = 30 * 60 * 1000;

// What each reason from accounts means for the visitor. Any other reason gets no sentence.
const ACTION_REASONS = {
  account_review: 'Your account needs a quick review. There may be a few steps to verify it’s really you.',
  inappropriate_username: 'Your username isn’t allowed and needs to be changed.',
  inappropriate_content: 'Some of what you’ve posted on retrac.space needs to be removed.',
  account_suspended: 'Your account is temporarily unavailable.',
  auth_unlink_google: 'Sign in with Google is no longer available for your account. Set a new password to avoid being locked out.',
};

const SCREENS = {
  confirm: {
    title: 'Get on the leaderboard',
    description: 'Sign in with your retrac.space account to rank your scores against everyone else. We’ll bring you right back here when you’re done.',
    actions: [['guided', 'Sign in or create account'], ['cancel', 'Not now']],
  },
  waiting: {
    title: 'Finish signing in',
    description: 'Sign in or create your account in the new tab. When you’re finished, come back here.',
    actions: [['verify', 'I’ve signed in'], ['open', 'Open accounts again'], ['cancel', 'Cancel']],
  },
  checking: {
    title: 'Checking your account',
    description: 'Just a moment.',
    actions: [['cancel', 'Cancel']],
  },
  guest: {
    title: 'Not signed in yet',
    description: 'We couldn’t find your account. Finish signing in, then come back and try again.',
    actions: [['verify', 'Try again'], ['open', 'Open accounts'], ['cancel', 'Cancel']],
  },
  error: {
    title: 'Couldn’t check your account',
    description: 'We couldn’t reach retrac.space just now. Please try again in a moment. Every test still works without signing in.',
    actions: [['verify', 'Try again'], ['open', 'Open accounts'], ['cancel', 'Cancel']],
  },
  incomplete: {
    title: 'Finish setting up your account',
    description: 'Choose a username at retrac.space to get on the leaderboard, then come back here.',
    actions: [['open', 'Open accounts'], ['verify', 'I’ve finished'], ['cancel', 'Cancel']],
  },
  action: {
    title: 'Action is required on your account',
    description: 'You can keep playing, but leaderboards and other account features are off until it’s resolved.',
    actions: [['resolve', 'Resolve Issue'], ['cancel', 'Continue Signed Out']],
  },
};

// Wording for a specific reason to sign in. Other screens are shared.
const PURPOSES = {
  leaderboard: {},
  score: {
    confirm: {
      title: 'Put this score on the board',
      description: 'Sign in with your retrac.space account and we’ll submit the score you just set. We’ll bring you right back here when you’re done.',
    },
  },
  account: {
    confirm: {
      title: 'Unlock the full Reaction Arena experience',
      description: 'Login or create a retrac.space account to get started.',
    },
    incomplete: {
      description: 'Choose a username at retrac.space to finish setting up your account, then come back here.',
    },
  },
};

let dialog = null;
let stage = 'confirm';
let started = false;
let away = false;
let trigger = null;
let onCancel = null;
let onSuccess = null;
let purpose = 'leaderboard';
let carry = null;
let flow = 0;
let returnTimer = null;

function render(next) {
  stage = next;
  const screen = { ...SCREENS[next], ...((PURPOSES[purpose] || {})[next] || {}) };
  if (next === 'action') {
    const reason = ACTION_REASONS[getState().reason];
    if (reason) screen.description = `${reason} ${screen.description}`;
  }
  const waiting = next === 'waiting' || next === 'checking';
  dialog.innerHTML = `<section class="signin-panel">
    <div class="signin-brand"><img src="assets/retrac-space-icon.png" alt=""><span>retrac.space</span></div>
    <h2 id="signin-title">${screen.title}</h2>
    <p id="signin-description">${screen.description}</p>
    ${waiting ? '<p class="signin-waiting" role="status"><span aria-hidden="true"></span>Waiting for your account</p>' : ''}
    <div class="signin-actions">${screen.actions.map(([action, label], i) => {
      const cls = i ? 'signin-button signin-button--quiet' : 'signin-button';
      // A plain link: an ordinary trip to accounts and back, in this tab.
      if (action === 'guided') return `<a class="${cls}" data-action="guided" href="${escapeAttr(guidedUrl())}">${label}</a>`;
      return `<button type="button" class="${cls}" data-action="${action}">${label}</button>`;
    }).join('')}
    </div>
  </section>`;
  if (dialog.open) dialog.querySelector('[data-action]').focus({ preventScroll: true });
}

function escapeAttr(text) {
  return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Guided setup only sends people back to retrac.space sites and localhost, so anywhere
// else (a preview host, say) comes back to the real site instead.
export function returnUrl(href = window.location.href) {
  const here = new URL(href);
  const host = here.hostname;
  const allowed = /^https?:$/.test(here.protocol)
    && (host === 'retrac.space' || host.endsWith('.retrac.space') || host === 'localhost');
  const url = allowed ? here : new URL(SITE_URL);
  url.searchParams.set(RETURN_PARAM, '1');
  return url.href;
}

export function guidedUrl(href) {
  const params = new URLSearchParams({ app: 'Reaction Arena', redirect: returnUrl(href), image: GUIDED_IMAGE });
  return `${GUIDED_URL}?${params}`;
}

function storage() {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

// Leaving for guided setup: keep the run to submit once they're back, or forget an old one.
function rememberCarry() {
  try {
    if (carry) storage()?.setItem(CARRY_KEY, JSON.stringify({ ...carry, at: Date.now() }));
    else storage()?.removeItem(CARRY_KEY);
  } catch {
    // Without storage, the run just isn't submitted after the trip.
  }
}

function restoreFocus() {
  if (trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
  trigger = null;
}

function close() {
  flow++;
  started = false;
  away = false;
  clearTimeout(returnTimer);
  if (dialog.open) dialog.close();
  restoreFocus();
}

function cancel() {
  const notify = onCancel;
  onCancel = null;
  onSuccess = null;
  close();
  if (notify) notify();
}

function openAccounts() {
  // Runs directly in a button click, so browsers allow the new tab.
  started = true;
  away = false;
  window.open(ACCOUNTS_URL, '_blank', 'noopener');
  render('waiting');
}

function resolveIssue() {
  // Coming back to this tab checks the account again, the same as after signing in.
  started = true;
  away = false;
  window.open(getState().url || ACCOUNTS_URL, '_blank', 'noopener');
}

async function verify() {
  clearTimeout(returnTimer);
  if (!dialog.open || stage === 'checking') return;
  away = false;
  const current = flow;
  render('checking');
  const session = await check();
  if (!dialog.open || flow !== current) return;
  // A successful sign-in closes this dialog through the account listener in main.js.
  if (session.status === 'authenticated') return;
  render(SCREENS[session.status] ? session.status : 'error');
}

function markAway() {
  if (dialog.open && started) away = true;
}

function onReturn() {
  if (!dialog.open || !started || !away || document.hidden || !document.hasFocus()) return;
  away = false;
  clearTimeout(returnTimer);
  // visibilitychange and focus usually arrive together, so act on just one of them.
  returnTimer = setTimeout(() => {
    if (document.hidden || !document.hasFocus()) markAway();
    else verify();
  }, 200);
}

function ensureDialog() {
  if (dialog) return;
  dialog = document.createElement('dialog');
  dialog.className = 'signin-dialog';
  dialog.setAttribute('aria-labelledby', 'signin-title');
  dialog.setAttribute('aria-describedby', 'signin-description');
  document.body.append(dialog);

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) {
      cancel();
      return;
    }
    const button = event.target.closest('[data-action]');
    if (!button) return;
    // The link leaves for accounts on its own, and the dialog stays as it is until then.
    if (button.dataset.action === 'guided') {
      rememberCarry();
      return;
    }
    if (button.dataset.action === 'open') openAccounts();
    else if (button.dataset.action === 'resolve') resolveIssue();
    else if (button.dataset.action === 'verify') verify();
    else cancel();
  });

  // The dialog's keys belong to it, not to the page's shortcuts.
  dialog.addEventListener('keydown', (event) => event.stopPropagation());
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    cancel();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) markAway();
    else onReturn();
  });
  window.addEventListener('blur', markAway);
  window.addEventListener('focus', onReturn);
}

// ---------- Back from guided setup ----------

// Read once, then taken out of the address so a reload or a copied link doesn't repeat it.
function takeReturnFlag() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(RETURN_PARAM)) return false;
    url.searchParams.delete(RETURN_PARAM);
    window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    return true;
  } catch {
    return false;
  }
}

// The run a guest left with, if it's recent and still a real score. Always cleared.
function takeStoredCarry() {
  try {
    const raw = storage()?.getItem(CARRY_KEY);
    storage()?.removeItem(CARRY_KEY);
    const run = raw && JSON.parse(raw);
    if (!run || !(Date.now() - run.at <= CARRY_MAX_AGE_MS) || !rankable(run.board, run.score)) return null;
    return { board: run.board, score: run.score };
  } catch {
    return null;
  }
}

const returned = takeReturnFlag();
let carried = returned ? takeStoredCarry() : null;
// Kept for the popup's wording, after main.js has taken `carried` to submit it.
const returnedRun = carried;
let done = null;
// Toasts about the trip wait until the popup has been dismissed, or turned out not to be needed.
let welcomePending = returned;
const afterDone = [];

function settleWelcome() {
  welcomePending = false;
  afterDone.splice(0).forEach((fn) => fn());
}

function ensureDone() {
  if (done) return;
  done = document.createElement('dialog');
  done.className = 'signin-dialog signed-in-dialog';
  done.setAttribute('aria-labelledby', 'signed-in-title');
  done.setAttribute('aria-describedby', 'signed-in-description');
  done.innerHTML = `<section class="signin-panel signed-in-panel">
    <svg class="signed-in-check" viewBox="0 0 52 52" aria-hidden="true">
      <circle class="signed-in-check__ring" cx="26" cy="26" r="23"></circle>
      <path class="signed-in-check__mark" d="m15.5 27 7 7 14-15"></path>
    </svg>
    <h2 id="signed-in-title">You’re signed in</h2>
    <p id="signed-in-description"></p>
    <div class="signin-actions"><button type="button" class="signin-button" data-action="done">Done</button></div>
  </section>`;
  document.body.append(done);
  done.addEventListener('click', (event) => {
    if (event.target === done || event.target.closest('[data-action="done"]')) done.close();
  });
  done.addEventListener('keydown', (event) => event.stopPropagation());
  done.addEventListener('close', settleWelcome);
}

function showSignedIn(username, run) {
  ensureDone();
  if (signIn.isOpen() || done.open) {
    settleWelcome();
    return;
  }
  const game = run && GAMES.find((g) => g.id === run.board);
  const next = game
    ? `We’re putting your ${formatScore(run.board, run.score)} on the ${game.name} leaderboard.`
    : 'Your scores now count on the Reaction Arena leaderboards.';
  // Usernames come from the account, so they must never be treated as HTML.
  done.querySelector('#signed-in-description').textContent = `Welcome, ${username}. ${next}`;
  done.showModal();
  done.querySelector('button').focus({ preventScroll: true });
}

async function welcomeBack() {
  const run = returnedRun;
  const state = await check();
  if (state.status === 'authenticated') {
    showSignedIn(state.username, run);
    return;
  }
  settleWelcome();
  // An account that needs action gets its own popup from main.js.
  if (state.status !== 'action' && !signIn.isOpen()) {
    signIn.open({
      stage: SCREENS[state.status] ? state.status : 'error',
      purpose: run ? 'score' : 'leaderboard',
      onCancel: () => { carried = null; },
    });
  }
}

if (returned) {
  // After the loading screen, so the popup isn't hidden behind it.
  const splash = window.ReactionArenaSplash;
  if (splash) splash.whenDone(welcomeBack);
  else Promise.resolve().then(welcomeBack);
}

/** The run a guest finished before guided setup, once, for main.js to submit when signed in. */
export function takeCarriedRun() {
  const run = carried;
  carried = null;
  return run;
}

export const signIn = {
  isOpen: () => !!dialog && dialog.open,

  // True when this page load came straight back from guided setup.
  returnedFromSignIn: returned,

  // Runs fn once the "You're signed in" popup has closed, or right away if there isn't one.
  afterSignedIn(fn) {
    if (welcomePending) afterDone.push(fn);
    else fn();
  },

  // options: { stage, trigger, onCancel, onSuccess, purpose, carry }
  // carry: { board, score }, a guest's run to submit after a trip to guided setup.
  open(options = {}) {
    ensureDialog();
    if (dialog.open) return;
    flow++;
    started = false;
    away = false;
    trigger = options.trigger || null;
    onCancel = options.onCancel || null;
    onSuccess = options.onSuccess || null;
    purpose = PURPOSES[options.purpose] ? options.purpose : 'leaderboard';
    carry = options.carry || null;
    render(SCREENS[options.stage] ? options.stage : 'confirm');
    dialog.showModal();
    dialog.querySelector('[data-action]').focus({ preventScroll: true });
  },

  // Called once the visitor is signed in. The dialog's job is done.
  finish() {
    if (!dialog) return;
    const notify = onSuccess;
    onSuccess = null;
    onCancel = null;
    close();
    if (notify) notify();
  },
};

/** Opens the dialog at the right screen for the current account state. */
export async function promptSignIn(options = {}) {
  let state = getState();
  if (state.status === 'unknown' || state.status === 'error') state = await check();
  if (state.status === 'authenticated') {
    options.onSuccess?.();
    return;
  }
  signIn.open({ ...options, stage: state.status === 'guest' || !SCREENS[state.status] ? 'confirm' : state.status });
}
