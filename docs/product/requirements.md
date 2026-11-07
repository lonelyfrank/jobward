# Requisiti

Legenda stato: ✅ M0 · ⏳ milestone futura (indicata).

## Funzionali

| ID   | Requisito                                                                                                    | Milestone | Stato                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------ | --------- | -------------------------------------------------------------- |
| F-01 | Il proprietario accede in modo privato; gli altri sono esclusi                                               | M0        | ✅                                                             |
| F-02 | Creazione del workspace al primo accesso (nome, fuso orario)                                                 | M0        | ✅                                                             |
| F-03 | Overview con riepilogo derivato dai dati reali e stati vuoti utili                                           | M0        | ✅ (dati a zero finché non esistono schede)                    |
| F-04 | Tema chiaro/scuro/sistema, sidebar comprimibile, navigazione responsive                                      | M0        | ✅                                                             |
| F-05 | Bacheche: CRUD, preferite, ordinamento, ricerca                                                              | M1        | ⏳                                                             |
| F-06 | Colonne: crea, rinomina, riordina; eliminazione solo se vuote                                                | M1        | ⏳                                                             |
| F-07 | Schede: creazione col solo titolo, modifica, archiviazione recuperabile                                      | M1        | ⏳                                                             |
| F-08 | Kanban con drag & drop (aggiornamento ottimistico + rollback) e alternativa da tastiera/menu                 | M1        | ⏳                                                             |
| F-09 | Pannello di dettaglio scheda (Overview, Notes, History…) senza perdere il contesto                           | M1        | ⏳                                                             |
| F-10 | Onboarding completo: template (Job Search Standard / Minimal / Custom), prima opportunità                    | M1        | ⏳ (template già definiti come dati)                           |
| F-11 | Informazioni strutturate dell'opportunità (azienda, sede, contratto, retribuzione, fonte, date, fase, esito) | M2        | ⏳                                                             |
| F-12 | Campi personalizzati (8 tipi) con validazione per tipo                                                       | M2        | ⏳ (schemi di validazione già implementati e testati)          |
| F-13 | Etichette, filtri (colonna, priorità, etichette, scadute), ricerca (titolo, azienda, descrizione)            | M2        | ⏳                                                             |
| F-14 | Vista tabella con ordinamento e filtri                                                                       | M2        | ⏳                                                             |
| F-15 | Attività con scadenza, follow-up, cronologia degli eventi                                                    | M3        | ✅ (branch `m3-tasks-followups`; Timeline derivata, non audit) |
| F-16 | Statistiche pertinenti                                                                                       | M4        | ⏳                                                             |
| F-17 | Esportazione dei dati dell'utente                                                                            | M4        | ⏳                                                             |
| F-18 | Registrazione pubblica, quote, cancellazione account                                                         | M5        | ⏳                                                             |

## Regole di business

| Regola                 | Dettaglio                                                               |
| ---------------------- | ----------------------------------------------------------------------- |
| Creazione scheda       | Solo il titolo è obbligatorio                                           |
| Spostamento            | Aggiorna colonna e posizione in modo consistente (batch transazionale)  |
| Eliminazione           | Schede: archiviazione recuperabile. Colonne con schede: non eliminabili |
| Priorità               | Nessuna · Bassa · Media · Alta · Urgente                                |
| Scadenze               | Istante UTC, mostrato nel fuso del workspace                            |
| Ricerca                | Almeno titolo, azienda, descrizione                                     |
| Fase ≠ colonna ≠ esito | Tre concetti indipendenti                                               |
| Storico                | Solo eventi significativi; mai ogni battitura né informazioni riservate |
| Limite MVP             | Un workspace per utente (applicato atomicamente dal server)             |

## Non funzionali

| ID   | Requisito                                                                      | Come si verifica                                                         |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| N-01 | Isolamento dei dati per workspace; ownership verificata lato server            | Test di integrazione `ownership.test.ts`                                 |
| N-02 | Nessun segreto nel repo né nel frontend                                        | Revisione + configurazione fail-closed                                   |
| N-03 | Validazione server-side di ogni input; payload ≤ 64 KiB; errori standardizzati | Test API                                                                 |
| N-04 | WCAG 2.2 AA come obiettivo                                                     | axe in E2E (chiaro/scuro) + contrasto calcolato + verifica manuale in M4 |
| N-05 | Desktop-first, pienamente usabile su smartphone; target touch ≥ 44 px          | E2E mobile                                                               |
| N-06 | Dark e light mode con token semantici                                          | Test + ispezione visiva                                                  |
| N-07 | Privacy/GDPR in progettazione (esportazione, cancellazione, backup)            | Documentato; implementazione M4/M5                                       |
| N-08 | Quality gate: typecheck, lint, build, unit, integrazione, E2E                  | `pnpm check` + `pnpm test:e2e` + CI                                      |

## Fuori ambito (vincoli)

Integrazioni o import Trello, scraping, connessione obbligatoria a LinkedIn, invio automatico di candidature,
funzioni AI premature, pagamenti/abbonamenti, dashboard per recruiter, marketplace di annunci, funzioni social,
notifiche push, architetture a microservizi.
