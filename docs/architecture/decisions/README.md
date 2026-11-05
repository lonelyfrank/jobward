# Architecture Decision Records

Ogni decisione tecnica rilevante è registrata qui: contesto, decisione, alternative scartate, conseguenze.
Una decisione si cambia con un nuovo ADR che sostituisce il precedente, non riscrivendo la storia.

| ADR                                                    | Titolo                                                                        | Stato                          |
| ------------------------------------------------------ | ----------------------------------------------------------------------------- | ------------------------------ |
| [0001](0001-modular-monolith-monorepo.md)              | Modular monolith in un monorepo leggero                                       | Accettato                      |
| [0002](0002-stack-and-versions.md)                     | Stack e versioni (vincoli di compatibilità)                                   | Accettato                      |
| [0003](0003-authentication-strategy.md)                | Strategia di autenticazione                                                   | Accettato                      |
| [0004](0004-data-conventions.md)                       | Convenzioni dati: ID, tempo, tenancy, posizioni                               | Accettato                      |
| [0005](0005-design-system-and-ui.md)                   | Design system e componenti UI                                                 | Accettato                      |
| [0006](0006-testing-strategy.md)                       | Strategia di test e quality gate                                              | Accettato (aggiornato in M0.H) |
| [0007](0007-database-tenant-isolation.md)              | Isolamento tra workspace garantito dal database                               | Accettato                      |
| [0008](0008-kanban-ordering-and-board-loading.md)      | Kanban: ordinamento su D1, caricamento, libreria di trascinamento             | Accettato                      |
| [0009](0009-application-lifecycle-and-statistics.md)   | Ciclo della candidatura: colonna ≠ fase ≠ esito, patch per campo, statistiche | Accettato                      |
| [0010](0010-custom-fields-conservative-model.md)       | Campi personalizzati: modello conservativo                                    | Accettato                      |
| [0011](0011-search-and-table-state.md)                 | Ricerca server-side, SQL `LIKE` e stato della tabella nell'indirizzo          | Accettato                      |
| [0012](0012-interview-tracking-and-workspace-modal.md) | Tracciamento dei colloqui e modale della candidatura                          | Accettato                      |
| [0013](0013-rebranding-jobward.md)                     | Rebranding a Jobward e identificatori persistenti                             | Accettato                      |

- [ADR-0014 — Rebranding tecnico Jobward e compatibilità dei dati](0014-jobward-technical-rebranding.md): supera D6, separa rename locale e migrazione remota.
