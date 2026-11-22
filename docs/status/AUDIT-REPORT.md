# Audit Report — JW-CORE-01

**Data:** 2026-11-21 · **Esecutore:** agente Claude Code · **Ambito:** audit del repository, identità di prodotto, roadmap funzionale, sistema documentale. **Nessuna modifica funzionale.**

## 1. Baseline

| Elemento             | Valore verificato                                                                                                                                    |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository           | `/home/frank/jobward`, remote `origin` = `github.com/lonelyfrank/jobward`                                                                            |
| Riferimento auditato | `origin/main` `c007e53` («fix(m4): harden D1 search and isolate staging operations (#13)»), dopo `git fetch --prune`                                 |
| Worktree principale  | `feat/ui-dialogs-motion` `8544a83` (= `origin/main` + 2 commit), file non tracciato `m4/m4-1-a-…md` (archivio storico) — **preservato, non toccato** |
| `main` locale        | `ab73c1a`, 42 commit dietro `origin/main` (non usato)                                                                                                |
| Ramo Smart Workspace | `feat/m5-sw1-smart-kanban` `778b2d2` = `origin/main` + 19 commit locali mai pushati; `scripts/spike/` non tracciato                                  |
| Altri worktree       | `jobward-glass`, `jobward-staging` (detached `c007e53`), `jobward-ui-v2`, 9 worktree `/tmp` marcati `prunable`                                       |
| Worktree di lavoro   | creato `/home/frank/jobward-core-docs`, ramo `docs/jw-core-01` da `origin/main`, **senza upstream**                                                  |

Motivo del worktree isolato: il worktree principale è su un ramo UI con un file non tracciato e ospita il `wrangler dev` del proprietario; documentare `main` sul ramo UI avrebbe mescolato modifiche non correlate.

## 2. Metodo

1. Ricognizione git e struttura del monorepo.
2. Audit in sola lettura delegato a quattro subagenti (database, API, frontend, documentazione/infrastruttura) con riferimenti `file:riga`.
3. Verifica diretta a campione delle affermazioni principali (16 tabelle; `users.display_name` mai usato; `PIPELINE_STATUSES`; percorso legacy `PATCH /cards` con `stage`/`outcome`; ricerca con `instr` e nessun `LIKE`; `/insights` segnaposto; `planned-action.tsx` non importato; identità dev diverse fra `dev` e `preview`; conteggio dei file di test).
4. Esecuzione dei gate di qualità sulla baseline **prima** di aggiungere documenti.
5. Lettura dei documenti canonici e della roadmap Smart Workspace (dal ramo, via `git show`, senza toccare quel worktree).

## Verifiche tecniche

Eseguite nel worktree `jobward-core-docs` su `c007e53` intatto, con `pnpm install --frozen-lockfile --offline`. Database solo temporanei: E2E in `.e2e-state` del worktree con porte 5199/8799 (`reuseExistingServer: false`), upgrade in directory temporanee, test API su D1 di test. Nessun DB persistente o remoto aperto.

| Comando                | Esito   | Durata | Dettaglio                                                                                                                          |
| ---------------------- | ------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`       | ✅ rc=0 | 15 s   |                                                                                                                                    |
| `pnpm lint`            | ✅ rc=0 | 35 s   |                                                                                                                                    |
| `pnpm format:check`    | ✅ rc=0 | 11 s   | baseline, prima dei nuovi documenti                                                                                                |
| `pnpm check:contrast`  | ✅ rc=0 | < 1 s  |                                                                                                                                    |
| `pnpm check:config`    | ✅ rc=0 | 2 s    |                                                                                                                                    |
| `pnpm check:brand`     | ✅ rc=0 | < 1 s  | ripetuto con i nuovi documenti: ✅                                                                                                 |
| `pnpm test:identity`   | ✅ rc=0 | < 1 s  |                                                                                                                                    |
| `pnpm db:check`        | ✅ rc=0 | 2 s    |                                                                                                                                    |
| `pnpm test`            | ✅ rc=0 | 48 s   | shared 632, schemas 59, web 172, api 441 = **1.304 test, 58 file**                                                                 |
| `pnpm build`           | ✅ rc=0 | 16 s   | dry-run del Worker e pacchetto di staging locale                                                                                   |
| `pnpm db:upgrade-test` | ✅ rc=0 | 456 s  | `0000–0002 → 0007`, `0004 → 0005`, `0005 → 0006`                                                                                   |
| `pnpm test:e2e`        | ✅ rc=0 | 1115 s | **237 superati, 1 saltato per configurazione** (`workspace-visual.spec.ts`: `test.skip` se manca `WORKSPACE_VISUAL_DIR`), Chromium |
| `pnpm test:preview`    | ✅ rc=0 | 36 s   | **14 superati** sulla build di produzione                                                                                          |

Dopo la scrittura dei documenti: Prettier applicato ai soli file nuovi o modificati; controllo dei collegamenti Markdown e delle ancore (vedi §8).

## 3. Architettura reale (sintesi)

Monolite modulare in monorepo pnpm: SPA React 19 + Vite servita dallo stesso Worker Cloudflare (Hono) che espone `/api/v1`; D1 con 16 tabelle, migrazioni `0000`–`0007`; contratti Zod condivisi; dominio puro in `@jobward/shared`. Autenticazione solo Cloudflare Access per un unico proprietario, fail-closed. Dettagli: [REPOSITORY-MAP](../architecture/REPOSITORY-MAP.md), [DATA-MODEL](../architecture/DATA-MODEL.md), [API-CONTRACTS](../architecture/API-CONTRACTS.md), [BACKEND](../architecture/BACKEND.md), [FRONTEND](../architecture/FRONTEND.md), [SECURITY](../architecture/SECURITY.md).

## 4. Funzionalità

Matrice completa con evidenze: [FEATURE-MATRIX](FEATURE-MATRIX.md) (31 righe in `main` e 6 del ramo SW). In sintesi: fondamenta, bacheche, Kanban, opportunità, campi personalizzati, etichette, Tabella, ricerca, pipeline, colloqui, note, timeline, attività e suggerimenti sono **implementati e testati**; documenti **parziali** (solo riferimenti); insights, export, cancellazione **pianificati**; Opportunity Center, aziende, contatti, notifiche, calendario, mappa, matrice **non esistono**.

## 5. Risultati rilevanti dell'audit

| #    | Risultato                                                                                                                                                                | Evidenza                                                                                                                   | Classe                                             |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| R-01 | Opportunità e candidatura coincidono nella scheda; la scheda richiede sempre bacheca e colonna                                                                           | `packages/database/src/schema.ts` (`cards`, `application_details`)                                                         | Gap di visione → A-01                              |
| R-02 | `PATCH /cards/:id` accetta `stage`/`outcome`/`appliedOn` senza grafo delle transizioni né `dedupe_key` (percorso legacy, UI non lo usa)                                  | `packages/schemas/src/card.ts` (`detailsShape`), `apps/api/src/services/cards.ts`                                          | Debito → A-02, B-I5, C-I2                          |
| R-03 | ADR-0011 (ricerca con `LIKE … ESCAPE`) resta «Accettato» ma il codice usa `instr` dal M4.0.1, senza ADR che lo superi                                                    | `apps/api/src/services/search-text.ts`, `decisions/README.md`                                                              | Documentale → A-P1                                 |
| R-04 | Nessun rate limiting (codice `rate_limited` mai usato)                                                                                                                   | `packages/shared/src/errors.ts`                                                                                            | Piattaforma → H-02                                 |
| R-05 | Risposte di `/me`, `/workspaces`, `/overview` non validate dagli schemi esistenti                                                                                        | `apps/api/src/modules/{me,workspaces,overview}/routes.ts`                                                                  | B-I1                                               |
| R-06 | Codice dormiente: `users.display_name`, `tasks.due_at`, 3 tipi di evento mai emessi, ruoli editor/viewer, `quickActions`, `planned-action.tsx`, alias `cardDetailsInput` | [BACKEND](../architecture/BACKEND.md#codice-dormiente-noto), [FRONTEND](../architecture/FRONTEND.md#codice-dormiente-noto) | B-I2, A-06                                         |
| R-07 | Eliminare una bacheca elimina le sue schede (CASCADE)                                                                                                                    | migrazione `0001`, `services/boards.ts`                                                                                    | Comportamento previsto da cambiare in SW.13 (D-01) |
| R-08 | Nessun ambiente remoto: produzione inerte, staging mai eseguito, inventario M4.1-A BLOCKED                                                                               | `apps/api/wrangler.jsonc`, `scripts/staging.mjs`                                                                           | H-03, H-04                                         |
| R-09 | Router senza `errorElement`                                                                                                                                              | `apps/web/src/app/router.tsx`                                                                                              | B-I4                                               |
| R-10 | Commenti superati nel codice (es. «RESTRICT» in `database.test.ts`, FK ora NO ACTION)                                                                                    | `apps/api/test/database.test.ts`                                                                                           | B-I3                                               |

Nessun difetto funzionale bloccante è emerso; tutte le suite eseguite sono verdi.

## Incongruenze documentali

| Incongruenza                                                                                     | Trattamento in JW-CORE-01                                                                                |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| README contraddittorio (M3 code complete vs «merge da verificare»), comandi e struttura superati | README ridotto a punto d'ingresso; contenuti spostati in `development/`                                  |
| `milestones.md` e piano M4: «M4 non avviata», mentre M4.0 e M4.0.1 sono su `main`                | Stato reale in [CURRENT-STATE](CURRENT-STATE.md); correzione A-P2 rinviata (file modificato nel ramo SW) |
| `requirements.md`, `user-stories.md`: stati ⏳ per funzioni implementate; scadenze «istante UTC» | Avviso in testa                                                                                          |
| `domain-model.md` fermo a M2; titolo «Fase, esito e colonna» duplicato                           | Avviso in testa; catalogo in DATA-MODEL                                                                  |
| `database.md`: scadenze `due_at`, «Posizioni da implementare in M1»                              | Indicato in INDEX (⚠); consolidamento A-P3 rinviato (file modificato nel ramo SW)                        |
| `overview.md`: moduli e ambienti di M0, C2 «non avviato»                                         | Avviso in testa                                                                                          |
| `design-system.md` «niente glassmorphism» vs Glass Subtle; larghezze della sidebar discordanti   | Avviso in testa; decisione A-P6                                                                          |
| `information-architecture.md`, `screens.md` fermi a M0/M1                                        | Avviso in testa                                                                                          |
| ADR-0011 superato dal codice                                                                     | Proposta A-P1 (nuovo ADR `0017`)                                                                         |
| Contratti API sparsi in 5 documenti per milestone                                                | Catalogo corrente [API-CONTRACTS](../architecture/API-CONTRACTS.md)                                      |
| Banner di stato copiato in 6 file                                                                | Indice storico; rimozione A-P4 facoltativa                                                               |
| Ramo SW: riga SW.10-d «NON committata» mentre i commit `3d97eab`…`778b2d2` esistono              | Segnalato (A-P7); file fuori da questo worktree                                                          |

## 6. Struttura documentale creata

Nuovi: `AGENTS.md`, `CLAUDE.md`, `docs/INDEX.md`; `docs/product/{CORE,PRODUCT-VISION,PERSONAS,USER-JOURNEYS,DOMAIN-GLOSSARY,PRODUCT-PRINCIPLES}.md`; `docs/architecture/{REPOSITORY-MAP,DATA-MODEL,API-CONTRACTS,BACKEND,FRONTEND,SECURITY}.md`; `docs/features/{INDEX,OPPORTUNITIES,APPLICATIONS,WORKFLOWS,BOARDS,SMART-VIEWS,ANALYTICS,INTEGRATIONS}.md`; `docs/roadmap/{MASTER-FUNCTIONAL-ROADMAP,DEPENDENCIES,IMPLEMENTATION-PLAN}.md`; `docs/development/{GETTING-STARTED,COMMANDS,TESTING,CONTRIBUTING,DEPLOYMENT}.md`; `docs/agents/{CONTEXT-ROUTER,MEMORY-SYSTEM,WORKFLOW,TOKEN-EFFICIENCY,CURRENT-CONTEXT,HANDOFF-TEMPLATE}.md`; `docs/status/{CURRENT-STATE,FEATURE-MATRIX,AUDIT-REPORT,GAP-ANALYSIS}.md`; `docs/history/README.md`.

Modificati: `README.md` (ridotto; contenuti spostati, non persi); avviso in testa a `product/{vision,domain-model,requirements,user-stories}.md`, `ux/{design-system,information-architecture,screens}.md`, `architecture/overview.md`, `roadmap/backlog.md`.

**Scelte deliberate di non creare o non spostare:**

- `architecture/OVERVIEW.md` e `DECISIONS.md` non creati: esistono già `overview.md` e `decisions/README.md` (indicizzati).
- Report storici **non spostati** in `docs/history/`: lo spostamento avrebbe rotto decine di collegamenti e creato conflitti con i rami aperti; `history/README.md` li indicizza sul posto.
- Non modificati i file toccati anche dal ramo SW (`milestones.md`, `scope-policy.md`, `database.md`, `decisions/README.md`) per evitare conflitti di integrazione.
- Nessun ADR nuovo: un ADR registra una decisione del proprietario (proposte A-P1).

## 7. Sicurezza del procedimento

Nessun push, PR, deploy, migrazione, commit; nessun branch o worktree eliminato; nessun file del worktree principale, del ramo SW o dei worktree M4/UI modificato; nessun database persistente o remoto aperto; nessun identificativo di account copiato nei documenti. Unica azione su git oltre alla lettura: `git fetch --prune` (aggiorna solo i riferimenti remoti) e la creazione del worktree/ramo locale `docs/jw-core-01`.

## 8. Validazione della documentazione

Vedi [Validazione finale](#validazione-finale).

## Validazione finale

| Controllo                                  | Esito                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm format:check` sull'intera repository | ✅ dopo Prettier sui soli file nuovi o modificati                                                                                                                                          |
| `pnpm check:brand` con i nuovi documenti   | ✅                                                                                                                                                                                         |
| Collegamenti e ancore nei 52 file toccati  | ✅ 560 collegamenti relativi, 0 problemi (script di controllo locale, slug in stile GitHub)                                                                                                |
| Collegamenti in tutta la documentazione    | 3 ancore rotte **preesistenti** in file storici non modificati: `m3/stabilization/final-report.md` (1), `m0-delivery` (2)                                                                  |
| Perimetro delle modifiche                  | Solo Markdown: 42 file nuovi, 10 modificati; nessun file di codice, configurazione o migrazione                                                                                            |
| Altri worktree                             | Principale e ramo SW invariati rispetto alla baseline; `jobward-ui-v2` mostra 43 modifiche non committate **non verificate all'avvio**: JW-CORE-01 non vi ha eseguito comandi di scrittura |
| Separazione visione / implementazione      | Visione in `product/`, stato in `status/`, capacità future in `roadmap/`; ogni stato cita il commit di verifica                                                                            |
| Duplicazioni                               | Nessun nuovo documento omonimo di uno esistente (`overview.md`, `decisions/README.md` riusati); contenuti spostati dal README, non copiati                                                 |
| Riferimenti non verificati                 | Il ramo SW è indicato come «non verificato in JW-CORE-01»; le stime di token sono dichiarate come stime                                                                                    |

Limiti: il controllo delle ancore approssima lo slug di GitHub; nessuna verifica visiva del rendering Markdown; le misure di efficienza sono dimensioni di file, non consumi di sessioni reali ([TOKEN-EFFICIENCY](../agents/TOKEN-EFFICIENCY.md)).

## Verifiche v1

**Data:** 2026-11-21 · **Ramo:** `jobward-v1` (worktree `jobward-core-docs`) · **Contesto:** dopo la ristrutturazione locale ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)). Database solo temporanei o di test; smoke test manuale dell'API sul D1 demo locale.

