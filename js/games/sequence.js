import { el, randInt, grade, replay } from '../util.js';

export default {
  id: 'sequence',
  name: 'Sequence Memory',
  icon: 'sequence',
  color: '#a78bfa',
  category: 'Memory',
  tagline: 'Remember an increasingly long sequence of tiles.',
  howTo: 'Watch the tiles light up, then repeat the pattern in the same order. Each round adds <b>one more</b> step. One mistake ends the run.',

  run(ctx) {
    const wrap = el('div', 'mem-wrap');
    wrap.innerHTML = `<div class="mem-status">Get ready</div><div class="tile-grid" style="--n:3"></div>`;
    ctx.stage.append(wrap);
    const status = wrap.querySelector('.mem-status');
    const grid = wrap.querySelector('.tile-grid');
    grid.innerHTML = Array.from({ length: 9 }, (_, i) => `<button type="button" class="tile" data-i="${i}" aria-label="Tile ${i + 1}"></button>`).join('');
    const tiles = [...grid.children];

    const seq = [];
    let idx = 0;
    let accepting = false;

    const setStatus = (txt, cls = '') => { status.textContent = txt; status.className = `mem-status ${cls}`; };
    const hud = () => ctx.hud([
      { label: 'Level', value: seq.length },
      { label: 'Progress', value: accepting ? `${idx}/${seq.length}` : '—' },
    ]);

    function flash(i, cls, ms) {
      tiles[i].classList.add(cls);
      ctx.after(ms, () => tiles[i].classList.remove(cls));
    }

    async function nextLevel() {
      let t;
      do { t = randInt(0, 8); } while (seq.length && t === seq[seq.length - 1] && Math.random() < 0.7);
      seq.push(t);
      idx = 0;
      accepting = false;
      grid.classList.remove('active');
      setStatus('Watch closely');
      hud();
      await ctx.wait(650);
      const on = Math.max(280, 460 - seq.length * 12);
      for (const i of seq) {
        flash(i, 'lit', on);
        await ctx.wait(on + 170);
      }
      accepting = true;
      grid.classList.add('active');
      setStatus('Your turn', 'go');
      hud();
    }

    ctx.on(grid, 'pointerdown', (e) => {
      const tile = e.target.closest('.tile');
      if (!tile || !accepting) return;
      e.preventDefault();
      const i = Number(tile.dataset.i);
      if (i !== seq[idx]) {
        accepting = false;
        grid.classList.remove('active');
        tile.classList.add('wrong');
        tiles[seq[idx]].classList.add('lit');
        replay(grid, 'shake');
        setStatus('Wrong tile', 'bad');
        ctx.after(1100, finish);
        return;
      }
      flash(i, 'lit', 200);
      idx++;
      hud();
      if (idx === seq.length) {
        accepting = false;
        grid.classList.remove('active');
        setStatus('Nice!', 'good');
        replay(grid, 'win');
        ctx.after(550, nextLevel);
      }
    });

    function finish() {
      const score = seq.length - 1;
      ctx.finish({
        label: 'Longest sequence',
        value: score,
        unit: score === 1 ? 'step' : 'steps',
        rating: grade(score, [[16, 'Exceptional'], [12, 'Superb memory'], [9, 'Great memory'], [6, 'Good memory']], 'Getting there'),
        blurb: 'Most people can hold around 7 steps before things get slippery.',
        stats: [{ label: 'Failed at level', value: seq.length }],
      });
    }

    nextLevel();
  },
};
