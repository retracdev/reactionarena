import { el, avg, rand, grade, clamp } from '../util.js';

const SHOTS = 10;

export default {
  id: 'precision',
  name: 'Precision',
  icon: 'target',
  color: '#f87171',
  category: 'Accuracy',
  tagline: 'Click as close to the center of a target as possible.',
  howTo: `Take <b>${SHOTS} shots</b> at drifting targets. A perfect bullseye scores 100 — the further from center, the fewer points. Accuracy beats speed here.`,

  run(ctx) {
    const field = el('div', 'pr-field');
    const target = el('div', 'pr-target');
    field.append(target);
    ctx.stage.append(field);

    const shots = [];
    let x = 0; let y = 0; let vx = 0; let vy = 0; let R = 40;
    let live = false;
    let lastT = 0;

    const hud = () => ctx.hud([
      { label: 'Shot', value: `${Math.min(shots.length + 1, SHOTS)}/${SHOTS}` },
      { label: 'Avg score', value: shots.length ? avg(shots.map((s) => s.pts)).toFixed(1) : '—' },
    ]);

    function spawn() {
      const w = field.clientWidth;
      const h = field.clientHeight;
      R = clamp(w * 0.07, 32, 52);
      x = rand(R + 10, w - R - 10);
      y = rand(R + 10, h - R - 10);
      const speed = 18 + shots.length * 8;
      const ang = rand(0, Math.PI * 2);
      vx = Math.cos(ang) * speed;
      vy = Math.sin(ang) * speed;
      target.style.width = target.style.height = `${R * 2}px`;
      target.className = 'pr-target in';
      draw();
      live = true;
      hud();
    }

    function draw() {
      target.style.transform = `translate(${x - R}px, ${y - R}px)`;
    }

    function step(t) {
      const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
      lastT = t;
      if (live) {
        const w = field.clientWidth;
        const h = field.clientHeight;
        x += vx * dt;
        y += vy * dt;
        if (x < R) { x = R; vx = Math.abs(vx); }
        if (x > w - R) { x = w - R; vx = -Math.abs(vx); }
        if (y < R) { y = R; vy = Math.abs(vy); }
        if (y > h - R) { y = h - R; vy = -Math.abs(vy); }
        draw();
      }
      ctx.frame(step);
    }

    ctx.on(field, 'pointerdown', (e) => {
      if (!live) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      live = false;
      const r = field.getBoundingClientRect();
      const px = e.clientX - r.left;
      const py = e.clientY - r.top;
      const d = Math.hypot(px - x, py - y);
      const pts = d > R ? 0 : Math.round(100 * (1 - d / R));
      shots.push({ pts, d: d / R });

      const mark = el('span', 'pr-mark');
      mark.style.left = `${px}px`;
      mark.style.top = `${py}px`;
      const pop = el('span', `pr-pts ${pts >= 90 ? 'great' : pts === 0 ? 'miss' : ''}`, pts === 0 ? 'Miss' : `+${pts}`);
      pop.style.left = `${px}px`;
      pop.style.top = `${py}px`;
      field.append(mark, pop);
      ctx.after(1400, () => { mark.remove(); pop.remove(); });

      target.className = 'pr-target out';
      hud();
      if (shots.length >= SHOTS) ctx.after(800, finish);
      else ctx.after(550, spawn);
    });

    function finish() {
      const score = avg(shots.map((s) => s.pts));
      const bulls = shots.filter((s) => s.pts >= 90).length;
      const misses = shots.filter((s) => s.pts === 0).length;
      ctx.finish({
        label: 'Average precision',
        value: score,
        score: shots.reduce((sum, s) => sum + s.pts, 0),
        decimals: 1,
        unit: '/ 100',
        rating: grade(score, [[90, 'Surgical'], [80, 'Sniper'], [68, 'Precise'], [52, 'Steady']], 'Shaky hands'),
        blurb: 'Targets drift faster with every shot — patience pays off.',
        stats: [
          { label: 'Bullseyes (90+)', value: bulls },
          { label: 'Misses', value: misses },
          { label: 'Best shot', value: Math.max(...shots.map((s) => s.pts)) },
        ],
      });
    }

    spawn();
    ctx.frame(step);
  },
};