| Comando               | Esito   | Dettaglio                                                                                                                                                                                                                                                                                      |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`      | ✅      |                                                                                                                                                                                                                                                                                                |
| `pnpm lint`           | ✅      | zero warning                                                                                                                                                                                                                                                                                   |
| `pnpm format:check`   | ✅      |                                                                                                                                                                                                                                                                                                |
| `pnpm check:contrast` | ✅      |                                                                                                                                                                                                                                                                                                |
| `pnpm db:check`       | ✅      | base unica `0000_jobward_v1` coerente con lo schema                                                                                                                                                                                                                                            |
| `pnpm test`           | ✅      | **1.648 test**: shared 805, schemas 71, web 287, api 485                                                                                                                                                                                                                                       |
| `pnpm build`          | ✅      |                                                                                                                                                                                                                                                                                                |
| `pnpm test:preview`   | ✅      | 14/14                                                                                                                                                                                                                                                                                          |
| `pnpm test:e2e`       | ⚠️ rc=1 | **258 superati, 1 saltato** (per configurazione), **1 fallito**: `kanban-zoom.spec.ts` «tastiera: riordina schede con zoom ridotto» (annuncio non arrivato entro 5 s). Rieseguito da solo con `--repeat-each=2`: **18/18 superati** → intermittente sotto carico, non riprodotto in isolamento |

Smoke test dell'API su dati demo (`pnpm dev:api`): `/opportunities?scope=applications` restituisce le due candidature (fase «applied», 2026-11-03, `applicationCount` 1); `/insights` → 2 opportunità, 2 candidature attive, 2 in attesa di risposta, mediana non calcolata (nessuna risposta); `/export` → tutte le collezioni; dettaglio, timeline e candidature della scheda rispondono 200.

Correzioni fatte durante la verifica (nessuna modifica per «far passare» i test: ogni test è stato adeguato al nuovo comportamento voluto): seed E2E che impostano lo stato tramite candidatura e pipeline; sezione «Date dell'annuncio» e data d'invio nel pannello Candidature; etichette «Nuova opportunità»; attesa della chiusura animata del menu account prima di riaprirlo.

## Verifiche v1.1

**Data:** 2026-11-21 · **Contenuto:** bacheca canonica (C-01), inserimento guidato (B-04), aziende e duplicati (B-05), viste salvate (D-04); migrazioni additive `0001`, `0002`.

| Comando                                               | Esito | Dettaglio                                                                                                                                                                                                                                        |
| ----------------------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| typecheck, lint, format, contrasto, `db:check`, build | ✅    |                                                                                                                                                                                                                                                  |
| `pnpm test`                                           | ✅    | **1.664 test**: shared 810, schemas 71, web 290, api 493                                                                                                                                                                                         |
| `pnpm test:preview`                                   | ✅    | 14/14                                                                                                                                                                                                                                            |
| `pnpm test:e2e`                                       | ⚠️→✅ | Prima corsa: 255 superati, 1 saltato, **1 fallito** (axe `scrollable-region-focusable` sulla pipeline vuota, difetto reale) e 7 non eseguiti (stesso gruppo seriale). Corretto (`63c7196`); `app.spec` + `product-v1.spec` rieseguiti: **15/15** |

Verifica visiva con screenshot Playwright sull'app in esecuzione: pipeline, conferma dello spostamento, inserimento guidato (passi 1 e 4), avviso di duplicato, pagina azienda, barra delle viste.

Nota di procedimento: durante un controllo di sintassi lo script `seed-demo.mjs` è stato importato per errore ed eseguito sul D1 demo; essendo idempotente (`INSERT OR IGNORE`) non ha modificato nulla (verificato: 2 aziende, 2 candidature, nessuna vista).
