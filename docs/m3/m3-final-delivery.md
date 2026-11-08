# M3 — Consegna finale: Attività, follow-up e scadenze

**Stato corrente (2026-11-08): M3 CODE COMPLETE.** PR #10 integrata con squash su `main` `9a48f0b`; [CI post-merge 42526187028](https://github.com/lonelyfrank/jobward/actions/runs/42526187028) **completed / success: 2/2 job e 13/13 gate verdi**. Evidenze e SHA completi nel [report di stabilizzazione](stabilization/final-report.md).

**RELEASE READY: no.** D1 remoto e Cloudflare Access non verificati in questa chiusura; nessun deploy staging né smoke test reale eseguito. Migrazioni `0000`–`0007` esclusivamente locali. Restano aperti i rischi P2/P3 e i due advisory moderati della toolchain dev; nessuna risoluzione dichiarata senza prove. Esito corrente nel [report di stabilizzazione](stabilization/final-report.md) e nel [quality gate](stabilization/quality-gate.md). Le sezioni datate 2026-11-07 sotto sono la consegna storica.

**Aggiornamento 2026-11-08:** questa è la consegna storica delle Attività. Lo stato corrente di M3, integrata alla baseline `fa20c06` e in stabilizzazione, è nel [report finale di audit](stabilization/final-report.md); la chiusura formale resta subordinata alla CI remota e all'integrazione autorizzata.

**Data:** 2026-11-07 · **Branch:** `m3-tasks-followups` (da `origin/main` = `7bf462e`, CI verde) · **Stato:** implementato e verificato **in locale**; **non pubblicato** (nessun push, PR, merge né deploy).
Questa consegna realizza la progettazione approvata in [tasks-index.md](tasks-index.md) (decisioni D-01, D-03, D-05, D-06, D-13 e Overview retrocompatibile). Non introduce nuovi checkpoint.

> **Chiusura formale di M3:** soltanto dopo la **CI remota verde** del branch e l'**integrazione della PR finale**. Fino ad allora M3 è _completa funzionalmente_, non chiusa.

## 1. Funzionalità completate

| Area                                        | Esito                                                                                                                                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Attività generiche, follow-up, preparazione | ✅ una sola entità Task con `kind`; titolo, descrizione, priorità, scadenza come **data di calendario**, collegamento facoltativo a una candidatura                                                     |
| Stati                                       | ✅ `open` / `done` / `cancelled` **derivati** dai timestamp; «in ritardo» è una condizione derivata (mai salvata)                                                                                       |
| Pagina **Attività** (`/tasks`)              | ✅ riepilogo reale (Da fare · Oggi · In ritardo), filtri nell'indirizzo, sezioni derivate, creazione rapida, dialog di creazione/modifica, completa/riapri/annulla, stati vuoti, errori, «Carica altre» |
| Integrazione con la candidatura             | ✅ sezione «Attività» nella Panoramica (scadenze evidenziate, «Aggiungi attività», «Pianifica un follow-up»), link riga → candidatura, voci derivate nella Timeline, avviso (non azione) alla chiusura  |
| Suggerimenti contestuali                    | ✅ S1 follow-up dopo l'invio · S2 preparazione di un colloquio entro 7 giorni · S3 follow-up dopo un colloquio; **deterministici, mai creano nulla**; «Non ora» per dispositivo                         |
| Overview                                    | ✅ retrocompatibile: stessi campi e tipi, `dueAt` resta un intero, `dueOn` + `dueTodayTasks` + `noDueTasks` additivi; «Prossime scadenze» a data di calendario                                          |
| Archiviazione / ripristino                  | ✅ le task di una candidatura archiviata restano invariate, sono **in sola lettura ed escluse** da elenco e contatori; il ripristino le riporta tali e quali                                            |
| Chiusura della candidatura                  | ✅ non completa né annulla le task                                                                                                                                                                      |
| Nessuna cancellazione definitiva            | ✅ si annulla (reversibile)                                                                                                                                                                             |

Esplicitamente **non** realizzati (fuori perimetro, [scope-policy](../roadmap/scope-policy.md)): AI, notifiche, e-mail/calendari, scheduler, promemoria, funzioni per aziende/recruiter, cancellazione definitiva.

## 2. Architettura implementata

