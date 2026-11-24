import { el, grade } from '../util.js';

const DURATION = 5000;

export default {
  id: 'clicks',
  name: 'Click Speed',
  icon: 'click',
  color: '#fb923c',
  category: 'Speed',
  tagline: 'See how many times you can click in five seconds.',
  howTo: 'Click the pad as many times as you can. The <b>5-second</b> timer starts with your first click.',

  run(ctx) {
    const pad = el('div', 'cps-pad');
    pad.innerHTML = `
      <div class="cps-count">0</div>
      <div class="cps-label">Click anywhere here to start</div>
      <div class="cps-bar"><span></span></div>`;
    ctx.stage.append(pad);
    const count = pad.querySelector('.cps-count');
    const label = pad.querySelector('.cps-label');
    const bar = pad.querySelector('.cps-bar span');

    let clicks = 0;
    let t0 = 0;
    let running = false;
    let over = false;

    const hud = (left = DURATION) => ctx.hud([
      { label: 'Time left', value: `${(left / 1000).toFixed(1)}s` },
      { label: 'Clicks', value: clicks },
      { label: 'Speed', value: running && DURATION - left > 300 ? `${(clicks / ((DURATION - left) / 1000)).toFixed(1)} cps` : '—' },
    ]);

    function loop() {
      ctx.frame(() => {
        const elapsed = performance.now() - t0;
        const p = Math.min(1, elapsed / DURATION);
        bar.style.transform = `scaleX(${1 - p})`;
        hud(DURATION - Math.min(elapsed, DURATION));
        if (p >= 1) end();
        else loop();
      });
    }

    function end() {
      over = true;
      pad.classList.add('done');
      label.textContent = 'Time!';
      ctx.after(800, () => {
        const cps = clicks / (DURATION / 1000);
        ctx.finish({
          label: 'Clicks per second',
          value: cps,
          decimals: 1,
          unit: 'cps',
          rating: grade(cps, [[12, 'Machine-like'], [10, 'Blazing'], [8, 'Rapid'], [6, 'Quick']], 'Casual'),
          blurb: 'Pro tip: try a different finger — or two.',
          stats: [{ label: 'Total clicks', value: clicks }, { label: 'Duration', value: '5.0 s' }],
        });
      });
    }

    function ripple(e) {
      const r = pad.getBoundingClientRect();
      const node = el('span', 'ripple');
      node.style.left = `${e.clientX - r.left}px`;
      node.style.top = `${e.clientY - r.top}px`;
      pad.append(node);
      ctx.after(600, () => node.remove());
    }

    ctx.on(pad, 'pointerdown', (e) => {
      if (over) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      const now = performance.now();
      if (!running) {
        running = true;
        t0 = now;
        label.textContent = 'Keep clicking!';
        pad.classList.add('running');
        loop();
      } else if (now - t0 > DURATION) {
        return;
      }
      clicks++;
      count.textContent = clicks;
      count.animate([{ transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 140, easing: 'ease-out' });
      ripple(e);
    });
    ctx.on(pad, 'contextmenu', (e) => e.preventDefault());

    hud();
  },
};
