# M4 — Insights & Private Release

**Stato corrente (2026-11-08): M3 CODE COMPLETE.** PR #10 integrata con squash su `main` `9a48f0b`; [CI post-merge 42526187028](https://github.com/lonelyfrank/jobward/actions/runs/42526187028) **completed / success: 2/2 job e 13/13 gate verdi**. Evidenze e SHA completi nel [report di stabilizzazione](../m3/stabilization/final-report.md).

Piano di handoff aggiornato il 2026-11-08; nessuna attività M4/M5 avviata. **RELEASE READY: no.** D1 remoto e Cloudflare Access non verificati in questa chiusura; nessun deploy staging né smoke test reale eseguito. Migrazioni `0000`–`0007` esclusivamente locali. Restano aperti i rischi P2/P3 e i due advisory moderati della toolchain dev; nessuna risoluzione dichiarata senza prove.

## Governance di integrazione e rilascio

Aggiornamento 2026-11-09: baseline `main` `445d329626b4a900b2cca9cb4a19e09d9c33ec36` (PR #11 integrata), [CI post-merge 42529027562, tentativo 2](https://github.com/lonelyfrank/jobward/actions/runs/42529027562/attempts/2) verde. [Ruleset jobward-main-protection / 26818495](https://github.com/lonelyfrank/jobward/rules/26818495) attivo soltanto su `main`; [audit, configurazione effettiva e limiti](../m3/m3-t1-readiness.md#2-protezione-di-main--verifica-2026-11-09). Questo completa la configurazione della protezione, senza avviare M4 né cambiare lo stato di rilascio M3.

### Flusso ordinario

1. Aggiornare i riferimenti con `git fetch origin` e creare un branch dedicato da `origin/main` aggiornato.
2. Preparare commit circoscritti e aprire una PR ordinaria verso `main`; nessun push diretto su `main`.
3. Attendere sulla revisione corrente entrambi i required checks GitHub Actions: `Typecheck · Lint · Test · Build` e `E2E (Playwright)`; il secondo include la preview e richiede quality verde.
4. Verificare la base aggiornata e risolvere tutte le conversazioni. Se `main` avanza, aggiornare il branch da `origin/main` e attendere di nuovo la CI; nessun force push. Le approvazioni obbligatorie sono zero: il maintainer può integrare le proprie PR.
5. Riesaminare il diff e integrare manualmente con squash, oppure rebase se opportuno; la history lineare esclude i merge commit su `main`. Auto-merge e merge queue non sono abilitati.
6. Verificare entrambi i job nella CI `push` di `main` sullo SHA risultante. Un merge riuscito non equivale a una CI post-merge verificata; registrare URL, SHA, tentativo ed esito.
7. Eliminare il branch di lavoro dopo l'integrazione quando non serve più; la cancellazione automatica resta disattivata.

Se una run fallisce o viene annullata, leggere log/artefatti e verificare il commit corrente. Un rilancio mirato è ammesso dopo diagnosi e va tracciato; non indebolire i gate. M3S-15 può bloccare l'integrazione e resta nel registro rischi fino a prova specifica.

### Hotfix

Creare `hotfix/<descrizione>` da `origin/main` aggiornato, limitare il diff alla correzione o al revert necessario, aprire PR e seguire gli stessi due check, risoluzione conversazioni, aggiornamento base, merge manuale e CI post-merge. Zero approvazioni evita dipendenze da reviewer esterni. Anche un revert passa da PR.

Non è configurato un bypass di emergenza e il percorso hotfix non richiede push diretto. Se un incidente rendesse indispensabile cambiare le regole, occorre una decisione amministrativa separata e tracciata: motivazione, regole/ID coinvolti, durata, operatore, evidenze e verifica del ripristino. Nessuna disattivazione è autorizzata da questa procedura; un fallimento CI o un flake non giustifica da solo un'eccezione.

### Significato degli stati di rilascio

| Stato             | Evidenza richiesta                                                                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CODE COMPLETE     | Scope applicativo/documentale integrato e verifiche della baseline registrate. È lo stato attuale di M3.                                                                                |
| RELEASE CANDIDATE | Candidato identificato da SHA e perimetro congelato, con piano di validazione e rischi espliciti; non equivale a un rilascio pronto.                                                    |
| RELEASE READY     | Gate di rilascio completati con prove: sicurezza/accessibilità e browser/device previsti, D1 remoto, Access fail closed, staging/smoke, backup e ripristino secondo il piano approvato. |
| RELEASED          | Versione effettivamente distribuita nell'ambiente autorizzato, con SHA/versione, data e verifiche post-deploy registrate.                                                               |

**M3 resta CODE COMPLETE; RELEASE READY: no.** La protezione GitHub permette il successivo lavoro M4 tramite PR, ma non chiude M3S-15, copertura browser/device, D1 remoto, Access o staging e non autorizza deploy, migrazioni remote, secrets o implementazioni M4/M5.

## Checkpoint M4

| Checkpoint                                     | Obiettivo e deliverable                                                                                                                                                | Criteri di uscita                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M4-C1 — Analytics & Insights                   | Definire metriche e periodi con dominio condiviso; distinguere opportunità, inviate, fase, esito e posizione Kanban. Specifica e contratto prima dell'implementazione. | Numeri riconciliabili con fixture e dataset controllati, filtro workspace, fuso orario e stati vuoti; nessun dato inventato.     |
| M4-C2 — Esportazione e portabilità             | Formato documentato per dati del proprietario, riferimenti e task; distinguere export da backup/ripristino.                                                            | Export verificato su dati rappresentativi, assenza di dati di altri workspace e round-trip definito dove previsto.               |
| M4-C3 — Sicurezza, accessibilità, affidabilità | Risolvere rischi del registro, advisory della toolchain compatibili, verifiche browser/assistive e backup.                                                             | Checklist basata su prove, limiti residui espliciti; nessuna dichiarazione su browser/device non testati.                        |
| M4-C4 — Deploy privato Cloudflare              | Configurare Access proprietario, origine, binding D1, secrets e procedure operative.                                                                                   | Autorizzazione esplicita prima di deploy/migrazioni; backup e prova su copia; Access reale fail closed e smoke test post-deploy. |
| M4-C5 — Test personale e beta privata          | Eseguire scenari personali reali e raccogliere problemi in un registro prioritizzato.                                                                                  | Criteri di ingresso/uscita e ripristino documentati, affidabilità verificata nel tempo, nessuna perdita dati.                    |

## Handoff preciso a M4-C1

1. PR #10 integrata con squash su `9a48f0b`; CI post-merge 42526187028 verde: M3 CODE COMPLETE. Handoff disponibile per la successiva pianificazione M4, senza avvio dell’implementazione.
2. Partire da `shared` per la semantica candidatura e da `overview.ts`/`tasks.ts` per conteggi e fuso del workspace; leggere ADR sul ciclo candidatura e separazione colonna/fase/esito.
3. Specificare intervalli temporali, date mancanti, archiviate, chiusure/riaperture e popolazione inclusa in ogni metrica. Confermare prodotto e privacy prima di cambiare contratti.
4. Preparare fixture multi-workspace solo nei test; nessuna abilitazione della multiutenza del prodotto.
5. Conservare i gate di ricerca, Tasks, timeline, zoom, background e scope Glass durante lo sviluppo Insights.

M5 rimane la fase finale di preparazione alla pubblicazione. La multiutenza limitata a un gruppo di amici può essere valutata come requisito esplicito della beta privata; non è implicita in M4 e non viene realizzata ora. Restano esclusi AI, scheduler, notifiche, automazioni e integrazioni non approvate.

## Backlog tecnico da pianificare, senza implementazione

Questi gruppi si collegano ai checkpoint esistenti; non autorizzano nuove funzionalità e non modificano la [scope policy](scope-policy.md).

| Gruppo                          | Attività futura                                                    | Evidenza di completamento                                             |
| ------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------- |
| 1. UX e responsive mobile-first | Rifinire layout e interazioni da 320 px, touch, tastiera e focus   | Flussi reali e matrice responsive/accessibilità senza regressioni     |
| 2. Query D1 e ricerca globale   | Misurare piani, latenza, paginazione e filtri prima di ottimizzare | Benchmark su dataset rappresentativi e isolamento workspace invariato |
| 3. Rendering delle bacheche     | Profilare Kanban, zoom, sfondi e aggiornamenti                     | Misure prima/dopo, persistenza e navigazione preservate               |
| 4. Componenti grandi            | Estrarre responsabilità progressivamente dove necessario           | PR piccole con contratti e test comportamentali invariati             |
| 5. CI e test database           | Misurare costi e isolare fixture senza indebolire i gate           | Tempi documentati, upgrade/rollback equivalenti, nessun nuovo skip    |
| 6. Gestione degli errori        | Coerenza degli stati errore, retry espliciti e recupero            | Prove di errore e ripristino, nessuna perdita di input o dati         |
| 7. Primo staging                | Piano approvato per Access/auth, D1, backup e deploy               | Access fail closed, D1 verificato, staging e smoke reali verdi        |
| 8. Device e browser aggiuntivi  | Firefox/WebKit, dispositivi fisici e screen reader                 | Matrice reale con risultati e limiti dichiarati; M3S-14 aggiornato    |

Conservare inoltre M3S-12 (due advisory moderati dev) e M3S-15 (monitoraggio tastiera/zoom): risoluzione solo con evidenza specifica, senza quarantena. Esclusi AI, notifiche, scheduler, automazioni e integrazioni esterne non approvate. Nessuna rinomina della risorsa D1 legacy `meet-roulette` senza piano di migrazione approvato.
