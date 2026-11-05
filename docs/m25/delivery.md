# M2.5 — Relazione di consegna

**Branch:** `m25-smart-application-modal` (da `m2-information-customization` @ `6864d7a`) · **Data:** 2026-11-05
**Stato:** pronta per revisione. **Nessun merge, nessun deploy, nessun push, nessuna PR creata per M2.5.** La decisione finale è del proprietario della repository.

## 1. In sintesi

La scheda di una candidatura non è più un pannello laterale: è una **modale ampia e centrata** (schermo intero a telefono) con intestazione fissa, **riepilogo intelligente**, schede **Panoramica · Colloqui · Dettagli · Cronologia** e piè di pagina persistente. I colloqui sono un'**entità propria** (non campi personalizzati): si creano, modificano, riprogrammano, completano (con esito e feedback), annullano e si passa al round successivo, con numerazione stabile e storico. Le card del Kanban mostrano, in due densità, il **prossimo colloquio** e la **prossima azione**, calcolati dai soli dati registrati e con **una sola query** per bacheca.

Regola di prodotto rispettata ovunque: creare, completare o annullare un colloquio **non sposta mai** la scheda di colonna, **non cambia** fase o esito, **non altera** le statistiche. La fase cambia solo per azione esplicita dell'utente.

## 2. Dipendenza da M2

