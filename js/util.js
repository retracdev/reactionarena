export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const avg = (arr) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : 0);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function el(tag, cls, html) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (html != null) node.innerHTML = html;
  return node;
}

export function fmt(n, decimals = 0) {
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Pick a label from tiers: [[threshold, label], ...]. Lower-is-better compares with `<`, otherwise `>=`. */
export function grade(value, tiers, fallback, lowerIsBetter = false) {
  for (const [t, label] of tiers) {
    if (lowerIsBetter ? value < t : value >= t) return label;
  }
  return fallback;
}

/** Restart a CSS animation class on an element. */
export function replay(node, cls) {
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}