- **Dominio puro** (`packages/shared`): `tasks.ts` (date di calendario, `localDate` con `Intl`, `startOfLocalDay`, `classifyDue`, `compareTasks`, `summarizeTasks`, `completedLate`), `task-suggestions.ts` (S1–S3), `timeline.ts` (`taskTimelineEntries`). Nessun I/O; «oggi» è sempre un argomento.
- **Contratti** (`packages/schemas/src/task.ts`): input stretti (`.strict()`), ID del client di 16–48 caratteri, `expectedUpdatedAt` obbligatorio nelle modifiche, stato non scrivibile, data di calendario validata.
- **API** (`apps/api/src/services/tasks.ts`, `modules/tasks/routes.ts`): `POST/GET /tasks`, `GET /tasks/summary`, `GET/PATCH /tasks/:id`, `POST /tasks/:id/complete|reopen|cancel`. Perimetro `?workspaceId=` + `workspaceScope`; nessun nuovo `ApiErrorCode`; **nessun DELETE**. Il riepilogo è un servizio **condiviso** con `GET /overview`.
- **Frontend** (`apps/web/src/features/tasks`): hook a cursore, riga a griglia con una sola copia del DOM, `TaskDialog` (un componente per creare e modificare), `CardTasksSection`, `suggestion-storage`. Cache qualificate dal workspace; una mutazione invalida elenchi, riepilogo, Overview e Timeline delle sole card coinvolte.
- **Timeline**: terza fonte `task` **derivata dalle righe** (creata/completata/annullata), senza scrivere in `activity_events` (D-06).

### Scostamenti dalla progettazione (dichiarati)

| #   | Progettato                                                       | Realizzato                                                                         | Motivo                                                                                                         |
| --- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| S-1 | `date(due_on) = due_on` nel CHECK                                | **`date(due_on) IS due_on`**                                                       | difetto **trovato dalla prova di upgrade**: per `2026-13-01` `date()` dà NULL e un CHECK che vale NULL _passa_ |
| S-2 | `tasks_card_idx` sostituito da `(workspace_id, card_id, due_on)` | **`tasks_card_idx (card_id)` conservato**                                          | nessun beneficio misurabile; meno modifiche allo schema                                                        |
| S-3 | «Oggi» come terzo filtro-pulsante                                | **indicatore statico**                                                             | l'API non ha una vista «oggi»: un pulsante finto sarebbe fuorviante                                            |
| S-4 | suggerimento «registrare un feedback» fra i suggerimenti         | coperto dalla **«Prossima azione» dei colloqui** già esistente (`record_feedback`) | non è una Task: duplicarlo creerebbe due promemoria per la stessa cosa                                         |
| S-5 | `quickActions.prepare_followup` ripensata                        | **invariata**: non è collegata ad alcuna interfaccia                               | la Panoramica ha già «Pianifica un follow-up» e il suggerimento                                                |
| S-6 | Dialog `center` o `workspace` da scegliere                       | **`center`**                                                                       | verificato a 320 px (nessun overflow, axe pulito)                                                              |

## 3. Migrazione e conservazione dei dati

`packages/database/migrations/0006_m3_tasks.sql`: **solo `ADD COLUMN`** con CHECK di colonna (anche cross-colonna) e due indici parziali; nessun `DROP TABLE`, nessun `PRAGMA`, nessun trigger, nessuna copia di righe. Le migrazioni `0000`–`0005` non sono modificate.

| Prova (`pnpm db:upgrade-test`, D1 locale/workerd, database 0005 **popolato**)                                                                                                               | Esito |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Ogni riga di ogni tabella preesistente identica (task legacy comprese: `due_at` conservato)                                                                                                 | ✅    |
| Altri oggetti dello schema (tabelle, indici, trigger) identici; FK di `tasks` invariate; `foreign_key_check` pulito                                                                         | ✅    |
| 15 violazioni di prova rifiutate dal motore (titolo, descrizione, `kind`, priorità, date impossibili/con orario, doppio timestamp, fingerprint, card altrui/inesistente, UPDATE incoerenti) | ✅    |
| Cascata alla cancellazione di card e di workspace; nessun riferimento pendente                                                                                                              | ✅    |
| **Rollback**: una riga legacy che viola un vincolo interrompe la migrazione **senza schema parziale** né perdita di dati                                                                    | ✅    |

