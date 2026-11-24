import { icon } from '../icons.js';
import { el, avg, grade } from '../util.js';

const ROUNDS = 5;

export default {
  id: 'reaction',
  name: 'Reaction Time',
  icon: 'bolt',
  color: '#fbbf24',
  category: 'Reflex',
  tagline: 'Click as soon as the screen turns green.',
  howTo: 'When the red screen turns <b>green</b>, click — or press <kbd>Space</kbd> — as fast as you can. Five attempts; your average is your score.',

  run(ctx) {
    const pad = el('div', 'rx-pad');
    ctx.stage.append(pad);

    const times = [];
    let state = '';
    let t0 = 0;
    let timer = null;

    const hud = () => ctx.hud([
      { label: 'Attempt', value: `${Math.min(times.length + 1, ROUNDS)}/${ROUNDS}` },
      { label: 'Average', value: times.length ? `${Math.round(avg(times))} ms` : '—' },
    ]);

    const set = (cls, html) => {
      pad.className = `rx-pad ${cls}`;
      pad.innerHTML = html;
    };

    function wait() {
      state = 'wait';
      set('wait', `<div class="rx-ico">${icon('timer')}</div><h2>Wait for green…</h2><p>Attempt ${times.length + 1} of ${ROUNDS}</p>`);
      hud();
      timer = ctx.after(1300 + Math.random() * 3200, go);
    }

    function go() {
      state = 'go';
      t0 = 0;
      set('go', `<div class="rx-ico">${icon('bolt')}</div><h2>Click!</h2>`);
      // Start the clock right before the green frame is painted.
      ctx.frame(() => { t0 = performance.now(); });
    }

    function press(e) {
      const now = (e && e.timeStamp) || performance.now();
      if (state === 'wait') {
        ctx.cancel(timer);
        state = 'early';
        set('early', `<div class="rx-ico">${icon('alert')}</div><h2>Too soon!</h2><p>Wait for green. Click to try again.</p>`);
      } else if (state === 'go') {
        const ms = Math.max(1, Math.round(now - (t0 || now)));
        times.push(ms);
        hud();
        if (times.length >= ROUNDS) {
          state = 'done';
          set('show', `<h2 class="rx-big">${ms}<small>ms</small></h2><p>That's a wrap!</p>`);
          ctx.after(700, finish);
        } else {
          state = 'show';
          set('show', `<div class="rx-ico">${icon('timer')}</div><h2 class="rx-big">${ms}<small>ms</small></h2><p>Click to keep going</p>`);
        }
      } else if (state === 'early' || state === 'show') {
        wait();
      }
    }

    function finish() {
      const a = Math.round(avg(times));
      ctx.finish({
        label: 'Average reaction time',
        value: a,
        unit: 'ms',
        rating: grade(a, [[180, 'Superhuman'], [220, 'Lightning fast'], [260, 'Sharp'], [320, 'Solid']], 'Keep practicing', true),
        blurb: 'Most people land somewhere between 200 and 300 ms.',
        stats: [
          { label: 'Best', value: `${Math.min(...times)} ms` },
          { label: 'Slowest', value: `${Math.max(...times)} ms` },
          { label: 'Attempts', value: times.join(' · ') },
        ],
      });
    }

    ctx.on(pad, 'pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      press(e);
    });
    ctx.on(document, 'keydown', (e) => {
      if ((e.code === 'Space' || e.key === 'Enter') && !e.repeat) {
        e.preventDefault();
        press(e);
      }
    });

    wait();
  },
};
