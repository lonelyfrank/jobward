# M2.5 — Architettura

## Dipendenze e base

M2.5 (`m25-smart-application-modal`) è derivata dal branch **`m2-information-customization` @ `6864d7a`**, cioè M2 verificata in CI **più** il commit di correzione del test E2E intermittente (PR #4, **non ancora integrata** al momento della scrittura). I commit di M2 (`aa27f82`) sono già su `main`; `6864d7a` ne aggiunge uno. **Prima di integrare M2.5 va integrata la PR #4** (o, in alternativa, la PR di M2.5 la includerà). Nessuna modifica ai commit di M2.

## Viste d'insieme

```
Kanban ─┐                                    ┌ Panoramica ─ SmartSummary (fase, prossimo colloquio, prossima azione)
Tabella ┼─▶ /…/cards/:id#scheda ─▶ Dialog 'workspace' ┼ Colloqui ──── InterviewsTab (round, moduli, azioni)
Opport. ┘        (stessa rotta)           │          ├ Dettagli ──── sezioni M2 (un solo form, un solo Salva)
                                          │          └ Cronologia
                                          └ guardia modifiche non salvate (useBlocker + registro a ref)
API:  GET/POST /cards/:id/interviews · PATCH /interviews/:id · POST …/complete · …/cancel
DB:   interviews (FK composita) · activity_events ricostruita con nuovi tipi (0004)
```

## Componenti nuovi

| Area      | File                                                                                                                                                                                                                                                     |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contratti | `packages/schemas/src/interview.ts` (+ `summarizeInterviews`, schema di `interviewSummary` in `card.ts`)                                                                                                                                                 |
| Database  | tabella `interviews`, migrazione `0004`, costanti `INTERVIEW_*` e sei tipi di evento                                                                                                                                                                     |
| API       | `services/interviews.ts`, `interview-summaries.ts`, `events.ts` (estratto da `cards.ts`), `modules/interviews/routes.ts`, rotte in `cards`                                                                                                               |
| UI        | `ui/tabs.tsx`, variante `workspace` di `ui/dialog.tsx`; `features/cards/{card-detail,card-detail-route,smart-summary,dirty-guard,workspace-tabs}`; `features/interviews/{interviews-tab,interview-form,api,time}`; `features/kanban/{card-view,density}` |

## Decisioni principali

Vedi [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md). In sintesi: entità dedicata; stato ≠ esito ≠ esito della candidatura; nessun automatismo; riepilogo in una query; azione derivata; eventi senza testi riservati; migrazione controllata; modale come variante.

## Cosa NON cambia

Autenticazione, `workspaceScope`, ordinamento a gap e drag & drop del Kanban (le 101 prove E2E di M1/M2 sono state eseguite con soli adattamenti alla nuova struttura a schede, non alla logica), contratti di M2 (la scheda ha **un campo in più**, `interviewSummary`), dialog piccoli.

## Prestazioni

- Nessuna query per scheda: `summariesForBoard` è una sola `SELECT` con `JOIN` e filtro per bacheca; la ricerca usa `card_id IN (≤ 50)`. Provato con 1.500 schede ciascuna con un colloquio (bacheca in meno di 2,5 s con soglia larga; indicativo in locale).
- Il modulo dei colloqui è nel chunk del pannello (caricato quando si apre una scheda, non nella home). Dimensioni dei bundle in [testing-report.md](testing-report.md).
