# M3-C3 — Registro problemi e readiness

**Data:** 2026-11-07 · **Branch:** `m3-c3-application-workflow-ui`.

| ID    | Priorità | Stato          | Descrizione                                                                                                                                                           |
| ----- | -------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3-01 | P2       | Aperto         | CI remota C3 da eseguire dopo eventuale autorizzazione al push. Main alla baseline è verde.                                                                           |
| C3-02 | P3       | Limite         | Prove automatiche Chromium; tastiera virtuale, screen reader reali, Firefox/WebKit non verificati.                                                                    |
| C3-03 | Info     | Scelta         | Fase/esito legacy leggibili, nuove scritture UI tramite pipeline canonica. PATCH legacy resta compatibile per altri client. Motivazione e regressioni nella consegna. |
| C2-03 | P3       | Risolto in C3  | UI note paginata a 25 righe con cursore SQL; endpoint C2 senza parametri invariato.                                                                                   |
| C2-07 | P3       | Risolto in C3  | Riapertura riconoscibile come «Candidatura riaperta».                                                                                                                 |
| C2-08 | Info     | Chiarito in C3 | Conservazione default; annullamento solo esplicito degli appuntamenti programmati futuri. Round senza data e storico conservati.                                      |

## Problemi riprodotti e corretti

| ID    | Priorità | Stato   | Correzione e prova                                                                                                                                                        |
| ----- | -------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3-04 | P1       | Risolto | Bozza iniziata mentre l'archiviazione è in volo: eliminato lo svuotamento del registro nel callback; regressione rossa prima e verde dopo. La chiusura passa dal blocker. |
| C3-05 | P2       | Risolto | Un gesto sui tab generava due voci di cronologia per focus/mouse-down Radix. Guardia sincrona sulla destinazione; back/forward verificati.                                |
| C3-06 | P2       | Risolto | Il trigger dell'editor era ancora disabilitato durante il ripristino del focus. Ripristino dopo il commit, verificato nel browser per note e documenti.                   |

Nessun P0/P1 aperto noto. I limiti storici C2-02 (deploy/backup D1 remoto), C2-04 (PRAGMA D1),
C2-05 (lapidi) e C2-06 (idempotenza delle vecchie scritture) restano come descritti nella consegna C2:
nessun deploy o refactoring fuori perimetro in C3.

## Readiness per M3-C4

**Pronto per revisione M3-C4 con riserva di CI remota C3.** Quality gate locale superato:
1.179 unit/integration, 176 E2E, 13 preview; matrice completa nei due temi.
Un collector visuale opzionale preesistente resta opt-in. C3 integra dominio/API e flussi UI.
Non avvia nuove funzionalità C4/C5, attività, follow-up automatici, insights o release pubblica.
L'eventuale revisione C4 dovrà considerare i risultati esatti del [testing report](c3-testing-report.md),
il passaggio della CI remota sul futuro commit e i limiti dei dispositivi reali.

## Aggiornamento post-integrazione — 2026-11-07

> Le tabelle sopra sono lo stato **alla consegna** (push non ancora avvenuto) e restano invariate per tracciabilità. Ciò che è accaduto dopo è in [c3-closure.md](c3-closure.md).

| ID    | Priorità | Stato                                            | Descrizione                                                                                                                                                                                                                                                                                       |
| ----- | -------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C3-01 | P2       | **Superato: eseguita, esito rosso**              | La CI remota è stata eseguita su `main` (`5a0d056eda`, [run 42334739111](https://github.com/lonelyfrank/jobward/actions/runs/42334739111)): job build verde, E2E 176 verdi, **preview rossa**                                                                                                     |
| C3-07 | P1       | **Corretto in locale; conferma remota pendente** | Race di sincronizzazione in `preview.spec.ts:302`: dopo il clic sulla scheda si attendeva solo l'URL; il locator si agganciava al pulsante omonimo, poi nascosto, della Panoramica. Correzione: `openTab()` (commit `f359630`). Rosso→verde a 6× CPU: 4/4 → 4/4. **Nessuna modifica al prodotto** |
| C3-08 | P3       | Aperto (decisione di processo)                   | `main` non è protetta; C3 vi è entrata con push diretto, senza PR né CI preventiva                                                                                                                                                                                                                |

Nessun P0 noto. **P1 aperto fino alla CI verde del commit corretto.**
