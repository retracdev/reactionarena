import { el, pick, grade } from '../util.js';

const DURATION = 30; // seconds

const WORDS = (
  'the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or ' +
  'an will my one all would there their what so up out if about who get which go me when make can like time no just ' +
  'him know take people into year your good some could them see other than then now look only come its over think also ' +
  'back after use two how our work first well way even new want because any these give day most us great between need ' +
  'large often hand high place hold turn real life few north open seem together next white children begin got walk ' +
  'example ease paper group always music those both mark book letter until mile river car feet care second enough plain ' +
  'girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song measure ' +
  'door product black short numeral class wind question happen complete ship area half rock order fire south problem ' +
  'piece told knew pass since top whole king space heard best hour better true during hundred five remember step early ' +
  'hold west ground interest reach fast verb sing listen six table travel less morning ten simple several vowel toward ' +
  'war lay against pattern slow center love person money serve appear road map rain rule govern pull cold notice voice ' +
  'unit power town fine certain fly fall lead cry dark machine note wait plan figure star box noun field rest correct ' +
  'able pound done beauty drive stood contain front teach week final gave green oh quick develop ocean warm free minute ' +
  'strong special mind behind clear tail produce fact street inch multiply nothing course stay wheel full force blue ' +
  'object decide surface deep moon island foot system busy test record boat common gold possible plane stead dry wonder'
).split(' ');

export default {
  id: 'typing',
  name: 'Typing Speed',
  icon: 'keyboard',
  color: '#60a5fa',
  category: 'Speed',
  tagline: 'Measure words per minute and accuracy.',
  howTo: `Type the words as fast and accurately as you can. The <b>${DURATION}-second</b> timer starts on your first keystroke.`,

  run(ctx) {
    const text = Array.from({ length: 110 }, () => pick(WORDS)).join(' ');
    const wrap = el('div', 'type-wrap');
    wrap.innerHTML = `
      <div class="type-timer"><span></span></div>
      <div class="type-box">
        <div class="type-inner"></div>
        <div class="type-blur">Click here to keep typing</div>
        <input class="type-input" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" aria-label="Type the text shown">
      </div>
      <p class="type-hint">Start typing — the timer begins with your first key.</p>`;
    ctx.stage.append(wrap);

    const inner = wrap.querySelector('.type-inner');
    const input = wrap.querySelector('.type-input');
    const bar = wrap.querySelector('.type-timer span');
    const hint = wrap.querySelector('.type-hint');

    inner.innerHTML = [...text].map((c) => `<span>${c}</span>`).join('');
    const spans = inner.children;
    spans[0].className = 'cur';

    let prev = '';
    let totalKeys = 0;
    let correctKeys = 0;
    let started = false;
    let t0 = 0;
    let over = false;

    const correctChars = () => {
      let n = 0;
      for (let i = 0; i < prev.length; i++) if (prev[i] === text[i]) n++;
      return n;
    };

    function stats(elapsed) {
      const minutes = Math.max(elapsed, 1) / 60;
      return {
        wpm: Math.round(correctChars() / 5 / minutes),
        raw: Math.round(prev.length / 5 / minutes),
        acc: totalKeys ? (correctKeys / totalKeys) * 100 : 100,
      };
    }

    function hud(elapsed = 0) {
      const s = started ? stats(elapsed) : null;
      ctx.hud([
        { label: 'Time', value: `${Math.max(0, DURATION - elapsed).toFixed(started ? 1 : 0)}s` },
        { label: 'WPM', value: s && elapsed > 1 ? s.wpm : '—' },
        { label: 'Accuracy', value: s ? `${Math.round(s.acc)}%` : '—' },
      ]);
    }

    function scroll() {
      const cur = spans[Math.min(prev.length, spans.length - 1)];
      const lh = parseFloat(getComputedStyle(inner).lineHeight) || 40;
      const line = Math.round(cur.offsetTop / lh);
      inner.style.transform = `translateY(${-Math.max(0, line - 1) * lh}px)`;
    }

    function tick() {
      const elapsed = (performance.now() - t0) / 1000;
      bar.style.transform = `scaleX(${Math.max(0, 1 - elapsed / DURATION)})`;
      hud(elapsed);
      if (elapsed >= DURATION) end();
    }

    function end() {
      if (over) return;
      over = true;
      input.disabled = true;
      wrap.classList.add('done');
      const s = stats(Math.min(DURATION, (performance.now() - t0) / 1000));
      ctx.after(500, () => ctx.finish({
        label: 'Typing speed',
        value: s.wpm,
        unit: 'wpm',
        rating: grade(s.wpm, [[100, 'Blazing'], [80, 'Very fast'], [60, 'Fast'], [40, 'Solid']], 'Warming up'),
        blurb: s.acc < 90 ? 'Speed is nothing without accuracy — errors don\'t count toward your WPM.' : 'Nice and clean. Only correctly typed characters count toward WPM.',
        stats: [
          { label: 'Accuracy', value: `${s.acc.toFixed(1)}%` },
          { label: 'Raw speed', value: `${s.raw} wpm` },
          { label: 'Characters', value: `${correctChars()} / ${prev.length}` },
        ],
      }));
    }

    ctx.on(input, 'input', () => {
      if (over) return;
      let v = input.value;
      if (v.length > text.length) v = input.value = v.slice(0, text.length);
      if (!started && v.length) {
        started = true;
        t0 = performance.now();
        hint.textContent = 'Keep going…';
        wrap.classList.add('typing');
        ctx.every(100, tick);
      }

      let d = 0;
      while (d < prev.length && d < v.length && prev[d] === v[d]) d++;
      for (let i = d; i < v.length; i++) {
        totalKeys++;
        if (v[i] === text[i]) correctKeys++;
      }
      const hi = Math.min(Math.max(prev.length, v.length), spans.length - 1);
      for (let i = d; i <= hi; i++) {
        spans[i].className = i < v.length ? (v[i] === text[i] ? 'ok' : 'err') : '';
      }
      if (v.length < spans.length) spans[v.length].classList.add('cur');
      prev = v;
      scroll();
      if (v.length >= text.length) end();
    });

    // Keep the caret pinned to the end: no arrow-key editing or pasting.
    ctx.on(input, 'keydown', (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) e.preventDefault();
    });
    ctx.on(input, 'paste', (e) => e.preventDefault());
    ctx.on(input, 'drop', (e) => e.preventDefault());
    ctx.on(input, 'select', () => input.setSelectionRange(input.value.length, input.value.length));
    ctx.on(input, 'focus', () => wrap.classList.remove('unfocused'));
    ctx.on(input, 'blur', () => { if (!over) wrap.classList.add('unfocused'); });

    hud();
    input.focus({ preventScroll: true });
    if (document.activeElement !== input) wrap.classList.add('unfocused');
  },
};
