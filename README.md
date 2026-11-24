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
css/style.css       all styles
js/main.js          router, home page, game shell (intro → play → result)
js/games/*.js       one module per test, registered in js/games/index.js
assets/             logo, mark and favicon
```

Each game exports `{ id, name, icon, color, category, tagline, howTo, run(ctx) }`. `run` builds into `ctx.stage`, uses `ctx.after / every / frame / on` so everything is cleaned up automatically, and calls `ctx.finish(result)` when done.

Results aren't saved yet. Cloud sync is planned.
