import { el, avg, grade, rand, replay } from '../util.js';

const TOTAL = 30;

export default {
  id: 'aim',
  name: 'Aim Trainer',
  icon: 'crosshair',
  color: '#f472b6',
  category: 'Accuracy',
  tagline: 'Hit randomly positioned targets as quickly as possible.',
  howTo: `Hit the first target to begin, then clear <b>${TOTAL} targets</b> as fast as you can. Missed clicks lower your accuracy.`,

  run(ctx) {
    const field = el('div', 'aim-field');
    const target = el('button', 'aim-target');
    target.type = 'button';
    target.setAttribute('aria-label', 'Target');
    const hint = el('div', 'aim-hint', 'Hit the target to start');
    field.append(target, hint);
    ctx.stage.append(field);

    const times = [];
    let misses = 0;
    let started = false;
    let last = 0;

    const hud = () => ctx.hud([
      { label: 'Remaining', value: TOTAL - times.length },
      { label: 'Avg time', value: times.length ? `${Math.round(avg(times))} ms` : '—' },
      { label: 'Misses', value: misses },
    ]);

    function size() {
      const w = field.clientWidth;
      return Math.max(44, Math.min(72, w * 0.1));
    }

    function place(center) {
      const w = field.clientWidth;
      const h = field.clientHeight;
      const s = size();
      const pad = s / 2 + 14;
      const x = center ? w / 2 : rand(pad, w - pad);
      const y = center ? h / 2 : rand(pad, h - pad);
      target.style.setProperty('--size', `${s}px`);
      target.style.left = `${(x / w) * 100}%`;
      target.style.top = `${(y / h) * 100}%`;
      replay(target, 'pop');
    }

    function fx(cls, e) {
      const r = field.getBoundingClientRect();
      const node = el('span', cls);
      node.style.left = `${e.clientX - r.left}px`;
      node.style.top = `${e.clientY - r.top}px`;
      node.style.setProperty('--size', `${size()}px`);
      field.append(node);
      ctx.after(650, () => node.remove());
    }

    ctx.on(target, 'pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const now = e.timeStamp || performance.now();
      fx('aim-burst', e);
      if (!started) {
        started = true;
        hint.remove();
      } else {
        times.push(now - last);
      }
      last = now;
      hud();
      if (times.length >= TOTAL) {
        target.remove();
        ctx.after(350, finish);
      } else {
        place(false);
      }
    });

    ctx.on(field, 'pointerdown', (e) => {
      if (!started) return;
      misses++;
      fx('aim-miss', e);
      hud();
    });

    function finish() {
      const a = Math.round(avg(times));
      const acc = (TOTAL / (TOTAL + misses)) * 100;
      ctx.finish({
        label: 'Average time per target',
        value: a,
        score: a,
        unit: 'ms',
        rating: grade(a, [[380, 'Elite aim'], [460, 'Great aim'], [560, 'Good aim'], [700, 'Steady']], 'Keep practicing', true),
        blurb: acc < 85 ? 'Fast is good — but those misses add up. Try slowing down a hair.' : 'Clean shooting. Can you shave off a few more milliseconds?',
        stats: [
          { label: 'Accuracy', value: `${acc.toFixed(1)}%` },
          { label: 'Fastest', value: `${Math.round(Math.min(...times))} ms` },
          { label: 'Misses', value: misses },
        ],
      });
    }

    place(true);
    hud();
  },
};
