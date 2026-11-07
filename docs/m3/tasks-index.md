# Attività, follow-up e scadenze — Pacchetto di progettazione (M3-T0)

**Stato:** **proposta per approvazione. Nessuna implementazione**: nessuna migrazione, nessun endpoint, nessuna modifica alla UI Attività.
**Baseline:** `origin/main` = `5a0d056eda` · **Branch:** `m3-c3-closure-tasks-design` · **Data:** 2026-11-07.

Obiettivo: trasformare Jobward da strumento di tracciamento a **workspace operativo** — «cosa devo fare, entro quando, per quale candidatura» —
senza notifiche, scheduler, automatismi opachi, integrazioni esterne o funzioni simulate.

## Documenti

| Documento                                                | Contenuto                                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [m3-t1-readiness.md](m3-t1-readiness.md)                 | Esito CI della PR #8, protezione di `main` (proposta), verifica D1 (comandi), approvazioni, incompatibilità, condizioni per T1 |
| [c3-closure.md](c3-closure.md)                           | **Parte A** — esito della CI remota di M3-C3 (rossa), causa, correzione, stato di chiusura                                     |
| [tasks-audit.md](tasks-audit.md)                         | Cosa esiste davvero (tabella `tasks`, contatori, eventi) e cosa no                                                             |
| [tasks-product-spec.md](tasks-product-spec.md)           | Modello, stati, scadenze, rapporto con le candidature, follow-up, suggerimenti, pagina, limiti                                 |
| [tasks-architecture.md](tasks-architecture.md)           | Dominio puro, schema D1/Drizzle, migrazione additiva, concorrenza, eventi/Timeline, impatto sui moduli                         |
| [tasks-api-contracts.md](tasks-api-contracts.md)         | Endpoint REST, input Zod, errori, idempotenza, paginazione, ordinamento                                                        |
| [tasks-ux-spec.md](tasks-ux-spec.md)                     | Pagina, riga, modulo, responsive 320–1920, accessibilità, terminologia                                                         |
| [tasks-testing-plan.md](tasks-testing-plan.md)           | Dominio, database, API, UI, E2E, accessibilità, gate per checkpoint                                                            |
| [tasks-decision-register.md](tasks-decision-register.md) | Matrice delle 12 decisioni richieste + 2 (alternative, rischi, scelta, impatto, reversibilità)                                 |
| [tasks-roadmap.md](tasks-roadmap.md)                     | Checkpoint M3-T0…T3, rapporto con C4/C5, prerequisiti, rischi, readiness per T1                                                |

## In breve

| Tema          | Proposta                                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Entità        | **Una** Task con `kind` (`general`/`follow_up`/`preparation`); **si riusa la tabella `tasks` già esistente** (vuota, mai scritta)     |
| Stato         | `open`/`done`/`cancelled` **derivato** dai timestamp; «in ritardo» è una **condizione derivata**, mai uno stato                       |
| Scadenza      | **Data di calendario** (`due_on`), nel fuso del workspace; nessun orario                                                              |
| Candidatura   | collegamento facoltativo; archiviata → task in sola lettura **ed escluse** dalla vista operativa (reversibile); chiusa → task restano |
| Cancellazione | **nessuna cancellazione definitiva**: si annulla                                                                                      |
| Timeline      | voci **derivate dalle righe** (come le note); **nessun nuovo tipo in `activity_events`** (nessuna terza ricostruzione)                |
| Migrazione    | **`0006` solo `ADD COLUMN`** con CHECK cross-colonna (esperimento verificato), nessuna ricostruzione né trigger                       |
| API           | `/api/v1/tasks` top-level; cursore; ID del client + fingerprint; compare-and-swap su `updatedAt`; nessun nuovo codice d'errore        |
| Suggerimenti  | calcolati da dati reali, **mai creano**; «Non ora» per dispositivo                                                                    |
| Roadmap       | T0 → T1 → T2 → T3 → **C4 → C5** (il «T4» proposto coincide con C4+C5)                                                                 |

## Vincoli rispettati in questo checkpoint

Nessuna implementazione di Attività · nessuna migrazione operativa · nessun endpoint Task · nessuna modifica alla UI Attività · nessun dato remoto toccato ·
nessun deploy · nessun merge · **nessun push né PR** · nessuna dipendenza nuova · nessuna AI, scheduler, notifica o integrazione · nessun test disabilitato.
L'unica modifica al codice è la correzione, motivata e provata, di un test E2E preview ([c3-closure.md](c3-closure.md)).

## Raccomandazione di readiness per M3-T1

**Pronta con riserva** (aggiornata dopo l'approvazione del 2026-11-07 e la PR #8 verde). Prima di scrivere la migrazione `0006`: integrare la PR #8 con run di `main` verde, e verificare il D1 remoto
(o confermare che non esiste). Condizioni, comandi e stato: [m3-t1-readiness.md](m3-t1-readiness.md).
