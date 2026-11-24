import { el, rand, randInt, grade, replay } from '../util.js';
import { lives as livesHtml } from '../icons.js';

const LIVES = 3;

export default {
  id: 'color',
  name: 'Color Detection',
  icon: 'color',
  color: '#e879f9',
  category: 'Perception',
  tagline: 'Identify the slightly different colored tile.',
  howTo: `One tile is a slightly different shade. Find it! The grid grows and the difference shrinks every level. You have <b>${LIVES} lives</b>.`,

  run(ctx) {
    const wrap = el('div', 'mem-wrap');
    wrap.innerHTML = `<div class="mem-status">Find the odd one out</div><div class="tile-grid clr"></div>`;
    ctx.stage.append(wrap);
    const status = wrap.querySelector('.mem-status');
    const grid = wrap.querySelector('.tile-grid');

    let level = 1;
    let lives = LIVES;
    let odd = -1;
    let n = 2;
    let delta = 0;
    let busy = false;

    const hud = () => ctx.hud([
      { label: 'Level', value: level },
      { label: 'Grid', value: `${n}×${n}` },
      { label: 'Lives', value: livesHtml(lives, LIVES) },
    ]);

    function build() {
      n = Math.min(8, 2 + Math.floor(level / 2));
      delta = Math.max(2, 22 * Math.pow(0.865, level - 1));
      const h = rand(0, 360);
      const s = rand(48, 78);
      const l = rand(40, 60);
      const l2 = l + (Math.random() < 0.5 ? -delta : delta);
      odd = randInt(0, n * n - 1);
      grid.style.setProperty('--n', n);
      let html = '';
      for (let i = 0; i < n * n; i++) {
        const light = i === odd ? l2 : l;
        html += `<button type="button" class="tile" data-i="${i}" aria-label="Tile ${i + 1}" style="background:hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${light.toFixed(2)}%)"></button>`;
      }
      grid.innerHTML = html;
      replay(grid, 'enter');
      busy = false;
      hud();
    }

    ctx.on(grid, 'pointerdown', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || busy) return;
      e.preventDefault();
      const i = Number(tile.dataset.i);
      if (i === odd) {
        level++;
        status.textContent = 'Nice eye!';
        status.className = 'mem-status good';
        build();
        return;
      }
      busy = true;
      lives--;
      hud();
      tile.classList.add('nope');
      grid.children[odd].classList.add('reveal');
      replay(grid, 'shake');
      status.textContent = lives > 0 ? 'Not quite — there it was' : 'Out of lives';
      status.className = 'mem-status bad';
      ctx.after(1100, () => {
        if (lives <= 0) return finish();
        status.textContent = 'Find the odd one out';
        status.className = 'mem-status';
        build();
      });
    });

    function finish() {
      const score = level - 1;
      ctx.finish({
        label: 'Levels cleared',
        value: score,
        unit: score === 1 ? 'level' : 'levels',
        rating: grade(score, [[24, 'Colorist'], [18, 'Eagle eye'], [12, 'Sharp eye'], [6, 'Good eye']], 'Keep looking'),
        blurb: 'Screen brightness and night modes affect this one — try it in a few settings.',
        stats: [
          { label: 'Final grid', value: `${n}×${n}` },
          { label: 'Last difference', value: `${delta.toFixed(1)}% lightness` },
        ],
      });
    }

    build();
  },
};
