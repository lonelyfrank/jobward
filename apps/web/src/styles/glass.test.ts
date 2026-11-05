import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * jsdom non valuta il CSS: questi test proteggono il CONTRATTO del materiale (token, fallback,
 * preferenze di accessibilità) leggendo il sorgente. Il comportamento reale è in e2e/glass.spec.ts.
 */
const css = readFileSync(path.join(import.meta.dirname, 'glass.css'), 'utf8');
const block = (selector: RegExp) => css.match(selector)?.[1] ?? '';

const TOKENS = [
  'glass-tint',
  'glass-tint-alpha',
  'glass-blur',
  'glass-saturation',
  'glass-rim',
  'glass-light',
  'glass-light-angle',
  'glass-edge',
  'glass-edge-alpha',
  'glass-shadow',
  'glass-shadow-blur',
  'glass-shadow-y',
  'glass-opaque',
  'glass-opaque-edge',
];

const DARK_TOKENS = [
  'glass-tint',
  'glass-tint-alpha',
  'glass-rim',
  'glass-light',
  'glass-edge',
  'glass-edge-alpha',
  'glass-shadow-color',
  'glass-shadow',
  'glass-opaque',
];

describe('materiale Glass Subtle', () => {
  it('definisce nel tema chiaro tutti i token regolabili', () => {
    const tokens = block(/:root\s*{([^}]*)}/);
    for (const token of TOKENS) expect(tokens, `--${token}`).toContain(`--${token}:`);
  });

  it('nel tema scuro ridefinisce i token che dipendono dal tema (gli altri sono condivisi)', () => {
    const tokens = block(/\.dark\s*{([^}]*)}/);
    for (const token of DARK_TOKENS) expect(tokens, `--${token}`).toContain(`--${token}:`);
  });

  it('vive in @layer components, così le utility di Tailwind restano più forti', () => {
    expect(css).toMatch(/@layer components\s*{/);
  });

  it('applica il materiale solo a pseudo-elementi decorativi non interattivi', () => {
    const layers = css.match(/\.glass-subtle::before,\s*\.glass-subtle::after\s*{([^}]*)}/)?.[1];
    expect(layers).toContain('pointer-events: none');
    expect(layers).toContain('z-index: -1');
  });

  it('non filtra, non trasforma e non riduce l’opacità dell’host', () => {
    const host = block(/\n {2}\.glass-subtle\s*{([^}]*)}/);
    expect(host).not.toMatch(/(^|[\s;])(filter|backdrop-filter|transform|opacity|will-change)\s*:/);
  });

  it('prevede fallback opaco, trasparenza ridotta, contrasto alto e colori forzati', () => {
    expect(css).toMatch(/@supports not \(\(backdrop-filter: blur\(1px\)\)/);
    expect(css).toMatch(
      /@media \(prefers-reduced-transparency: reduce\), \(prefers-contrast: more\)/,
    );
    expect(css).toMatch(/@media \(forced-colors: active\)/);
  });

  it('non contiene animazioni né transizioni (nessun riflesso animato)', () => {
    expect(css).not.toMatch(/@keyframes|animation\s*:|transition\s*:|will-change/);
  });

  it('la variante delle colonne Kanban cambia solo token, non introduce un secondo materiale', () => {
    const variant = css.match(/\.glass-subtle\.kanban-column-glass\s*{([^}]*)}/)?.[1] ?? '';
    expect(variant).toContain('--glass-tint:');
    expect(variant.split(';').filter((d) => d.trim() && !d.trim().startsWith('--glass-'))).toEqual(
      [],
    );
    expect(css).not.toMatch(/\.kanban-column-glass::/);
  });

  it('non ridefinisce globalmente .surface, .card, .panel, bg-surface o bg-surface-muted', () => {
    expect(css).not.toMatch(/(^|[\s,>])\.(surface|card|panel|bg-surface(-muted)?)\b/m);
  });
});

/**
 * Guardia d'ambito: Glass Subtle è una finitura esclusiva delle colonne Kanban. Il comportamento
 * è verificato in kanban-glass.test.tsx e in e2e/kanban-glass.spec.ts; questo controllo segnala
 * subito un uso della classe in qualunque altro sorgente.
 */
describe('ambito di Glass Subtle nei sorgenti', () => {
  const root = path.join(import.meta.dirname, '..');
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)],
    );

  it('solo KanbanColumn applica la classe glass-subtle', () => {
    const users = walk(root)
      .filter((f) => /\.(tsx?|html)$/.test(f) && !/\.test\.tsx?$/.test(f))
      .filter((f) => readFileSync(f, 'utf8').includes('glass-subtle'))
      .map((f) => path.relative(root, f));
    expect(users).toEqual(['features/kanban/kanban-column.tsx']);
  });
});
