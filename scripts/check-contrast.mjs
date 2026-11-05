// Verifica il contrasto WCAG delle coppie di token (OKLCH -> sRGB -> luminanza relativa).
import fs from 'node:fs';
const css = fs.readFileSync(
  process.argv[2] ?? new URL('../apps/web/src/styles/index.css', import.meta.url),
  'utf8',
);
const block = (re) =>
  Object.fromEntries(
    [...css.match(re)[1].matchAll(/--([\w-]+):\s*(oklch\([^)]*\))/g)].map((m) => [m[1], m[2]]),
  );
const light = block(/:root\s*{([^}]*)}/);
const dark = { ...light, ...block(/\.dark\s*{([^}]*)}/) };
function toRgb(s) {
  const [L, C, h] = s
    .match(/oklch\(([^)]*)\)/)[1]
    .split(/[\s/]+/)
    .map(Number);
  const hr = (h * Math.PI) / 180,
    A = C * Math.cos(hr),
    B = C * Math.sin(hr);
  const l_ = L + 0.3963377774 * A + 0.2158037573 * B,
    m_ = L - 0.1055613458 * A - 0.0638541728 * B,
    s_ = L - 0.0894841775 * A - 1.291485548 * B;
  const [l, m, s2] = [l_ ** 3, m_ ** 3, s_ ** 3];
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s2,
  ];
  return lin.map((v) => Math.min(1, Math.max(0, v)));
}
const lum = (s) => {
  const [r, g, b] = toRgb(s);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const pairs = [
  ['foreground', 'background', 4.5],
  ['foreground', 'surface', 4.5],
  ['muted-foreground', 'background', 4.5],
  ['muted-foreground', 'surface', 4.5],
  ['muted-foreground', 'surface-muted', 4.5],
  ['muted-foreground', 'sidebar', 4.5],
  ['foreground', 'sidebar', 4.5],
  ['primary-foreground', 'primary', 4.5],
  ['primary-foreground', 'primary-hover', 4.5],
  ['primary', 'background', 4.5],
  ['primary', 'surface', 4.5],
  ['primary-soft-foreground', 'primary-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['warning-soft-foreground', 'warning-soft', 4.5],
  ['success-soft-foreground', 'success-soft', 4.5],
  ['info-soft-foreground', 'info-soft', 4.5],
  ['teal-soft-foreground', 'teal-soft', 4.5],
  ['muted-foreground', 'hover-soft', 4.5],
  ['foreground', 'hover-soft', 4.5],
  ['ring', 'background', 3],
  ['ring', 'surface', 3],
  ['border-strong', 'background', 3],
  ['border-strong', 'surface', 3],
  // Colori delle bacheche/colonne: elementi grafici (non testo) ⇒ almeno 3:1 sulla superficie.
  ...['slate', 'blue', 'green', 'amber', 'violet', 'rose', 'teal', 'orange'].flatMap((c) => [
    [`accent-${c}`, 'surface', 3],
    [`accent-${c}`, 'background', 3],
  ]),
];
let bad = 0;
for (const [name, t] of [
  ['light', light],
  ['dark', dark],
]) {
  for (const [fg, bg, min] of pairs) {
    const r = ratio(t[fg], t[bg]);
    const ok = r >= min;
    if (!ok) bad++;
    console.log(
      `${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(5)} ${fg} / ${bg}: ${r.toFixed(2)} (min ${min})`,
    );
  }
}
process.exit(bad ? 1 : 0);