M2 non è integrata in `main` al momento della consegna: M2.5 è costruita sul branch verificato `m2-information-customization` (PR #4, **CI verde**: _Typecheck · Lint · Test · Build_ ed _E2E (Playwright)_). **M2.5 non può essere integrata prima di M2**; con M2 già in `main`, la PR di M2.5 conterrà solo i commit di §7.

## 3. Funzioni completate (verificate)

| Area        | Funzione                                                                                                                                                                                                                                                       | Verificata da                                  |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Modale      | Variante `workspace` del Dialog; Esc, focus trap e ripristino del focus; chiusura guidata dall'indirizzo; «indietro»; apertura da Kanban, Tabella e Opportunità; scheda attiva nell'hash (`#colloqui`…); conferma per modifiche non salvate; movimento ridotto | E2E (modale, guardia), preview sotto CSP       |
| Riepilogo   | Fase, prossimo colloquio, prossima azione (scaduto › feedback da registrare › da programmare), aggiornamento rapido della fase                                                                                                                                 | unit (`summarizeInterviews`), E2E              |
| Colloqui    | Stati `to_schedule/scheduled/completed/cancelled`, esito separato dallo stato, fuso orario IANA, intervistatori, feedback, riprogrammazione, round successivo, sequenza stabile, tetto 50 per scheda                                                           | 22 API, 5 schemi, 16 E2E, `db:upgrade-test`    |
| Cronologia  | 6 nuovi eventi dei colloqui, **senza copia di note o feedback riservati**                                                                                                                                                                                      | API, E2E                                       |
| Card Kanban | Densità compatta/informativa (preferenza locale), prossimo colloquio, prossima azione; DnD, menu, tastiera e tocco invariati                                                                                                                                   | E2E (kanban, interviews)                       |
| Database    | Migrazione `0004`: tabella `interviews` + ricostruzione controllata di `activity_events` con trigger di isolamento ricreati                                                                                                                                    | `db:check`, `db:upgrade-test` (DB M2 popolato) |

## 4. Test (dal commit finale, senza modificare i sorgenti durante le esecuzioni)

| Controllo                                                                                                 | Esito                                                            |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `pnpm check` (typecheck, lint, format, contrasto, config, `db:check`, **`db:upgrade-test`**, test, build) | ✅                                                               |
| Unit + integrazione                                                                                       | ✅ **472** (shared 17 · schemas 43 · web 106 · api 306); M2: 439 |
| E2E su stack reale                                                                                        | ✅ **117/117** (100 + 17 nuovi)                                  |
| Anteprima di produzione (CSP reale)                                                                       | ✅ **11/11** (10 + 1 nuovo)                                      |
| Aggiornamento di un DB popolato (601 schede, 60 archiviate)                                               | ✅ dati identici; 28 controlli, 11 nuovi per `0004`              |

Dettagli, mutation check, prestazioni e bundle: [testing-report.md](testing-report.md).

## 5. Problemi trovati e corretti

5 (M25-01…M25-05: **nessun P0, nessun P1**; 2 × P2, 3 × P3), tutti corretti o prevenuti — [issue-register.md](issue-register.md). I più rilevanti: **M25-02** `drizzle-kit` ricostruiva `activity_events` con `PRAGMA` e senza i trigger di isolamento tra workspace (migrazione riscritta a mano, con guardia sul numero di righe e trigger ricreati), **M25-01** i pannelli inattivi delle schede restavano nell'albero di accessibilità (`forceMount` di Radix non li nasconde).

## 6. Decisioni architetturali

[ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md): colloquio come entità dedicata, stato ed esito separati, riepilogo calcolato in una query, modale come sotto-rotta con scheda nell'hash. Una sola migrazione (`0004`), **additiva** salvo la ricostruzione controllata di `activity_events` (necessaria per ampliare il `CHECK` dei tipi di evento in SQLite/D1).

## 7. Commit

| Commit    | Checkpoint                                                                               |
| --------- | ---------------------------------------------------------------------------------------- |
| `8e36e1c` | **Backend**: migrazione `0004`, contratti, servizi e API dei colloqui                    |
| `f4cfe67` | **Interfaccia**: modale ampia, scheda Colloqui, card Kanban intelligenti                 |
| `c9f5875` | **E2E** dei colloqui e della modale, anteprima sotto CSP; fix pannelli inattivi nascosti |
| `d086970` | pulizia di un helper inutilizzato                                                        |
| `cba2904` | **Documentazione** (`docs/m25`, ADR-0012), test adattati                                 |
| `5fe5452` | locator della preview adattati alla modale a schede                                      |
| ultimo    | testing-report completo e questa relazione                                               |

## 8. Limiti residui

1. **Nessun promemoria o notifica**: la «prossima azione» è un'indicazione, non un'attività (`tasks`); la scheda «Attività» non c'è finché non esistono attività operative.
2. **Nessuna sincronizzazione con calendari** né link generati per le videochiamate: la sede/link è testo libero.
3. **Nessuna modifica concorrente protetta** da token di versione (ultima scrittura vince), come in M2.
4. **Bundle**: +57 kB (+17 kB gzip) sul percorso iniziale e +60 kB sulla pagina Kanban rispetto a M2; nessun budget formale definito.
5. **Un solo browser** (Chromium), **nessun screen reader reale**, nessuna prova su touch reali né su Cloudflare Access/D1 remoti.
6. La bacheca carica ancora tutte le schede (tetto 2.000) con il riepilogo dei colloqui: misurato fino a 1.500 schede in locale.
7. La **CI su GitHub** non è stata eseguita su questo branch (non pubblicato): da osservare alla prima PR.
8. Il mutation check sul filtro per workspace di `getInterview` non fallisce, per difesa a più livelli (vedi testing-report §3): è voluto, non una lacuna.

## 9. Readiness per una PR

**Sì, dopo M2.** Passi consigliati: integrare la PR #4, rifare il rebase/aprire la PR di M2.5 verso `main`, **attendere la CI** (_E2E_ e _quality_) e rivedere il diff dei contratti ([api-contracts.md](api-contracts.md)) e della migrazione `0004` ([database-migration.md](database-migration.md)). Nessun P0/P1 aperto. Prima di un deploy: applicare `0004` a D1 remoto con un backup, perché ricostruisce `activity_events`.

## 10. Prerequisiti per M3

1. Integrare M2, poi M2.5, e riportare la CI a verde.
2. Decidere il legame tra **attività** (`tasks`) e colloqui (es. promemoria di feedback dopo un colloquio completato): i dati ci sono (`scheduledAt`, `status`), il comportamento no.
3. Decidere se la scheda «Attività» appaia solo con attività operative o sempre.
4. Decidere se estendere la cronologia alle modifiche dei campi personalizzati (aperto da M2).
5. Valutare un budget di bundle prima di aggiungere altre funzioni alla modale.

## 11. Non fatto, per scelta

Merge, deploy, push e PR; M3 (attività, promemoria, notifiche); integrazioni con calendari, e-mail, scraping o AI; modifiche a `main`.
