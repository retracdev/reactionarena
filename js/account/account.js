/*
 * The visitor's retrac.space account, using the same flow as Simple Soundboard and BasketSmash.
 *
 * The sign-in cookie belongs to accounts.retrac.space and is never readable here. This asks
 * that site who is signed in and for a short-lived token. Tokens are handed straight to the
 * caller and never stored, so nothing here keeps a credential.
 */

export const ACCOUNTS_URL = 'https://accounts.retrac.space';
const SESSION_TIMEOUT_MS = 5000;
const TOKEN_TIMEOUT_MS = 8000;

/*
 * status is one of:
 *   unknown        nothing has been checked yet
 *   authenticated  signed in, with { username }
 *   incomplete     signed in, but the account has no username yet
 *   action         signed in, but the account needs something sorted out first, with
 *                  { reason, url }. Account features stay off until it is.
 *   guest          not signed in
 *   error          the check failed, so we can't tell
 */
let state = { status: 'unknown' };
let inFlight = null;
const listeners = new Set();

function publish(next) {
  state = next;
  listeners.forEach((listener) => listener(state));
  return state;
}

// The link is opened in a new tab, so it has to be an ordinary https page.
export function safeUrl(value) {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

export function readSession(session) {
  if (session === null) return { status: 'guest' };
  // Accounts only ever tells other websites the username: { user: { username } }.
  const user = session && session.user;
  if (!user) return null;
  const action = session.actionRequired;
  if (action && action.required === true) {
    return {
      status: 'action',
      reason: typeof action.reason === 'string' ? action.reason : null,
      url: safeUrl(action.url),
    };
  }
  const username = user.username;
  return typeof username === 'string' && username.trim()
    ? { status: 'authenticated', username }
    : { status: 'incomplete' };
}

async function requestSession() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SESSION_TIMEOUT_MS);
  try {
    const response = await fetch(`${ACCOUNTS_URL}/api/auth/get-session`, {
      method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal,
    });
    if (!response.ok) throw new Error('Session unavailable');
    const next = readSession(await response.json());
    if (!next) throw new Error('Unexpected session');
    return publish(next);
  } catch {
    // A failed recheck isn't a sign-out. Anyone signed in stays that way until a real
    // answer says otherwise, and every score still proves who it's written for.
    return state.status === 'authenticated' || state.status === 'action'
      ? state : publish({ status: 'error' });
  } finally {
    clearTimeout(timeout);
  }
}

// Everyone asking at the same moment shares one request.
export function check() {
  if (!inFlight) {
    inFlight = requestSession().finally(() => { inFlight = null; });
  }
  return inFlight;
}

// Resolves to a token string. Rejects with an error carrying the HTTP status,
// where 0 means the request never completed.
export async function fetchToken(signal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, TOKEN_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${ACCOUNTS_URL}/api/auth/token`, {
      method: 'GET', credentials: 'include', cache: 'no-store', signal: controller.signal,
    });
  } catch {
    throw Object.assign(new Error('Token request failed'), { status: 0 });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
  if (!response.ok) {
    const retryAfter = Number(response.headers.get('Retry-After')) || 0;
    throw Object.assign(new Error('Token refused'), { status: response.status, retryAfter });
  }
  const body = await response.json().catch(() => null);
  const token = body && body.token;
  if (typeof token !== 'string' || !token || token.length > 8192) {
    throw Object.assign(new Error('Bad token response'), { status: 401 });
  }
  return token;
}

export const getState = () => state;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Anyone with a session counts, even before they've picked a username or while their
// account needs action: the accounts site is where they sort that out.
export function isSignedIn(s = state) {
  return s.status === 'authenticated' || s.status === 'incomplete' || s.status === 'action';
}
