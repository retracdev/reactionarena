<p align="center">
  <img src="assets/logo.svg" alt="Reaction Arena" width="360">
</p>

<p align="center">Ten quick browser challenges for reflexes, memory, focus and precision.<br>Part of the <a href="https://retrac.space">retrac.space</a> collection.</p>

## Tests

| # | Test | What it measures |
|---|------|------------------|
| 01 | Reaction Time | Click as soon as the screen turns green (average of 5). |
| 02 | Aim Trainer | Hit 30 randomly positioned targets as quickly as possible. |
| 03 | Typing Speed | Words per minute and accuracy over 30 seconds. |
| 04 | Sequence Memory | Repeat an ever-growing sequence of tiles. |
| 05 | Click Speed | Clicks per second over 5 seconds. |
| 06 | Time Perception | Stop a hidden timer at exactly 10 seconds (3 rounds). |
| 07 | Color Detection | Spot the slightly different tile as the grid grows. |
| 08 | Mental Math | Solve as many problems as possible in 30 seconds. |
| 09 | Precision | Click as close to the center of drifting targets as possible. |
| 10 | Visual Memory | Memorize a pattern of tiles before it disappears. |

## Development

It's a static site with no build step: plain HTML, CSS and ES modules. ES modules don't load over `file://`, so serve the folder locally:

```sh
npx serve .
# or
python -m http.server
```

Routing is hash-based (`#/reaction`, `#/aim`, …), so it works on GitHub Pages without any extra config.

### Structure

```
index.html          page shell (header, footer)
css/style.css       site and game styles
css/accounts.css    sign-in, welcome pill and leaderboard styles
js/main.js          router, home page, game shell (intro → play → result)
js/games/*.js       one module per test, registered in js/games/index.js
js/account/         retrac.space session, sign-in pop-up, welcome pill
js/leaderboards.js  boards, API client and score submission
js/ui/              leaderboard page, per-test top five, results-screen status
assets/             logo, mark and favicon
```

Each game exports `{ id, name, icon, color, category, tagline, howTo, run(ctx) }`. `run` builds into `ctx.stage`, uses `ctx.after / every / frame / on` so everything is cleaned up automatically, and calls `ctx.finish(result)` when done.

## Accounts & leaderboards

Sign-in uses your [retrac.space](https://accounts.retrac.space) account, with the same flow as Simple Soundboard and BasketSmash. The sign-in cookie stays on accounts.retrac.space. This site asks it who is signed in, and fetches a short-lived token only when it needs to write a score. Tokens are never stored.

- Signed in, every finished run is submitted to that test's leaderboard on the retrac.space API, which keeps each player's personal best.
- Guests can play everything but can't rank. Finishing a run as a guest opens a sign-in pop-up (once per visit), and signing in from it submits that run.
- `#/leaderboards/<test>` shows the full rankings, and each test page shows the top five.

The backend has to trust `https://reaction.retrac.space` and know the game's boards before any of this works. See [docs/backend-setup.md](docs/backend-setup.md).

## Tests

```sh
npm install
npm test
```

Tests run in Node with mocked `fetch` (and jsdom for the UI), so they never call the real services.
