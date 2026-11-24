import { el, randInt, grade, replay } from '../util.js';
import { lives as livesHtml } from '../icons.js';

const LIVES = 3;
const STRIKES = 3;

const gridFor = (level) => (level <= 2 ? 3 : level <= 5 ? 4 : level <= 8 ? 5 : level <= 12 ? 6 : 7);

export default {
  id: 'visual',
  name: 'Visual Memory',
  icon: 'eye',
  color: '#38bdf8',
  category: 'Memory',
  tagline: 'Memorize a pattern before it disappears.',
  howTo: `A pattern of tiles flashes briefly — then tap every tile you remember. ${STRIKES} wrong taps costs a life. You have <b>${LIVES} lives</b>.`,

  run(ctx) {
    const wrap = el('div', 'mem-wrap');
    wrap.innerHTML = `<div class="mem-status">Get ready</div><div class="tile-grid vis"></div>`;
    ctx.stage.append(wrap);
    const status = wrap.querySelector('.mem-status');
    const grid = wrap.querySelector('.tile-grid');

    let level = 1;
    let lives = LIVES;
    let strikes = 0;
    let pattern = new Set();
    let found = new Set();
    let accepting = false;
    let tiles = [];

    const setStatus = (txt, cls = '') => { status.textContent = txt; status.className = `mem-status ${cls}`; };
    const hud = () => ctx.hud([
      { label: 'Level', value: level },
      { label: 'Tiles', value: accepting ? `${found.size}/${pattern.size}` : pattern.size || '—' },
      { label: 'Lives', value: livesHtml(lives, LIVES) },
    ]);

    async function round() {
      const n = gridFor(level);
      const count = level + 2;
      strikes = 0;
      found = new Set();
      pattern = new Set();
      accepting = false;
      while (pattern.size < count) pattern.add(randInt(0, n * n - 1));

      grid.style.setProperty('--n', n);
      grid.classList.remove('active');
      grid.innerHTML = Array.from({ length: n * n }, (_, i) => `<button type="button" class="tile" data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('');
      tiles = [...grid.children];
      replay(grid, 'enter');
      setStatus('Memorize');
      hud();

      await ctx.wait(500);
      pattern.forEach((i) => tiles[i].classList.add('show'));
      await ctx.wait(900 + count * 70);
      pattern.forEach((i) => tiles[i].classList.remove('show'));
      await ctx.wait(250);
      accepting = true;
      grid.classList.add('active');
      setStatus('Find the tiles', 'go');
      hud();
    }

    ctx.on(grid, 'pointerdown', async (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || !accepting) return;
      e.preventDefault();
      const i = Number(tile.dataset.i);
      if (found.has(i) || tile.classList.contains('wrong')) return;

      if (pattern.has(i)) {
        found.add(i);
        tile.classList.add('found');
        hud();
        if (found.size === pattern.size) {
          accepting = false;
          grid.classList.remove('active');
          setStatus('Level cleared!', 'good');
          replay(grid, 'win');
          await ctx.wait(750);
          level++;
          round();
        }
        return;
      }

      strikes++;
      tile.classList.add('wrong');
      if (strikes < STRIKES) return;

      accepting = false;
      grid.classList.remove('active');
      lives--;
      hud();
      pattern.forEach((p) => { if (!found.has(p)) tiles[p].classList.add('missed'); });
      replay(grid, 'shake');
      setStatus(lives > 0 ? 'Life lost — try again' : 'Game over', 'bad');
      await ctx.wait(1500);
      if (lives <= 0) finish();
      else round();
    });

    function finish() {
      const score = level - 1;
      ctx.finish({
        label: 'Levels cleared',
        value: score,
        score,
        unit: score === 1 ? 'level' : 'levels',
        rating: grade(score, [[14, 'Eidetic'], [10, 'Photographic'], [7, 'Great memory'], [4, 'Good memory']], 'Getting started'),
        blurb: 'Try chunking the pattern into shapes — it\'s easier to remember a "T" than five tiles.',
        stats: [
          { label: 'Final pattern', value: `${level + 2} tiles` },
          { label: 'Largest grid', value: `${gridFor(level)}×${gridFor(level)}` },
        ],
      });
    }

    round();
  },
};
