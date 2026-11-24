export const ACCOUNTS = 'https://accounts.retrac.space';
export const API = 'https://space-api.retrac-space.workers.dev';

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

/**
 * Replaces global fetch with a router. `routes` is a list of [test, respond] where test is a
 * substring or a function of (url, options). Unmatched requests fail like a network error.
 * Returns the list of calls made, for assertions.
 */
export function mockFetch(routes) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    for (const [match, respond] of routes) {
      const hit = typeof match === 'function' ? match(String(url), options) : String(url).includes(match);
      if (hit) return respond(String(url), options);
    }
    throw new TypeError('Failed to fetch');
  };
  return calls;
}

/** A signed-in account whose token belongs to `username`. */
export function accountRoutes(username) {
  return [
    [`${ACCOUNTS}/api/auth/get-session`, () => json(username ? { user: { username } } : null)],
    [`${ACCOUNTS}/api/auth/token`, () => json({ token: `header.${btoa(JSON.stringify({ sub: `id-${username}` }))}.sig` })],
  ];
}

export function waitFor(predicate, timeout = 2000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      const value = predicate();
      if (value) return resolve(value);
      if (Date.now() - start > timeout) return reject(new Error('Timed out waiting'));
      setTimeout(poll, 5);
    })();
  });
}
