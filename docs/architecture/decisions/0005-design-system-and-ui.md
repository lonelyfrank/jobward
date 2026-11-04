# ADR-0005 — Design system e componenti UI

**Stato:** Accettato · **Data:** 2026-11-04

## Decisioni

- **Token semantici** in CSS custom property (`--background`, `--surface`, `--primary`, …) mappati in Tailwind 4 con `@theme inline`. I componenti usano solo nomi semantici (`bg-surface`, `text-muted-foreground`): nessun colore letterale.
- **Tema chiaro/scuro** con classe `.dark` su `<html>`; preferenza `light | dark | system` salvata in `localStorage` (con try/catch: la UI funziona anche senza storage). Uno script esterno (`theme-init.js`) applica il tema **prima del primo paint** (evita il flash) ed è compatibile con la CSP (`script-src 'self'`).
- **Identità**: verde "feltro del tavolo" su neutri caldi; il rosso è riservato a urgenza/azioni distruttive; marchio a ruota a spicchi. Densità e gerarchia ispirate a Linear/Notion/Trello senza replicarne l'aspetto.
- **Contrasto verificato con calcolo**, non a occhio: `scripts/check-contrast.mjs` converte OKLCH→sRGB e controlla ogni coppia (testo ≥ 4.5:1, bordi dei controlli e focus ≥ 3:1) in entrambi i temi, ed è nel quality gate. Ha già intercettato un difetto reale (bordo dei controlli a 1.5:1, corretto).
- **Font**: Inter variabile self-hosted (`@fontsource-variable/inter`), nessuna richiesta a terzi (privacy, CSP `font-src 'self'`).
- **Accessibilità by default**: focus visibile globale, skip link, landmark, focus spostato su `<main>` a ogni navigazione, `prefers-reduced-motion` rispettato, target touch ≥ 44 px sotto `md`, errori di form annunciati (`role="alert"`).
- **Funzioni non disponibili**: mai simulate. Controlli `disabled` con `aria-describedby` e badge "In arrivo · Mx" (componenti `PlannedAction`, `EmptyState`).

## Conseguenze

Cambiare palette = modificare un solo file e rieseguire il controllo di contrasto. Il CSP mantiene `style-src 'unsafe-inline'` per gli stili inline di Radix (debito noto, nel backlog).
