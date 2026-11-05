# M2 — Registro dei problemi

Classificazione: **P0** sicurezza critica / perdita di dati / app inutilizzabile · **P1** errori gravi su dati, API, autorizzazioni, flussi fondamentali · **P2** funzionali non bloccanti, UX, prestazioni · **P3** minori.

## Riepilogo

| ID     | Gravità | Titolo                                                              | Stato     |
| ------ | ------- | ------------------------------------------------------------------- | --------- |
| M2-00  | P2      | CI di `main` rossa: falso positivo axe a metà animazione + avvio a freddo | Corretto |

## M2-00 · CI di `main` rossa dopo il merge di M1 (P2)

- **Descrizione.** Il job *E2E (Playwright)* del merge di #3 (`35b7614`, run 41942789544) fallisce: (a) `accessibilità WCAG 2.2 AA` → `color-contrast: .mt-1, .mt-1\.5` su `/opportunities (light)`;
  (b) il primo test (onboarding) risulta *flaky* (riesce al secondo tentativo: l'intestazione non compare entro 5 s).
- **Evidenza.** Log della run; lo stesso commit sul branch della PR (run 41942442943) era verde; **in locale, da ambiente pulito, 65/65 E2E verdi**.
  Il contenuto principale entra con `mr-fade-in` (0,15 s, opacità 0→1): axe calcola il contrasto sul colore composto con l'opacità *corrente*.
- **Riproduzione del meccanismo.** Con `animation-duration: 3s` (runner lento simulato) e axe lanciato subito dopo il render di `/opportunities`:
  `color-contrast: h1 | .mt-1 | … | .mt-1.5` (gli stessi selettori della CI). Dopo aver atteso la fine delle animazioni finite: nessuna violazione.
  Il difetto **non è nell'applicazione** (i token superano la soglia: `pnpm check:contrast`); è nel test, che campionava un frame intermedio.
- **Impatto.** `main` rosso: nessun segnale affidabile per le PR successive. Nessun impatto sugli utenti.
- **Correzione.** `waitForAnimationsToSettle()` (attende `document.getAnimations()` finite, ignora quelle infinite dello skeleton) chiamata da `expectNoA11yViolations`;
  in CI `expect.timeout` passa da 5 s a 15 s per l'avvio a freddo di Vite. Nessun controllo rimosso, nessuna soglia di contrasto toccata.
- **Test di regressione.** L'intero helper è usato da ogni controllo axe (≈ 30 schermate); il meccanismo è stato verificato con la prova sopra descritta.
- **Stato.** Corretto in M2 (commit `fix(e2e)`); **da confermare con la CI della PR** (la riproduzione esatta del runner non è possibile in locale).
