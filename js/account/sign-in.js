/*
 * The small sign-in dialog, following Simple Soundboard's flow: sign in at retrac.space in a
 * new tab, and this page notices when the visitor comes back and checks their session again.
 */
import { ACCOUNTS_URL, check, getState } from './account.js';

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
    description: 'Sign in with your retrac.space account to rank your scores against everyone else. We’ll open it in a new tab, then pick up right here when you’re back.',
    actions: [['open', 'Continue to retrac.space'], ['cancel', 'Not now']],
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
      description: 'Sign in with your retrac.space account and we’ll submit the score you just set. We’ll open it in a new tab, then pick up right here when you’re back.',
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
    <div class="signin-actions">${screen.actions.map(([action, label], i) =>
      `<button type="button" class="${i ? 'signin-button signin-button--quiet' : 'signin-button'}" data-action="${action}">${label}</button>`).join('')}
    </div>
  </section>`;
  if (dialog.open) dialog.querySelector('button').focus({ preventScroll: true });
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

export const signIn = {
  isOpen: () => !!dialog && dialog.open,

  // options: { stage, trigger, onCancel, onSuccess, purpose }
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
    render(SCREENS[options.stage] ? options.stage : 'confirm');
    dialog.showModal();
    dialog.querySelector('button').focus({ preventScroll: true });
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
