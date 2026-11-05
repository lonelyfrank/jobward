# M3.UI2 — Glass Subtle limitato alle colonne Kanban

Base: `3c78805` (branch `m3-ui1-workspace-actions-search`). Branch di lavoro: `m3-ui2-kanban-glass-scope`.

## Esito dell'audit

Su `3c78805` Glass Subtle **non era presente**: `Surface`, Overview, Bacheche, Opportunità, Attività e
Insights usavano già i background originali (le modifiche Glass erano state rimosse nella base UI.1).
L'adapter vive solo sul branch `m3-ui-glass-surface` (`568708d`, `glass.css`). Quindi la Fase 1
(ripristino) non richiede modifiche di codice: è garantita da test. `#1e203d` è il token
`--surface-muted` del tema scuro (usato anche da badge, hover e skeleton): non è stato toccato.

## Modifiche

- `styles/glass.css`, `styles/glass.test.ts`: adapter esistente, riportato da `568708d` senza modifiche
  al materiale, più la variante di contesto `.kanban-column-glass` (solo token: tinta =
  `--surface-muted`, alfa 0.8, fallback opaco = `--surface-muted`).
- `styles/index.css`: import di `glass.css`.
- `features/kanban/kanban-column.tsx`: `bg-surface-muted` sostituito da `glass-subtle kanban-column-glass`
  sul solo `<section data-column-id>`.
- Test: `kanban-glass.test.tsx` (unit), `e2e/kanban-glass.spec.ts` (stile calcolato reale).

`Surface` non è modificato. Nessun override su `.surface`, `.card`, `.panel`, `bg-surface*`.

## Screenshot

`before/` = `3c78805` pulito, `after/` = questa modifica; stessi dati, viewport (1920×1080, 1366×768,
768×1024, 390×844, 320×568) e temi. Differiscono solo `kanban-*` (atteso). `opportunita-*` e
`tabella-*` differiscono per un riquadro di 8×12 px: una cifra del tempo relativo «aggiornata N min fa».
