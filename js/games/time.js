import { el, avg, grade } from '../util.js';

const TARGET = 10;
const ROUNDS = 3;

export default {
  id: 'time',
  name: 'Time Perception',
  icon: 'timer',
  color: '#2dd4bf',
  category: 'Focus',
  tagline: 'Try to stop a hidden timer at exactly 10 seconds.',
  howTo: `Start the timer, then stop it when you think <b>exactly ${TARGET} seconds</b> have passed — no clock to peek at. Three rounds; your average error is your score.`,

  run(ctx) {
    const wrap = el('div', 'tp-wrap');
    wrap.innerHTML = `
      <div class="tp-rounds">${Array.from({ length: ROUNDS }, () => '<span></span>').join('')}</div>
      <div class="tp-orb"><div><span class="tp-readout">${TARGET.toFixed(3)}</span><small>seconds</small></div></div>
      <p class="tp-msg">Round 1 of ${ROUNDS} — stop at exactly ${TARGET} seconds.</p>
      <button type="button" class="btn btn-primary btn-lg tp-btn">Start timer</button>
      <p class="hint">or press <kbd>Space</kbd></p>`;
    ctx.stage.append(wrap);
    const orb = wrap.querySelector('.tp-orb');
    const readout = wrap.querySelector('.tp-readout');
    const msg = wrap.querySelector('.tp-msg');
    const btn = wrap.querySelector('.tp-btn');
    const dots = [...wrap.querySelectorAll('.tp-rounds span')];

    const results = [];
    let state = 'ready';
    let t0 = 0;

    const hud = () => ctx.hud([
      { label: 'Round', value: `${Math.min(results.length + 1, ROUNDS)}/${ROUNDS}` },
      { label: 'Avg error', value: results.length ? `${Math.round(avg(results.map((t) => Math.abs(t - TARGET))) * 1000)} ms` : '—' },
    ]);

    function act(e) {
      const now = (e && e.timeStamp) || performance.now();
      if (state === 'ready') {
        state = 'running';
        t0 = now;
        orb.className = 'tp-orb running';
        readout.textContent = '?.???';
        msg.innerHTML = `Stop when you feel <strong>${TARGET} seconds</strong> have passed.`;
        btn.textContent = 'Stop';
      } else if (state === 'running') {
        state = 'reveal';
        const t = (now - t0) / 1000;
        const diff = t - TARGET;
        const err = Math.abs(diff);
        results.push(t);
        readout.textContent = t.toFixed(3);
        const tone = err < 0.25 ? 'good' : err < 0.8 ? 'ok' : 'bad';
        orb.className = `tp-orb ${tone}`;
        dots[results.length - 1].className = tone;
        msg.innerHTML = err < 0.0005
          ? '<strong>Perfect.</strong> Are you a clock?'
          : `<strong>${err.toFixed(3)} s ${diff > 0 ? 'late' : 'early'}</strong>${err < 0.1 ? ' — incredible!' : ''}`;
        btn.textContent = results.length >= ROUNDS ? 'See results' : 'Next round';
        hud();
      } else if (state === 'reveal') {
        if (results.length >= ROUNDS) return finish();
        state = 'ready';
        orb.className = 'tp-orb';
        readout.textContent = TARGET.toFixed(3);
        msg.textContent = `Round ${results.length + 1} of ${ROUNDS} — stop at exactly ${TARGET} seconds.`;
        btn.textContent = 'Start timer';
      }
    }

    ctx.on(btn, 'click', (e) => {
      btn.blur();
      act(e);
    });
    ctx.on(document, 'keydown', (e) => {
      if (e.code !== 'Space' || e.repeat || e.target === btn) return;
      e.preventDefault();
      act(e);
    });

    function finish() {
      const errs = results.map((t) => Math.abs(t - TARGET));
      const ms = Math.round(avg(errs) * 1000);
      ctx.finish({
        label: 'Average error',
        value: ms,
        unit: 'ms off',
        rating: grade(ms, [[100, 'Atomic clock'], [300, 'Excellent'], [700, 'Pretty good'], [1500, 'Fair']], 'Time is relative', true),
        blurb: 'Your internal clock drifts with mood, focus and caffeine. Try again and see.',
        stats: results.map((t, i) => ({ label: `Round ${i + 1}`, value: `${t.toFixed(3)} s` })),
      });
    }

    hud();
  },
};
