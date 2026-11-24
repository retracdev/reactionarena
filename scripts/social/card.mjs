/*
 * The HTML for one 1200×630 social card. Rendered to JPEG by scripts/build-social.mjs.
 */
import fs from 'node:fs';
import { GAMES } from '../../js/games/index.js';
import { icon } from '../../js/icons.js';

const MARK = fs.readFileSync(new URL('../../assets/logo-mark.svg', import.meta.url), 'utf8');

const FONTS = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Space+Grotesk:wght@700&display=block';

const BASE_CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    position: relative;
    width: 1200px;
    height: 630px;
    overflow: hidden;
    background: #0a0b09;
    color: #f3f6ee;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .glow {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(780px 520px at 8% -18%, color-mix(in srgb, var(--accent) 34%, transparent), transparent 62%),
      radial-gradient(640px 460px at 104% 8%, rgba(181, 239, 90, 0.14), transparent 60%),
      radial-gradient(720px 420px at 70% 125%, color-mix(in srgb, var(--accent) 18%, transparent), transparent 60%);
  }
  .grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
    background-size: 56px 56px;
    -webkit-mask-image: radial-gradient(ellipse 90% 80% at 30% 20%, #000 10%, transparent 75%);
  }
  .top {
    position: absolute;
    top: 52px;
    left: 64px;
    right: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .brand { display: flex; align-items: center; gap: 16px; }
  .brand svg { width: 56px; height: 56px; border-radius: 13px; box-shadow: 0 10px 34px -10px rgba(101, 200, 46, 0.9); }
  .wordmark { font: 700 36px/1 'Space Grotesk', sans-serif; letter-spacing: -0.035em; }
  .wordmark span { color: #9fd45f; }
  .collection {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 20px;
    border-radius: 999px;
    font-size: 19px;
    color: #7d8577;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.04);
  }
  .collection b { font: 700 21px/1 'Space Grotesk', sans-serif; letter-spacing: -0.02em; color: #f3f6ee; }
  .collection b span { color: #948ec0; }
  .bottom {
    position: absolute;
    left: 64px;
    right: 64px;
    bottom: 50px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 21px;
    font-weight: 500;
    color: #7d8577;
  }
  .bottom strong { color: #b7bdb0; font-weight: 600; }
  .bottom .pill {
    display: flex;
    align-items: center;
    gap: 10px;
    color: #b7bdb0;
  }
  .bottom .pill .ico { width: 24px; height: 24px; color: #fbbf24; }
  .ico { display: block; }
  .tile {
    display: grid;
    place-items: center;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 14%, #0a0b09);
    border: 1.5px solid color-mix(in srgb, var(--c) 34%, transparent);
  }
  h1 { margin: 0; font-weight: 800; letter-spacing: -0.045em; line-height: 1; }
  p { margin: 0; text-wrap: balance; }
  h1 { text-wrap: balance; }
  .grad {
    background: linear-gradient(100deg, #f4ffe2 0%, #c4f46e 45%, #5cc22e 100%);
    -webkit-background-clip: text;
    color: transparent;
  }
`;

function frame(accent, body, extraCss = '') {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>${BASE_CSS}${extraCss}</style>
</head>
<body style="--accent:${accent}">
  <div class="glow"></div>
  <div class="grid"></div>
  <div class="top">
    <div class="brand">${MARK}<div class="wordmark">reaction<span>arena</span></div></div>
    <div class="collection">part of <b>retrac<span>.space</span></b></div>
  </div>
  ${body}
  <div class="bottom">
    <span><strong>reaction.retrac.space</strong> · free to play</span>
    <span class="pill">${icon('trophy')} Leaderboards with retrac.space</span>
  </div>
</body></html>`;
}

function home() {
  const tiles = GAMES.map((g) => `<div class="tile" style="--c:${g.color}">${icon(g.icon)}</div>`).join('');
  return frame('#84cc16', `
    <div class="home">
      <h1>How quick is your <span class="grad">mind</span>, really?</h1>
      <p>Ten bite-sized tests for reflexes, memory, focus and precision.</p>
      <div class="tiles">${tiles}</div>
    </div>`, `
    .home { position: absolute; left: 64px; right: 64px; top: 150px; }
    .home h1 { font-size: 80px; max-width: 900px; }
    .home p { margin-top: 20px; font-size: 28px; color: #b7bdb0; }
    .tiles { display: flex; gap: 14px; margin-top: 38px; }
    .tiles .tile { width: 80px; height: 80px; border-radius: 22px; }
    .tiles .ico { width: 38px; height: 38px; }
  `);
}

function test(id) {
  const g = GAMES.find((x) => x.id === id);
  return frame(g.color, `
    <div class="test">
      <div class="eyebrow">${g.category} test</div>
      <h1>${g.name}</h1>
      <p>${g.tagline}</p>
    </div>
    <div class="rings" style="--c:${g.color}">
      <span></span><span></span><span></span>
      <div class="ghost">${icon(g.icon)}</div>
    </div>`, `
    .test { position: absolute; left: 64px; top: 0; bottom: 0; width: 700px; display: flex; flex-direction: column; justify-content: center; padding-bottom: 10px; }
    .eyebrow { font-size: 20px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent); }
    .test h1 { margin-top: 12px; font-size: 88px; }
    .test p { margin-top: 18px; font-size: 31px; line-height: 1.32; color: #b7bdb0; }
    .rings { position: absolute; left: 960px; top: 330px; color: var(--c); }
    .rings span {
      position: absolute;
      left: 50%;
      top: 50%;
      border-radius: 50%;
      border: 1.5px solid color-mix(in srgb, var(--c) 30%, transparent);
      transform: translate(-50%, -50%);
    }
    .rings span:nth-child(1) { width: 220px; height: 220px; background: color-mix(in srgb, var(--c) 10%, transparent); }
    .rings span:nth-child(2) { width: 360px; height: 360px; border-color: color-mix(in srgb, var(--c) 20%, transparent); }
    .rings span:nth-child(3) { width: 500px; height: 500px; border-color: color-mix(in srgb, var(--c) 11%, transparent); }
    .ghost { position: absolute; left: 0; top: 0; transform: translate(-50%, -50%); filter: drop-shadow(0 0 30px var(--c)); }
    .ghost .ico { width: 120px; height: 120px; stroke-width: 1.6; }
  `);
}

function leaderboards() {
  const spots = [
    { place: 2, color: '#cbd5e1', h: 150 },
    { place: 1, color: '#fbbf24', h: 210 },
    { place: 3, color: '#f59e6b', h: 110 },
  ];
  const podium = spots.map((s) => `
    <div class="spot" style="--m:${s.color}">
      <div class="medal">${icon('trophy')}<b>${s.place}</b></div>
      <div class="base" style="height:${s.h}px"></div>
    </div>`).join('');
  return frame('#fbbf24', `
    <div class="lb">
      <div class="eyebrow">All ten tests</div>
      <h1>Leaderboards</h1>
      <p>Who's the fastest? Sign in with retrac.space and claim your spot.</p>
    </div>
    <div class="podium">${podium}</div>`, `
    .lb { position: absolute; left: 64px; top: 170px; width: 600px; }
    .eyebrow { font-size: 20px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: #fbbf24; }
    .lb h1 { margin-top: 12px; font-size: 88px; }
    .lb p { margin-top: 20px; font-size: 30px; line-height: 1.32; color: #b7bdb0; }
    .podium { position: absolute; right: 72px; bottom: 120px; display: flex; align-items: flex-end; gap: 14px; }
    .spot { display: flex; flex-direction: column; align-items: center; gap: 16px; width: 122px; }
    .medal {
      position: relative;
      display: grid;
      place-items: center;
      width: 84px;
      height: 84px;
      border-radius: 50%;
      color: var(--m);
      background: color-mix(in srgb, var(--m) 14%, #0a0b09);
      border: 1.5px solid color-mix(in srgb, var(--m) 50%, transparent);
      box-shadow: 0 0 60px -12px var(--m);
    }
    .medal .ico { width: 40px; height: 40px; }
    .medal b {
      position: absolute;
      right: -4px;
      bottom: -4px;
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 17px;
      font-weight: 800;
      color: #0f1a06;
      background: var(--m);
    }
    .base {
      width: 100%;
      border-radius: 20px 20px 0 0;
      background: linear-gradient(180deg, color-mix(in srgb, var(--m) 32%, transparent), color-mix(in srgb, var(--m) 4%, transparent));
      border: 1.5px solid color-mix(in srgb, var(--m) 38%, transparent);
      border-bottom: 0;
    }
  `);
}

/*
 * 960×1200 art for the retrac.space guided sign-in page: the logo in the middle, over tilted
 * rows of the home page's test cards.
 */
export const GUIDED_SIZE = { width: 960, height: 1200 };

export function guidedHtml() {
  const tile = (g) => `
    <div class="gcard" style="--c:${g.color}">
      <div class="gcard-top"><span class="gcard-icon">${icon(g.icon)}</span></div>
      <h3>${g.name}</h3>
      <p>${g.tagline}</p>
      <div class="gcard-foot"><span>${g.category}</span><span class="go">Play ${icon('arrowRight')}</span></div>
    </div>`;
  const ROWS = 9;
  const PER_ROW = 7;
  let rows = '';
  for (let r = 0; r < ROWS; r++) {
    let row = '';
    // Shifted by three each row, so neighbours above and below are different tests.
    for (let i = 0; i < PER_ROW; i++) row += tile(GAMES[(r * 3 + i) % GAMES.length]);
    rows += `<div class="grow">${row}</div>`;
  }
  return `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${FONTS}">
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    position: relative;
    width: ${GUIDED_SIZE.width}px;
    height: ${GUIDED_SIZE.height}px;
    overflow: hidden;
    background: #0a0b09;
    color: #f3f6ee;
    font-family: 'Inter', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .ico { display: block; }
  .rows {
    position: absolute;
    inset: -12% -45%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 26px;
    transform: rotate(-9deg);
  }
  .grow { display: flex; justify-content: center; gap: 22px; }
  .grow:nth-child(even) { transform: translateX(-140px); }
  .gcard {
    flex: none;
    display: flex;
    flex-direction: column;
    width: 270px;
    height: 236px;
    padding: 22px;
    border-radius: 22px;
    border: 1.5px solid color-mix(in srgb, var(--c) 30%, rgba(255, 255, 255, 0.08));
    background:
      radial-gradient(260px circle at 20% 0%, color-mix(in srgb, var(--c) 22%, transparent), transparent 70%),
      linear-gradient(180deg, #171a14, #0f110d);
    box-shadow: 0 24px 40px -18px rgba(0, 0, 0, 0.8), 0 18px 46px -26px color-mix(in srgb, var(--c) 70%, transparent);
  }
  .gcard-top { margin-bottom: 16px; }
  .gcard-icon {
    display: grid;
    place-items: center;
    width: 50px;
    height: 50px;
    border-radius: 15px;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 15%, transparent);
    border: 1px solid color-mix(in srgb, var(--c) 30%, transparent);
  }
  .gcard-icon .ico { width: 25px; height: 25px; }
  .gcard h3 { margin: 0 0 6px; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
  .gcard p { flex: 1; margin: 0; font-size: 15px; line-height: 1.45; color: #b7bdb0; overflow: hidden; }
  .gcard-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #7d8577;
  }
  .gcard-foot .go { display: flex; align-items: center; gap: 6px; font-size: 14px; letter-spacing: 0; text-transform: none; color: var(--c); }
  .gcard-foot .go .ico { width: 15px; height: 15px; }
  /* Darkens the middle so the logo stands out, and the top and bottom a little. */
  .shade {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle 380px at 50% 50%, rgba(10, 11, 9, 0.94) 38%, rgba(10, 11, 9, 0.6) 70%, rgba(10, 11, 9, 0.2)),
      linear-gradient(180deg, rgba(10, 11, 9, 0.55), transparent 24%, transparent 76%, rgba(10, 11, 9, 0.55));
  }
  .halo {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 600px;
    height: 600px;
    transform: translate(-50%, -54%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(163, 230, 53, 0.36), rgba(163, 230, 53, 0.1) 45%, transparent 70%);
  }
  .logo {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 34px;
  }
  .logo svg { width: 260px; height: 260px; filter: drop-shadow(0 28px 44px rgba(0, 0, 0, 0.7)) drop-shadow(0 0 60px rgba(132, 204, 22, 0.35)); }
  .logo .wordmark { font: 700 72px/1 'Space Grotesk', sans-serif; letter-spacing: -0.04em; text-shadow: 0 8px 30px rgba(0, 0, 0, 0.8); }
  .logo .wordmark span { color: #9fd45f; }
</style>
</head>
<body>
  <div class="rows">${rows}</div>
  <div class="shade"></div>
  <div class="halo"></div>
  <div class="logo">${MARK}<div class="wordmark">reaction<span>arena</span></div></div>
</body></html>`;
}

export function cardHtml(card) {
  if (card.kind === 'home') return home();
  if (card.kind === 'leaderboards') return leaderboards();
  if (card.kind === 'test') return test(card.id);
  throw new Error(`Unknown card kind: ${card.kind}`);
}
