/*
 * The loading screen, like Simple Soundboard's: the logo pops up with a bar under it. The bar
 * fills over a random 0.3 to 1 second. Once it's full and the app has said it's ready
 * (ReactionArenaSplash.appReady(), from js/main.js), the screen fades away, the site rises in,
 * and anything waiting on whenDone() (like the welcome pill) gets its turn.
 *
 * Live updates (js/live-update.js) show this screen again while a new version starts.
 */
(function () {
  'use strict';

  const MIN_FILL_MS = 300;
  const MAX_FILL_MS = 1000;
  const HOLD_AT_FULL_MS = 180; // A beat at 100% before it leaves, so the full bar registers.
  const LEAVE_MS = 650; // Matches the longest .splash.is-leaving transition in style.css.
  const REVEAL_MS = 900; // Matches the site-in animation in style.css.
  const GIVE_UP_MS = 10000; // If the app never says it's ready, let people in anyway.

  const root = document.documentElement;
  const splash = document.getElementById('splash');
  const fill = splash && splash.querySelector('.splash__fill');
  const waiting = [];
  let done = false;
  let leaving = false;
  let filled = false;
  let appIsReady = false;

  function flush() {
    done = true;
    waiting.splice(0).forEach((fn) => {
      try { fn(); } catch (error) { console.error(error); }
    });
  }

  window.ReactionArenaSplash = {
    // The app has rendered its first view.
    appReady() {
      appIsReady = true;
      maybeLeave();
    },

    isDone: () => done,

    // Runs fn once the screen is gone, or right away if it already is.
    whenDone(fn) {
      if (done) fn();
      else waiting.push(fn);
    },
  };

  if (!splash || !fill) {
    root.classList.remove('is-splashing');
    flush();
    return;
  }

  const reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Nothing behind the screen can be focused or read out until it's gone.
  const hidden = [...document.body.children].filter((el) => el !== splash && !el.inert);
  hidden.forEach((el) => { el.inert = true; });
  function blockKeys(event) { event.stopPropagation(); }
  window.addEventListener('keydown', blockKeys, true);

  function show(percent) {
    const value = Math.max(0, Math.min(100, percent));
    fill.style.transform = `scaleX(${value / 100})`;
    splash.setAttribute('aria-valuenow', String(Math.round(value)));
  }

  function leave() {
    if (leaving) return;
    leaving = true;
    clearTimeout(giveUp);
    splash.classList.add('is-leaving');
    root.classList.add('is-revealing');
    root.classList.remove('is-splashing');
    hidden.forEach((el) => { el.inert = false; });
    window.removeEventListener('keydown', blockKeys, true);
    setTimeout(() => {
      splash.remove();
      flush();
    }, reducedMotion ? 200 : LEAVE_MS);
    setTimeout(() => root.classList.remove('is-revealing'), REVEAL_MS + 100);
  }

  function maybeLeave() {
    if (filled && appIsReady) setTimeout(leave, HOLD_AT_FULL_MS);
  }

  // Slow at the very start and end, quick through the middle.
  function ease(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  const duration = MIN_FILL_MS + Math.random() * (MAX_FILL_MS - MIN_FILL_MS);
  const start = performance.now();
  function frame(now) {
    const t = Math.min(1, (now - start) / duration);
    show(100 * ease(t));
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      filled = true;
      maybeLeave();
    }
  }
  show(0);
  requestAnimationFrame(frame);

  const giveUp = setTimeout(() => {
    show(100);
    leave();
  }, GIVE_UP_MS);
})();
