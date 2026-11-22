# Piano di evoluzione progressivo (interventi A/B/C)

**Stato:** proposta · **Origine:** JW-CORE-01 (2026-11-21). Deriva dalla [Gap Analysis](../status/GAP-ANALYSIS.md) e dall'[Audit](../status/AUDIT-REPORT.md). **Durante JW-CORE-01 sono stati eseguiti solo interventi A.** Gli interventi B e C richiedono un task successivo autorizzato dal proprietario, uno per volta.

| Classe | Significato                                                                  | Chi autorizza                                 |
| ------ | ---------------------------------------------------------------------------- | --------------------------------------------- |
| **A**  | Documentazione e allineamento, nessun effetto sul codice                     | Incluso in JW-CORE-01                         |
| **B**  | Miglioramento circoscritto, compatibile con i contratti, verificabile        | Task dedicato approvato                       |
| **C**  | Nuove entità, migrazioni, cambi di API o workflow, refactoring significativi | Piano di migrazione approvato + task dedicato |

## A — eseguiti in JW-CORE-01

| ID   | Intervento                                                                                                                                                             |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A-D1 | Core, visione, personas, journeys, glossario, principi ([docs/product](../product))                                                                                    |
| A-D2 | Documenti di architettura correnti: DATA-MODEL, API-CONTRACTS, BACKEND, FRONTEND, SECURITY, REPOSITORY-MAP                                                             |
| A-D3 | Stato verificato: CURRENT-STATE, FEATURE-MATRIX, AUDIT-REPORT, GAP-ANALYSIS                                                                                            |
| A-D4 | Roadmap funzionale, dipendenze, questo piano                                                                                                                           |
| A-D5 | Specifiche per area in [docs/features](../features/INDEX.md)                                                                                                           |
| A-D6 | Guide di sviluppo ([docs/development](../development)) con i contenuti spostati dal README                                                                             |
| A-D7 | Sistema di memoria per agenti: AGENTS.md, CLAUDE.md, [docs/agents](../agents/CONTEXT-ROUTER.md)                                                                        |
| A-D8 | Indice generale [docs/INDEX.md](../INDEX.md), indice storico [docs/history](../history/README.md)                                                                      |
| A-D9 | Avvisi di stato superato in testa ai documenti canonici non aggiornati (vision, domain-model, requirements, user-stories, information-architecture, screens, overview) |

## A — da fare, in attesa di decisione o di integrazione del ramo SW

