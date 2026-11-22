# Workflow, attività e follow-up

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Obiettivo: [PRODUCT-VISION §4](../product/PRODUCT-VISION.md#4-application-workspace) e [§2.2](../product/PRODUCT-VISION.md#22-definizioni-ciclo-di-vita-proprietà-e-invarianti).

## Ambito

Stati e transizioni ammessi, attività con scadenza, follow-up, suggerimenti, promemoria.

## Stato attuale

**Transizioni** (`packages/shared/src/pipeline-transitions.ts`):

| Tipo         | Ammesso                                                                     | Conferma |
| ------------ | --------------------------------------------------------------------------- | -------- |
| `advance`    | solo in avanti tra stati aperti                                             | no       |
| `close`      | da aperto a `rejected`, `withdrawn`, `no_response`; `hired` solo da `offer` | sì       |
| `reopen`     | da chiuso a qualsiasi stato aperto                                          | sì       |
| `correction` | verso qualsiasi stato non archiviato                                        | sì       |

Nessuna transizione da o verso `archived`. Rifiuti con motivo (`stale_state`, `invalid_transition`, `unchanged`, …) e avvisi di coerenza con i colloqui (`pipeline-consistency.ts`). Il workflow **non è configurabile**.

**Attività** (WF-01; `apps/api/src/services/tasks.ts`, `packages/shared/src/tasks.ts`): legate a una scheda o al workspace; scadenza come data di calendario (`due_on`); tipo `general`/`follow_up`/`preparation`; stato derivato aperta/completata/annullata; comandi complete/reopen/cancel; **nessuna eliminazione** (decisione D-05); massimo 500 aperte; pagina `/tasks` con 6 viste.

**Suggerimenti** (WF-02): regole deterministiche S1–S3 (`packages/shared/src/task-suggestions.ts`), mai applicate in automatico; «non ora» salvato per dispositivo.

**Promemoria e notifiche:** assenti (WF-04, fuori roadmap).

## Regole vincolanti

- Nessuna AI, nessuna notifica, nessun scheduler, nessuna integrazione calendario/email senza nuova decisione ([scope policy](../roadmap/scope-policy.md)).
- La timeline delle attività è derivata dalle righe correnti, non è un registro di audit (decisione D-06).
- Spostare una scheda non cambia lo stato ([PRODUCT-PRINCIPLES PP-03](../product/PRODUCT-PRINCIPLES.md)).

## Gap e voci di roadmap

| Gap                                                                   | Voce |
| --------------------------------------------------------------------- | ---- |
| ~~Percorso legacy di scrittura dello stato~~ (risolto in v1)          | A-02 |
| ~~Bacheca canonica (spostare = transizione)~~ (fatto in v1.1, PIP-01) | C-01 |
| Follow-up collegati alla candidatura                                  | C-04 |
| Promemoria e notifiche (richiede decisione)                           | C-06 |
| Workflow configurabili                                                | C-09 |
| Suggerimenti estesi                                                   | E-04 |

## Dettaglio storico

Il pacchetto di progettazione delle Attività (specifica, UX, contratti, decisioni D-01…D-13) e il piano M3 sono nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)). Le regole in vigore sono in questo documento e nel codice (`apps/api/src/services/tasks.ts`, `packages/shared/src/task-suggestions.ts`).
