import { el, pick, randInt, grade, replay } from '../util.js';

const DURATION = 30000;

function problem(score) {
  const tier = Math.min(5, Math.floor(score / 4));
  const ops = ['+', '-'];
  if (tier >= 1) ops.push('×');
  if (tier >= 2) ops.push('÷');
  const op = pick(ops);
  let a; let b; let ans;
  switch (op) {
    case '+':
      a = randInt(2, 9 + tier * 12);
      b = randInt(2, 9 + tier * 12);
      ans = a + b;
      break;
    case '-':
      a = randInt(6, 14 + tier * 14);
      b = randInt(1, a - 1);
      ans = a - b;
      break;
    case '×':
      a = randInt(2, Math.min(6 + tier * 2, 15));
      b = randInt(2, Math.min(9 + tier, 15));
      ans = a * b;
      break;
    default:
      b = randInt(2, Math.min(5 + tier * 2, 12));
      ans = randInt(2, Math.min(6 + tier * 2, 15));
      a = b * ans;
  }
  return { text: `${a} ${op === '-' ? '−' : op} ${b}`, ans };
}

export default {
  id: 'math',
  name: 'Mental Math',
  icon: 'math',
  color: '#34d399',
  category: 'Logic',
  tagline: 'Solve as many arithmetic problems as possible in 30 seconds.',
  howTo: 'Type each answer — correct answers submit automatically. Press <kbd>Enter</kbd> to skip. Problems get harder as you go. You have <b>30 seconds</b>.',

  run(ctx) {
    const wrap = el('div', 'mm-wrap');
    wrap.innerHTML = `
      <div class="mm-timer"><span></span></div>
      <div class="mm-problem"></div>
      <input class="mm-input" type="text" inputmode="numeric" autocomplete="off" autocorrect="off" spellcheck="false" aria-label="Your answer">
      <p class="hint">Answers submit automatically · <kbd>Enter</kbd> to skip</p>`;
    ctx.stage.append(wrap);
    const probEl = wrap.querySelector('.mm-problem');
    const input = wrap.querySelector('.mm-input');
    const bar = wrap.querySelector('.mm-timer span');

    let correct = 0;
    let wrong = 0;
    let cur = null;
    let over = false;
    const t0 = performance.now();

    const hud = (left) => ctx.hud([
      { label: 'Time', value: `${Math.ceil(left / 1000)}s` },
      { label: 'Solved', value: correct },
      { label: 'Skipped', value: wrong },
    ]);

    function next() {
      let p;
      do { p = problem(correct); } while (cur && p.text === cur.text);
      cur = p;
      probEl.textContent = p.text;
      input.value = '';
    }

    ctx.on(input, 'input', () => {
      if (over) return;
      const clean = input.value.replace(/[^\d-]/g, '');
      if (clean !== input.value) input.value = clean;
      if (clean !== '' && Number(clean) === cur.ans && clean === String(cur.ans)) {
        correct++;
        replay(probEl, 'pop');
        replay(input, 'ok');
        next();
      }
    });

    ctx.on(input, 'keydown', (e) => {
      if (e.key !== 'Enter' || over) return;
      e.preventDefault();
      wrong++;
      replay(input, 'bad');
      next();
    });

    ctx.on(wrap, 'pointerdown', (e) => {
      if (e.target !== input) { e.preventDefault(); input.focus(); }
    });

    function loop() {
      ctx.frame(() => {
        const elapsed = performance.now() - t0;
        const left = Math.max(0, DURATION - elapsed);
        bar.style.transform = `scaleX(${left / DURATION})`;
        hud(left);
        if (left <= 0) return end();
        loop();
      });
    }

    function end() {
      over = true;
      input.disabled = true;
      probEl.textContent = 'Time!';
      ctx.after(700, () => {
        const attempts = correct + wrong;
        ctx.finish({
          label: 'Problems solved',
          value: correct,
          unit: correct === 1 ? 'problem' : 'problems',
          rating: grade(correct, [[26, 'Human calculator'], [20, 'Mathlete'], [14, 'Quick thinker'], [8, 'Solid']], 'Warming up'),
          blurb: 'Difficulty ramps every four correct answers — multiplication and division unlock along the way.',
          stats: [
            { label: 'Skipped', value: wrong },
            { label: 'Hit rate', value: attempts ? `${Math.round((correct / attempts) * 100)}%` : '—' },
            { label: 'Per problem', value: correct ? `${(DURATION / 1000 / correct).toFixed(1)} s` : '—' },
          ],
        });
      });
    }

    next();
    hud(DURATION);
    input.focus({ preventScroll: true });
    loop();
  },
};