| ID   | Intervento                                                                                                                     | Perché non ora                                                                                                                           |
| ---- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| A-P1 | Nuovo ADR che supera ADR-0011 (ricerca con `instr` invece di `LIKE`, M4.0.1)                                                   | Un ADR registra una decisione: va accettato dal proprietario; il numero `0016` è già usato nel ramo SW → usare `0017`                    |
| A-P2 | Aggiornare lo stato di M4 in `roadmap/milestones.md` (M4.0, M4.0.1 su `main`, M4.1-A BLOCKED)                                  | `milestones.md` è modificato anche nel ramo SW: evitare conflitti; lo stato corrente vive in [CURRENT-STATE](../status/CURRENT-STATE.md) |
| A-P3 | Consolidare `architecture/database.md` con DATA-MODEL (sezione Modello, scadenze `due_on`, «Posizioni da implementare in M1»)  | `database.md` è modificato nel ramo SW (+194 righe)                                                                                      |
| A-P4 | Rimuovere il banner di stato copiato in 6 file storici                                                                         | File storici: basta l'indice storico                                                                                                     |
| A-P5 | Aggiornare la tabella di stato in `roadmap/backlog.md` (voci superate: CI «mai eseguita», PR #2)                               | Bassa priorità                                                                                                                           |
| A-P6 | Allineare `ux/design-system.md` («niente glassmorphism») con l'adozione di Glass Subtle e le larghezze della sidebar           | Richiede conferma del proprietario su quale regola prevale                                                                               |
| A-P7 | Correggere il riepilogo di stato nella tabella SW.10-d della roadmap SW («NON committata» contro i commit `3d97eab`…`778b2d2`) | File nel ramo SW, fuori da questo worktree                                                                                               |

## B — miglioramenti non invasivi (proposti)

| ID   | Intervento                                                                                                                                | File coinvolti                                            | Verifica                                   | Rischio |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------ | ------- |
| B-I1 | Validare le risposte di `/me`, `/workspaces`, `/overview` con gli schemi già esistenti                                                    | `apps/api/src/modules/{me,workspaces,overview}/routes.ts` | `pnpm test`; nessuna differenza di payload | Basso   |
| B-I2 | Rimuovere codice morto: `components/planned-action.tsx`, alias `cardDetailsInput`, `Loading()` duplicato                                  | `apps/web/src/...`, `packages/schemas/src/card.ts`        | typecheck, lint, test                      | Basso   |
| B-I3 | Aggiornare commenti superati (`app-shell.tsx`, `onboarding.tsx`, `lib/theme.ts`, `database.test.ts` «RESTRICT», `schema.ts` «solo owner») | file citati                                               | revisione                                  | Nullo   |
| B-I4 | `errorElement` per il router con messaggio e azione                                                                                       | `apps/web/src/app/router.tsx`                             | test del router, E2E                       | Basso   |
| B-I5 | Test che dimostri che la UI non invia mai `stage`/`outcome` a `PATCH /cards/:id` (prerequisito di A-02)                                   | `apps/web/src/features/cards/*.test.ts`                   | test rosso se reintrodotto                 | Nullo   |
| B-I6 | Contatore delle letture D1 per endpoint nei test (misura per H-08)                                                                        | helper di test API                                        | report allegato                            | Basso   |

Ordine suggerito: B-I3 → B-I2 → B-I5 → B-I1 → B-I4 → B-I6. Ogni voce in un commit separato; nessuna tocca migrazioni o contratti. **Attenzione ai conflitti:** i file web sono modificati anche in `feat/ui-dialogs-motion` e nel ramo SW; verificare prima con `git diff origin/main <ramo> -- <file>`.

## C — modifiche strutturali (proposte, non eseguite)

| ID   | Intervento                                                                    | Voci roadmap     | Prerequisiti                                                   | Criteri di verifica                                                  |
| ---- | ----------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------- | -------------------------------------------------------------------- |
| C-I1 | Integrare il ramo Smart Workspace in `main` a fette (PR per milestone)        | A-01…A-04, D-03  | Autorizzazione al push/PR; CI verde per fetta; decisione SW.0b | `main` protetta: 2 check verdi; `db:upgrade-test` su ogni migrazione |
| C-I2 | Deprecare e poi rimuovere `stage`/`outcome`/`appliedOn` da `PATCH /cards/:id` | A-02             | B-I5; decisione sul contratto                                  | Test API che rifiuta i campi; pipeline invariata                     |
| C-I3 | Entità Azienda + normalizzazione                                              | B-05             | A-01 integrato; piano di migrazione                            | Tenancy, nessuna fusione automatica                                  |
| C-I4 | Specifica unica delle metriche e Insights                                     | E-01, E-02       | SW.0c approvata                                                | Fixture con risultati attesi                                         |
| C-I5 | Formato di esportazione versionato                                            | H-05             | Decisione di ordine rispetto ad A-01                           | Export → import di prova                                             |
| C-I6 | Bacheca canonica                                                              | C-01             | A-02                                                           | E2E trascinamento con conferma                                       |
| C-I7 | Preferenze lato server, Calendario, Contatti                                  | D-08, D-06, C-05 | Decisioni di priorità                                          | Per voce                                                             |

Tutte le voci degli Stream F e G e le voci B-06, C-06, C-07 richiedono **prima** una decisione esplicita del proprietario secondo la [scope policy](scope-policy.md).
