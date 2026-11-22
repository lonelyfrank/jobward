# PID-01 — Audit documentale, memoria ed efficienza del contesto

**Data:** 2026-11-22 · **Esecutore:** agente Claude Code · **Base:** ramo `jobward-v1`, HEAD `b34c032`, worktree `/home/frank/jobward-core-docs` · **Ambito:** solo documentazione e memoria degli agenti; nessuna modifica a codice, dipendenze, configurazione, database o Git remoto. Report datato: non si aggiorna (stato corrente in [CURRENT-STATE](CURRENT-STATE.md)).

## 1. Sintesi

Il sistema documentale creato in JW-CORE-01 (L0/L1/L3, proprietario unico per argomento, regole di aggiornamento) era già sano nella struttura: 0 collegamenti rotti nei documenti canonici e 0,3% di contenuto duplicato. Il problema reale era la **freschezza**. Il refactoring v1/v1.1 ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)) aveva lasciato 16 documenti canonici «verificati» sul commit precedente `c007e53`, con affermazioni ormai **false**: per esempio «una candidatura per scheda», «l'eliminazione di una bacheca elimina le schede», «calendario, aziende e viste salvate non esistono», «esportazione non implementata», «nessun dato reale nel seed». In più, 23 percorsi citati non esistevano.

Interventi:

- correzione delle affermazioni verificate come false (§5);
- avvisi espliciti sui documenti superati invece di riscriverli;
- una **guida utente**, che prima non esisteva ([docs/user](../user/README.md));
- una **mappa d'impatto** per sottosistema ([CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md));
- un router più compatto (−28%);
- una politica di affidabilità e archiviazione in [MEMORY-SYSTEM](../agents/MEMORY-SYSTEM.md);
- il consolidamento della memoria personale di Claude Code, da 5 a 4 voci e −60% di byte.

## 2. Baseline

| Voce                                   | Valore                                                                                                                                                                                   |
| -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worktree di sessione                   | `/home/frank/jobward`, ramo `feat/ui-dialogs-motion`: **non** è la linea attiva (già integrato in `jobward-v1`). Il proprietario ha indicato di lavorare in `jobward-v1`.                |
| Linea attiva                           | `jobward-v1` @ `b34c032`, nessun upstream, solo commit locali                                                                                                                            |
| Lavoro altrui                          | Un'altra sessione aveva 19 file modificati e 8 non tracciati nello stesso worktree (Overview, Insights, Calendario, sidebar di Opportunità). **Nessuno è stato toccato** (elenco in §9). |
| Stack (VERIFICATO)                     | Monorepo pnpm 12 · Node ≥ 22.22 · React 19 + Vite 8 · Worker Hono su Cloudflare (solo `wrangler dev` locale) · D1/SQLite con Drizzle · Zod · Vitest, Playwright + axe                    |
| Pacchetti                              | `apps/web`, `apps/api`, `packages/{database,schemas,shared}`, `scripts/` (4 script)                                                                                                      |
| Test (conteggio statico, non eseguiti) | API: 35 file · web: 28 file Vitest · E2E: 23 spec + 1 spec preview                                                                                                                       |
| Migrazioni                             | `0000_jobward_v1` (18 tabelle, 41 indici, 9 trigger, vista `current_applications`), `0001_companies`, `0002_saved_views`                                                                 |
| Deployment                             | Nessuno. CI `.github/workflows/ci.yml` presente ma inattiva sulla linea locale                                                                                                           |

## 3. Corrispondenza dei deliverable PID-01

PID-01 suggerisce una struttura di riferimento e chiede di adattarla alle convenzioni esistenti. Per non creare due radici concorrenti, ogni deliverable è stato mappato su un documento esistente.