**Non verificato:** il **D1 remoto**. Nell'account raggiungibile con il login di wrangler non esiste alcun database D1 (`d1 list` → `[]`) e `database_id` nel repo è un segnaposto: la migrazione non è stata applicata né provata su un motore remoto. Comandi di verifica in sola lettura: [m3-t1-readiness.md](m3-t1-readiness.md) §3.3. **Prima di qualunque applicazione remota: backup/Time Travel.**

## 4. API e contratti

Descritti in [tasks-api-contracts.md](tasks-api-contracts.md). Punti verificati dai test: 201/200 (replay)/409 (payload diverso) sulla creazione; comandi idempotenti per stato (timestamp non ritoccati); `updatedAt` strettamente monotono; compare-and-swap con un solo vincitore fra due `PATCH` concorrenti; cursore stabile con modifiche fra le pagine; esclusione derivata delle card archiviate; tetti **atomici** (500 aperte / 5.000 totali) anche con richieste concorrenti; 404 identico per workspace altrui e risorsa inesistente; `viewer` in sola lettura (403).

## 5. Risultati dei test

Il segnaposto della consegna originale non conteneva evidenze. Per i risultati effettivamente eseguiti e attribuiti alla rispettiva revisione, consultare il [quality gate di stabilizzazione](stabilization/quality-gate.md), inclusa la sezione «Gate della baseline finale integrata».

## 6. Problemi residui

Registro: [m3-final-issue-register.md](m3-final-issue-register.md).

## 7. Limitazioni note

1. **D1 remoto non verificato** (vedi §3); versione di SQLite di D1 non interrogabile (`sqlite_version()` vietata).
2. **Timeline ≠ registro d'audit** (D-06): riaprire una task fa sparire la voce «completata»/«annullata»; le modifiche di titolo, scadenza e priorità non lasciano traccia.
3. «Non ora» è **per dispositivo** (`localStorage`); S2/S3 usano «task creata dopo il colloquio» come proxy del legame task↔colloquio.
4. **Nessuna cancellazione definitiva**: le annullate restano (tetto totale 5.000, filtro «Annullate»).
5. Una pagina lasciata aperta oltre la mezzanotte mostra la classificazione di «ieri» finché non si riallinea (refetch al ritorno sulla scheda); le scritture non dipendono dall'orologio del browser.
6. Sopra le 50 attività per candidatura la sezione mostra le prime 50 e i suggerimenti si disattivano (non si può escludere che esista già un follow-up).
7. Il fuso del workspace non è modificabile oggi; le scadenze sono giorni di calendario e non ne risentirebbero.
8. La colonna legacy `tasks.due_at` resta non usata (nessuna ricostruzione per rimuoverla).
9. Verifiche automatiche **solo Chromium**; tastiera virtuale, screen reader reali, Firefox/WebKit e dispositivi reali **non** verificati.
10. Il test del passaggio di mezzanotte è coperto dai test del dominio puro (fusi, DST, confini) e dai test API con un fuso diverso da UTC, **non** da un E2E con orologio simulato (il «oggi» lo decide il server).

## 8. Stato delle CI

| Verifica                                                  | Esito                                                 |
| --------------------------------------------------------- | ----------------------------------------------------- |
| CI di `main` sul commit base `7bf462e`                    | ✅ **verde** (run 42363749545)                        |
| CI remota del branch `m3-tasks-followups`                 | ⏳ **non eseguita**: il branch non è stato pubblicato |
| Verifica locale (worktree pulito, solo commit del branch) | v. §5                                                 |

## 9. Readiness per M4

**Pronta con riserve**, per l'avvio di M4 — _Insights & Private Release_ ([scope-policy](../roadmap/scope-policy.md)):

1. integrare il branch con **CI remota verde** (chiusura formale di M3);
2. verificare il **D1 remoto** (o confermare che non esiste) e provare `0006` su un motore remoto/usa-e-getta prima del deploy privato;
3. decidere sul **ruleset di `main`** ([m3-t1-readiness.md](m3-t1-readiness.md) §2) e sull'eventuale **audit eventi** (D-06) se serviranno gli insights storici;
4. **fuori da M3 e da decidere in M4**: purga/export dei dati, sincronizzazione del «Non ora» fra dispositivi.

I dati per gli Insights di M4 esistono già in forma derivabile: stati e timestamp delle task, `completedLate`, conteggi e riepilogo (`summarizeTasks` come oracolo).