| Deliverable PID-01              | Posizione                                                                                                                   | Esito                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `AGENTS.md`, `CLAUDE.md`        | invariati (CLAUDE importa AGENTS senza duplicarlo)                                                                          | già conformi                                                                                                 |
| `docs/README.md`                | [docs/INDEX.md](../INDEX.md)                                                                                                | aggiornato (utenti, riferimento tecnico, ADR 0001–0017)                                                      |
| `product/CORE.md`               | [product/CORE.md](../product/CORE.md)                                                                                       | aggiunta §9 «Visione e stato attuale» (solo rimandi)                                                         |
| `product/VISION.md`             | [product/PRODUCT-VISION.md](../product/PRODUCT-VISION.md)                                                                   | invariato                                                                                                    |
| `product/CAPABILITIES.md`       | [status/FEATURE-MATRIX.md](FEATURE-MATRIX.md)                                                                               | righe errate corrette                                                                                        |
| `product/ROADMAP.md`            | [roadmap/MASTER-FUNCTIONAL-ROADMAP.md](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) + [milestones](../roadmap/milestones.md)    | indice già allineato a v1; avvisi su milestones e piano M4                                                   |
| `agents/CONTEXT_ROUTER.md`      | [agents/CONTEXT-ROUTER.md](../agents/CONTEXT-ROUTER.md)                                                                     | riscritto in formato compatto, più voci                                                                      |
| `agents/WORK_PROTOCOL.md`       | [agents/WORKFLOW.md](../agents/WORKFLOW.md)                                                                                 | passo CHANGE-IMPACT e nuove regole di aggiornamento                                                          |
| `agents/MEMORY_POLICY.md`       | [agents/MEMORY-SYSTEM.md](../agents/MEMORY-SYSTEM.md)                                                                       | etichette di affidabilità, archiviazione, controllo di freschezza                                            |
| `agents/ACTIVE_STATE.md`        | [agents/CURRENT-CONTEXT.md](../agents/CURRENT-CONTEXT.md)                                                                   | **non toccato**: in modifica da un'altra sessione                                                            |
| `agents/HANDOFF_TEMPLATE.md`    | [agents/HANDOFF-TEMPLATE.md](../agents/HANDOFF-TEMPLATE.md)                                                                 | già conforme                                                                                                 |
| `user/*`                        | [user/README](../user/README.md), [USER-GUIDE](../user/USER-GUIDE.md), [TROUBLESHOOTING](../user/TROUBLESHOOTING.md)        | **nuovi**                                                                                                    |
| `development/*`                 | [development/](../development/GETTING-STARTED.md)                                                                           | correzioni (Node, dati locali, CI)                                                                           |
| `architecture/OVERVIEW.md`      | [overview](../architecture/overview.md) (⚠) + [BACKEND](../architecture/BACKEND.md)/[FRONTEND](../architecture/FRONTEND.md) | BACKEND/FRONTEND corretti                                                                                    |
| `architecture/MODULE_MAP.md`    | [REPOSITORY-MAP](../architecture/REPOSITORY-MAP.md)                                                                         | corretto (conteggi, rotte, script)                                                                           |
| `architecture/CHANGE_IMPACT.md` | [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md)                                                                           | **nuovo**, con diagramma Mermaid delle dipendenze                                                            |
| `reference/`                    | API-CONTRACTS, DATA-MODEL, COMMANDS, GETTING-STARTED (variabili)                                                            | non creata: tutto esiste già, indicizzato in INDEX                                                           |
| `decisions/`                    | [architecture/decisions](../architecture/decisions/README.md)                                                               | invariato (ADR immutabili); divergenze in §8                                                                 |
| `audits/*`                      | questo report                                                                                                               | un solo file, perché i report vanno in `docs/status/` ([WORKFLOW](../agents/WORKFLOW.md#report-di-consegna)) |
| `history/README.md`             | [history/README](../history/README.md)                                                                                      | aggiunti i report SW.10; corretto il rimando a `staging:*`                                                   |

## 4. Ricostruzione del prodotto

Le fonti sono [CORE](../product/CORE.md) (identità indicata dal proprietario il 2026-11-21), la [scope policy](../roadmap/scope-policy.md), gli ADR e il codice. Le conversazioni passate non sono accessibili; la memoria personale contiene solo decisioni già trascritte nei documenti.

- **Che cos'è (VERIFICATO):** uno _Smart Career Workspace_ personale, gratuito, per chi cerca lavoro. Opportunità, candidature 1:N, colloqui, attività, aziende e viste sono collegati; le analisi sono deterministiche.
- **Perché e per chi (DOCUMENTATO, dal proprietario):** chiunque cerchi lavoro, in qualsiasi settore. Le informazioni sono disperse, le statistiche inaffidabili e i follow-up dimenticati.
- **Che cosa fa oggi (VERIFICATO nel codice):** v1.1 locale e mono-utente; capacità complete in [FEATURE-MATRIX](FEATURE-MATRIX.md).
- **Che cosa deve diventare (PIANIFICATO/PROPOSTO):** [PRODUCT-VISION](../product/PRODUCT-VISION.md). Prossimi candidati: C-05 contatti, B-07 matrice comparativa, C-08 offerte, D-05 timeline globale. Nessuno è approvato.
- **Confini (VERIFICATO, vincolanti):** niente AI/LLM, recruiter/ATS o marketplace senza nuova decisione. Nessun agente amplia una milestone.
- **Domande aperte (IGNOTO):** se e quando integrare `jobward-v1` in `main`; il modello di pubblicazione e di autenticazione (H-07); il destino di M4/M5 come milestone ora che il lavoro è per capacità.

La ricostruzione non ha richiesto modifiche all'identità: CORE era coerente con il codice.

## 5. Audit del repository: incongruenze trovate

Metodo: due agenti di sola lettura (backend/dati e frontend/strumenti) hanno confrontato i documenti con il codice a `b34c032`. Ho verificato a campione nel codice le affermazioni su cui ho basato le correzioni:

- numero di moduli, servizi e test;
- indici e trigger;
- seed demo;
- eliminazione delle bacheche;
- voci di navigazione e rotte;
- etichette dell'interfaccia;
- `.nvmrc`;
- contenuto dell'esportazione.

Una sola affermazione degli agenti è stata corretta: gli spec E2E tracciati sono 23, non 24.

| Documento                                            | Affermazione errata (prima)                                                                                        | Realtà verificata                                                              | Stato                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------ | --------------------------------------------- |
| features/APPLICATIONS                                | «una candidatura per scheda, senza entità propria»                                                                 | `applications` 1:N, `current_applications`                                     | corretto                                      |
| features/BOARDS, FEATURE-MATRIX BRD-01               | eliminare una bacheca elimina le schede (CASCADE)                                                                  | FK NO ACTION + `deleteBoard` che scollega le opportunità                       | corretto                                      |
| FRONTEND                                             | 5 voci di navigazione; calendario, aziende e viste salvate «non esistono»; esportazione «In arrivo»                | 8 voci; tutto esiste                                                           | corretto                                      |
| SECURITY                                             | «nessun dato reale come seed»; esportazione non implementata; `check:config`                                       | il seed contiene due candidature reali; `GET /export` esiste; script rimosso   | corretto                                      |
| SECURITY                                             | identità «solo Cloudflare Access»                                                                                  | tutti gli ambienti usati girano con `AUTH_MODE=dev`                            | corretto                                      |
| DATA-MODEL                                           | 59 indici; calendario legge `current_applications`; aziende e viste assenti dalle relazioni; snapshot «immutabili» | 41 indici; il calendario no; relazioni aggiunte; immutabilità solo applicativa | corretto                                      |
| BACKEND                                              | motore di query «solo nel ramo SW»; 29 file di test; «100 bacheche per bacheca»; alias `cardDetailsInput`          | integrato; 35 file; per workspace; alias inesistente                           | corretto                                      |
| REPOSITORY-MAP                                       | 15 moduli, 22 servizi, 19 spec, migrazioni 0000–0007, cinque script inesistenti, `coming-soon`, Topbar             | 21, 29, 23; 0000–0002; 4 script reali; nessuna topbar                          | corretto                                      |
| FEATURE-MATRIX                                       | OPP-05 «nessuna vista salvata»; OPP-07/WF-03 aziende «Proposta»; PLT-06 CI «Implementata»; EXP-02 «In arrivo»      | in contraddizione con VIE-01/COM-01; CI inattiva su v1; nessuna interfaccia    | corretto                                      |
| features/SMART-VIEWS                                 | calendario ⬜, nessuna vista salvata, SW «non integrato»                                                           | esistono / integrato                                                           | corretto                                      |
| GETTING-STARTED                                      | `.nvmrc` = ≥ 22.22; `db:upgrade-test`; `0001_tenant_integrity.sql`                                                 | `.nvmrc` = `22`; script e file rimossi                                         | corretto                                      |
| README                                               | pipeline, aziende, viste salvate e inserimento guidato assenti; GitHub Actions come attiva                         | presenti; CI inattiva                                                          | corretto                                      |
| database.md                                          | 0009/0010/0011 attuali, 18 tabelle, «candidature non attive»                                                       | base unica v1, 20 tabelle                                                      | avviso in testa (sezioni conservate)          |
| milestones, piano M4, roadmap SW, smart-query-engine | stato «corrente» del 2026-11-08 / ramo SW come ufficiale                                                           | superati da ADR-0017                                                           | avviso in testa                               |
| GAP-ANALYSIS, DOMAIN-GLOSSARY, USER-JOURNEYS         | colonna «oggi in `main`» su `c007e53`                                                                              | v1 ha chiuso molti gap                                                         | avviso in testa; riallineamento da fare (§10) |

## 6. Audit della memoria

### 6.1 Sistemi di memoria presenti

| Sistema                                                                                                 | Caricamento                                                             | Classe                    |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------- |
| `CLAUDE.md` → `@AGENTS.md`                                                                              | automatico (Claude Code); `AGENTS.md` automatico anche per altri agenti | L0                        |
| `docs/agents/CURRENT-CONTEXT.md`, `CONTEXT-ROUTER.md`                                                   | obbligatorio per istruzione di AGENTS.md                                | L3 / L1                   |
| Memoria personale di Claude Code (`~/.claude/projects/-home-frank-jobward/memory/`): indice `MEMORY.md` | automatico, in **ogni** sessione aperta da `/home/frank/jobward`        | personale, non versionata |
| File della memoria personale                                                                            | su richiamo                                                             | personale                 |
| `docs/**`                                                                                               | su richiesta, tramite router                                            | L2 / storico              |

Non esistono altri file di istruzioni per agenti nella repository: nessun `.cursor`, `.github/copilot-instructions.md`, `CONTEXT.md` o `NOTES.md` annidato.

### 6.2 Classificazione e problemi

| Elemento                                                      | Classe                                     | Problema                                                                                                   | Azione                                                                    |
| ------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Memoria «Smart Workspace initiative»                          | STORICA (presentata come attiva)           | Worktree e piano di migrazioni 0008+ superati da ADR-0017                                                  | Sostituita da un puntatore (`project-history-pointers`)                   |
| Memoria «SW.6 cards-rebuild spike» (8,3 KB)                   | STORICA / EFFIMERA                         | Dettagli di migrazioni mai arrivate su v1; duplicava i report `sw10-*`                                     | Idem; conservate solo 4 lezioni operative ancora valide                   |
| Memoria «Tasks design state» (2026-11-07)                     | OBSOLETA                                   | Condizioni di M3 ormai soddisfatte                                                                         | Idem                                                                      |
| Memoria «Jobward v1 local line»                               | STATO ATTIVO + fatti duplicati di ADR-0017 | Ripeteva le decisioni v1                                                                                   | Ridotta a puntatori e fatti non presenti nella repository                 |
| Regole Git e dati del proprietario                            | CONOSCENZA OPERATIVA                       | Solo in AGENTS.md di `jobward-v1`, quindi invisibili da un worktree vecchio come quello di questa sessione | Nuova memoria di feedback `feedback-owner-safety-rules`                   |
| Banner «Stato corrente (2026-11-08)» in milestones e piano M4 | STORICO caricato come attuale              | 63 shingle duplicati tra i due file                                                                        | Avviso PID-01 in testa a entrambi                                         |
| Report SW.10 in `docs/roadmap/`                               | STORICI in una cartella di pianificazione  | 40 percorsi inesistenti                                                                                    | Aggiunti all'indice storico; non spostati, per non rompere i collegamenti |

### 6.3 Corrispondenza vecchio → nuovo (memoria personale)

| Vecchio                                   | Nuovo                                                                  |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `project-m5-smart-workspace.md`           | `project-history-pointers.md` → ADR-0016, `roadmap/smart-workspace.md` |
| `project-sw6-cards-rebuild-spike.md`      | `project-history-pointers.md` → `sw10-*`                               |
| `project-tasks-design-state.md`           | `project-history-pointers.md` → `m3/tasks-index.md`                    |
| regole operative sparse nelle tre memorie | `feedback-owner-safety-rules.md` (canonico: AGENTS.md)                 |
| `project-jw-core-01-docs.md`              | stesso file, ridotto a puntatori                                       |

Nessuna decisione di prodotto è stata scartata: tutte esistono negli ADR e nei report citati. Una copia delle memorie originali è stata conservata solo nella cartella temporanea della sessione.

## 7. Efficienza del contesto

### Metodo di misura

- **Token stimati** = byte / 4 … byte / 3, come in [TOKEN-EFFICIENCY](../agents/TOKEN-EFFICIENCY.md). È una stima, non un conteggio di tokenizer.
- **Prima** = file a `b34c032` (`git archive HEAD`). **Dopo** = albero di lavoro. `CURRENT-CONTEXT.md` è misurato a HEAD in entrambi i casi, perché in modifica da un'altra sessione.
- **Collegamenti rotti:** collegamenti Markdown relativi il cui file non esiste.
- **Percorsi obsoleti:** percorsi tra apici inversi sotto `apps/`, `packages/`, `scripts/`, `docs/` o `.github/` che non esistono.
- **Documenti storici esclusi dal conteggio:** `docs/m*/`, `docs/history/`, `sw10-*` (archivio storico), ADR e AUDIT-REPORT.
- **Documenti con avviso:** quelli con un blocco `> **Avviso` nei primi 1.500 caratteri.
- **Duplicazione:** shingle di 12 parole condivisi tra documenti non storici.
- Gli script di misura erano nella cartella temporanea della sessione e non sono versionati: proposta in §10.

| Metrica                                                                                         | Prima                       | Dopo                        | Note                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------- | --------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Contesto d'ingresso obbligatorio (CLAUDE + AGENTS + CURRENT-CONTEXT + ROUTER)                   | 12.728 B (~3.200–4.240 tok) | 10.737 B (~2.680–3.580 tok) | −16%; il router passa da 7.137 a 5.146 B (−28%) con 3 voci in più                                                                                                                          |
| Indice della memoria personale (caricato sempre)                                                | 1.030 B                     | 632 B                       | −39%                                                                                                                                                                                       |
| File della memoria personale (su richiamo)                                                      | 18.048 B in 5 file          | 7.310 B in 4 file           | −60%                                                                                                                                                                                       |
| Collegamenti rotti nei documenti canonici                                                       | 0                           | 0                           | —                                                                                                                                                                                          |
| Percorsi obsoleti in documenti canonici **senza avviso**                                        | 23                          | 0                           | Restano 3 rimandi intenzionali: `scripts/staging.mjs` nella storia git, nome del ramo `docs/jw-core-01`, `scripts/spike/` in un altro worktree                                             |
| Percorsi obsoleti in documenti canonici con avviso                                              | 0                           | 23                          | Dichiarati dall'avviso (database.md, roadmap SW)                                                                                                                                           |
| Documenti canonici che dichiaravano una verifica su `c007e53` pur contenendo affermazioni false | 16                          | 2 (pendenti, §9)            | 10 riverificati su `b34c032`; 3 con avviso (GAP-ANALYSIS, DOMAIN-GLOSSARY, USER-JOURNEYS); MASTER-FUNCTIONAL-ROADMAP già allineata nell'indice; ANALYTICS e OPPORTUNITIES non toccati (§9) |
| Contenuto duplicato (shingle condivisi)                                                         | 0,3%                        | invariato                   | Il problema non era la duplicazione                                                                                                                                                        |
| Istruzioni contraddittorie                                                                      | 4                           | 0 nei file toccati          | AGENTS.md vs CI «richiesta» in CONTRIBUTING; memoria «worktree SW ufficiale» vs ADR-0017; FEATURE-MATRIX OPP-05/OPP-07 vs VIE-01/COM-01; database.md vs DATA-MODEL                         |
| Documenti canonici senza intestazione di stato                                                  | 9                           | 8                           | Rimanenti: INDEX, CURRENT-CONTEXT, HANDOFF-TEMPLATE, authentication, decisions/README, 3 documenti UX (non verificati in questo audit)                                                     |

### Simulazione di cinque ricerche

Ogni percorso parte dal contesto d'ingresso (~10,7 KB).

| #   | Compito                                                 | Documenti dopo l'ingresso                                                                  | Contesto aggiunto          | Codice individuato                                                                                                       | Prima di PID-01                                                                                           |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| 1   | Cambiare la UI del Calendario o una voce di navigazione | router → FRONTEND → CHANGE-IMPACT (riga «Navigazione e rotte», con `grep`)                 | ~16 KB (FRONTEND + 1 riga) | `W/routes/calendar.tsx`, `W/layouts/nav.ts`, `W/app/router.tsx`                                                          | **Fuorviante:** FRONTEND diceva che il calendario non esiste e che le voci di navigazione sono 5          |
| 2   | Cambiare la regola di ricandidatura                     | router → APPLICATIONS, WORKFLOWS → riga «Pipeline e candidature»                           | ~16 KB                     | `A/services/applications.ts`, `A/services/pipeline.ts`, `S/pipeline-transitions.ts`, test `T/applications`, `T/pipeline` | **Fuorviante:** APPLICATIONS diceva «una candidatura per scheda, senza entità»                            |
| 3   | Trovare i test delle aziende                            | router (Test) → CHANGE-IMPACT, riga «Aziende e duplicati»                                  | < 1 KB con `grep`          | `S/companies.test.ts`, `T/companies.test.ts`, `E/product-v1.spec.ts`                                                     | Possibile ma lento: TESTING aveva conteggi vecchi; la riga COM-01 di FEATURE-MATRIX era corretta          |
| 4   | Stato dei contatti (C-05)                               | router (Stato di una funzione) → `grep WF-03` in FEATURE-MATRIX → `### C-05` nella roadmap | ~2 KB con `grep`           | nessuno (Proposta; tipo di evento dormiente `contact_logged`)                                                            | **Parzialmente errato:** WF-03 indicava «contatti e aziende» come proposta, ma le aziende esistono        |
| 5   | Vincoli per una nuova tabella (offerte, C-08)           | router (Database) → DATA-MODEL, riga «Schema e migrazioni», ADR-0017                       | ~18 KB                     | `packages/database/src/schema.ts`, nuova migrazione additiva dopo `0002`, `pnpm db:check`                                | **Fuorviante:** REPOSITORY-MAP diceva migrazioni 0000–0007; database.md descriveva 0009–0011 come attuali |

Con i documenti aggiornati, tutte e cinque le ricerche arrivano alla destinazione corretta senza aprire report storici.

**Inefficienze rimaste:**

- CHANGE-IMPACT (~14 KB) è una tabella con molto riempimento: va letto con `grep` per riga, come indicato nel router.
- AGENTS.md (3,3 KB) è sopra l'obiettivo indicativo di PID-01 (300–600 token), ma ogni riga è una regola vincolante del proprietario. Non è stato ridotto.

## 8. Debito tecnico trovato (non corretto: fuori dal perimetro documentale)

Ogni voce è VERIFICATA nel codice, salvo dove indicato.

1. L'esportazione JSON non include `companies` né `saved_views` (`apps/api/src/services/export.ts`). È documentato come limite.
2. `scripts/seed-demo.mjs` su un database dove l'app ha già creato l'utente dev: l'inserimento in `workspace_members` dovrebbe fallire per FK (DEDOTTO, non riprodotto). Mitigazione documentata: reset prima del seed.
3. Il seed demo contiene dati reali del proprietario: è una scelta esplicita, ma incompatibile con il vincolo «nessun dato reale come seed» del [CORE §5](../product/CORE.md#5-vincoli-permanenti). Decisione del proprietario.
4. `apps/api/wrangler.jsonc`: commento con una frase troncata («…in locale). prima di un deploy.») e rimando a `check:config`, che non esiste più.
5. `apps/web/playwright.config.ts:10`: il commento cita le porte 5173/8787; Vite usa 5174.
6. `.nvmrc` = `22` mentre `engines.node` = `>=22.22.0`.
7. CI: inattiva su `jobward-v1`; il job e2e compila il web due volte.
8. Immutabilità degli snapshot e sequenze delle candidature garantite solo dai servizi: nessun trigger, a differenza del piano SW.10-b.
9. Stato degli ADR 0011, 0013 e 0016: l'indice ([decisions/README](../architecture/decisions/README.md)) e l'intestazione dei file divergono. L'indice è più aggiornato; gli ADR non si riscrivono, quindi si conserva il conflitto.

## 9. Pendenze sui file di un'altra sessione

Non modificati perché avevano modifiche non committate di un'altra sessione al momento dell'audit. Da applicare quando quel lavoro sarà committato:

- `docs/development/TESTING.md`: conteggi (HEAD: 27 file / 22 spec / axe 15 su 19).
- `docs/features/OPPORTUNITIES.md`:
  - «un'opportunità appartiene sempre a una bacheca» (falso: esiste l'Inbox);
  - mancano inserimento guidato, schede Tutte/Inbox/Candidature e viste salvate;
  - A-01, B-01, B-04 e B-05 sono ancora elencati come gap.
- `docs/features/ANALYTICS.md`: precisare che è il client, non il server, a validare la risposta della Overview.
- `docs/agents/CURRENT-CONTEXT.md`: nessuna modifica necessaria da PID-01.
- `docs/ux/design-system.md`: non verificato in questo audit.

## 10. Proposte (non implementate)

1. **Controllo automatico della documentazione** (`scripts/check-docs.mjs` + `pnpm docs:check`). Controllerebbe:
   - collegamenti relativi rotti;
   - percorsi citati inesistenti nei documenti canonici senza avviso;
   - dimensione di AGENTS + ROUTER sotto una soglia.

   Costo: uno script senza dipendenze e una voce in `package.json`. Richiede l'autorizzazione a modificare configurazione e script.

2. **Riallineare GAP-ANALYSIS, DOMAIN-GLOSSARY e USER-JOURNEYS** a v1.1: è una revisione di prodotto, non un audit, e va fatta con il proprietario.
3. **Separare i report SW.10** da `docs/roadmap/` (per esempio in `docs/sw/`) quando non ci saranno più rami aperti che li modificano.
4. **Riscrivere `architecture/overview.md`**, oggi ⚠ e con descrizioni di M0, come panoramica breve che rimanda a BACKEND, FRONTEND e CHANGE-IMPACT.

## 11. Validazione

| Controllo                                             | Comando / metodo                                                                                      | Esito                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Formattazione dei Markdown toccati                    | `pnpm exec prettier --check <file toccati>`                                                           | ✅ tutti conformi                                                         |
| Collegamenti e percorsi                               | script di misura (§7)                                                                                 | ✅ 0 collegamenti rotti; 0 percorsi obsoleti senza avviso                 |
| Percorsi citati in CHANGE-IMPACT e nella guida utente | `git cat-file -e HEAD:<path>` su 16 test e spec; `grep` delle etichette dell'interfaccia nel sorgente | ✅ tutti esistenti                                                        |
| Codice, dipendenze, configurazione, migrazioni        | nessuna modifica                                                                                      | ✅ `git status`: solo file in `docs/` e `README.md` attribuibili a PID-01 |
| Suite di test                                         | **NON ESEGUITE**: compito solo documentale, e un altro lavoro era in corso nello stesso worktree      | NON VERIFICATO                                                            |
| Guida utente sull'app avviata                         | **NON ESEGUITA** (nessuna schermata; etichette verificate solo nel sorgente)                          | NON VERIFICATO                                                            |

## 12. Modifiche

- **Nuovi:**
  - `docs/user/README.md`, `docs/user/USER-GUIDE.md`, `docs/user/TROUBLESHOOTING.md`;
  - `docs/architecture/CHANGE-IMPACT.md`;
  - `docs/status/PID-01-REPORT.md`.
- **Modificati:**
  - `README.md`, `docs/INDEX.md`, `docs/history/README.md`, `docs/product/CORE.md`;
  - `docs/agents/{CONTEXT-ROUTER,WORKFLOW,MEMORY-SYSTEM,TOKEN-EFFICIENCY}.md`;
  - `docs/architecture/{BACKEND,FRONTEND,DATA-MODEL,REPOSITORY-MAP,SECURITY,database,smart-query-engine}.md`;
  - `docs/development/{GETTING-STARTED,CONTRIBUTING}.md`;
  - `docs/features/{INDEX,APPLICATIONS,BOARDS,SMART-VIEWS,WORKFLOWS}.md`;
  - `docs/status/{FEATURE-MATRIX,GAP-ANALYSIS}.md`;
  - `docs/product/{DOMAIN-GLOSSARY,USER-JOURNEYS}.md`;
  - `docs/roadmap/{milestones,m4-private-release-plan,smart-workspace}.md`.
- **Spostati o eliminati:** nessuno.
- **Fuori dalla repository:** memoria personale di Claude Code consolidata (§6.3).
- **Git:** solo commit locali sul ramo `jobward-v1`, con i soli percorsi elencati. Nessun push, merge, rebase o deploy.
