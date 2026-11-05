# M2.5 — Relazione sui test

Tutto eseguito in questa sessione **da ambiente pulito** (`dist`, stato E2E e artefatti rimossi), sul commit finale del branch, **senza modificare i sorgenti mentre le suite giravano**.

## Riepilogo

| Controllo                                                                                                     | Risultato                                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `pnpm check` (typecheck, lint, format, contrasto, config, **`db:check`**, **`db:upgrade-test`**, test, build) | **OK** (exit 0)                                                                                              |
| Unit + integrazione                                                                                           | **OK** — shared 17, schemas 43, web 106, api 306                                                             |
| `pnpm test:e2e` (browser → Vite → Wrangler → D1 locale)                                                       | **OK** — 117 passati, 0 falliti, 0 instabili (7,7 min)                                                       |
| `pnpm test:preview` (build di produzione, CSP reale)                                                          | **OK** — 11 passati (CSP reale, nessuna violazione, nessun errore di rete oltre `ERR_ABORTED` voluto)        |
| Aggiornamento di un DB M1 popolato → `0003` → `0004`                                                          | ✅ cronologia identica riga per riga, trigger ricreati (vedi [database-migration.md](database-migration.md)) |

## 1. Copertura per scenario richiesto

| Scenario                                                         | Dove                                                                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Apertura modale desktop (larghezza ≤ 1000 px, ≤ 90dvh, centrata) | `interviews.spec` n. 1; `kanban.spec` (1024 e 1360 px)                                                           |
| Apertura a schermo intero su telefono                            | `interviews.spec` n. 15; `kanban.spec` 390 px; `details.spec` n. 9                                               |
| Navigazione tra schede (tastiera, indirizzo, refresh)            | `interviews.spec` n. 2                                                                                           |
| Chiusura (Esc, X, «indietro») e ripristino del focus             | `interviews.spec` n. 2 e 13                                                                                      |
| Creazione colloquio                                              | API (`interviews.test`), `interviews.spec` n. 3 e 15                                                             |
| (Ri)programmazione                                               | API, `interviews.spec` n. 4                                                                                      |
| Completamento, feedback                                          | API, `interviews.spec` n. 5 e 9                                                                                  |
| Round successivo, colloqui multipli, annullamento                | API, `interviews.spec` n. 6                                                                                      |
| Archiviazione con storico                                        | API, `interviews.spec` n. 12                                                                                     |
| **Nessuna modifica automatica** di colonna/fase/esito            | API (creare, completare, annullare), `interviews.spec` n. 3, 5, 7                                                |
| Prossimo colloquio corretto (annullati e passati esclusi)        | API, unit `summarizeInterviews`, `interviews.spec` n. 4 e 6                                                      |
| Kanban aggiornato (prossimo colloquio, azione, densità)          | `interviews.spec` n. 3, 4, 5, 10                                                                                 |
| Isolamento tra workspace                                         | API (matrice su 5 operazioni + vincolo del database), `interviews.spec` n. 14                                    |
| Migrazione di un DB M2 popolato                                  | `db:upgrade-test`                                                                                                |
| Refresh e persistenza                                            | `interviews.spec` n. 2 e 9                                                                                       |
| Nessuna regressione su drag & drop                               | `kanban.spec` (trascinamento mouse, tastiera, touch, menu, rollback) invariato nella logica                      |
| CSP di produzione                                                | anteprima: nuovo flusso M2.5                                                                                     |
| Accessibilità                                                    | axe su Panoramica, Colloqui (vuota/con round/modulo a 390 px/scuro), Dettagli, Cronologia; aree di tocco ≥ 44 px |
| Modifiche non salvate                                            | `interviews.spec` n. 11 (Esc, «indietro», bozza di colloquio)                                                    |

## 2. Test nuovi

| File                          |         Test | Cosa verifica                                                                                                                                                                                                                                                             |
| ----------------------------- | -----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/interviews.test.ts`      |           22 | creazione/default, programmazione, riprogrammazione, completamento, annullamento, transizioni vietate (409), tetto 50, validazione (17 casi), eventi senza testi riservati, riepilogo (prossimo, azione), nessun N+1 su 1.500 schede, archiviate, isolamento + vincolo DB |
| `schemas` (nuovi)             |            5 | `summarizeInterviews` (prossimo, priorità dell'azione, annullati), contratti strict                                                                                                                                                                                       |
| `web/interviews/time.test.ts` |            6 | fusi orari UTC/Roma/New York/Tokyo, cambio d'ora, formato non valido                                                                                                                                                                                                      |
| `api/database.test.ts`        |            — | l'elenco delle tabelle include `interviews`                                                                                                                                                                                                                               |
| `e2e/interviews.spec.ts`      |           16 | i flussi sopra                                                                                                                                                                                                                                                            |
| `e2e-preview`                 |            1 | modale, colloquio, guardia, card Kanban, telefono, sotto la CSP reale                                                                                                                                                                                                     |
| `db:upgrade-test`             | 28 controlli | 11 nuovi per 0004                                                                                                                                                                                                                                                         |

## 3. Mutation check

Rimosso il filtro per workspace da `getInterview`: **i test continuano a passare**. È atteso e voluto: la proprietà è difesa a più livelli indipendenti (il colloquio, la **sua scheda** — cercata nello stesso workspace —, il predicato dell'`UPDATE`, la chiave composita del database). Un test che dipendesse da un solo livello sarebbe fragile; quelli attuali fallirebbero solo se **tutti** i livelli cedessero. La prova del livello più basso salta il servizio e verifica che il database rifiuti da solo la riga (`db:upgrade-test`, sezione 4).

## 4. Prestazioni e bundle

| Percorso                                         | M2 (base)            | M2.5                 | Differenza      |
| ------------------------------------------------ | -------------------- | -------------------- | --------------- |
| JS iniziale (entry + runtime + vendor + `field`) | 713 kB / 220 kB gzip | 770 kB / 237 kB gzip | +57 kB / +17 kB |
| Pagina Kanban (iniziale + `board-kanban`)        | 779 kB / 241 kB gzip | 839 kB / 259 kB gzip | +60 kB / +18 kB |

Il maggior peso è la modale a schede con il modulo dei colloqui, caricata con il dettaglio della scheda; la tabella, le Opportunità e il configuratore dei campi restano chunk a richiesta (`board-table` 0,3 kB, `opportunities-view` 22,7 kB, `fields-dialog` 13,6 kB). Non è stato introdotto alcun budget formale: l'aumento è registrato qui come dato.
**Bacheca:** il riepilogo dei colloqui è **una query** (`JOIN` + filtro per bacheca) per tutte le schede; con 1.500 schede, ciascuna con un colloquio, la bacheca risponde correttamente con `interviewSummary.next` su tutte (soglia del test 2,5 s, indicativa in locale).

## 5. Stabilità

Durante il lavoro il gate ha rivelato **M25-01** (pannelli inattivi nell'albero di accessibilità) e, a seguito della sua correzione, **M25-05** (test E2E che passavano per effetto del difetto + annullamento voluto delle richieste visto come errore nell'anteprima). Nessun test è stato disattivato; l'unica eccezione aggiunta al controllo dell'anteprima è `ERR_ABORTED`. Dettagli in [issue-register.md](issue-register.md).

## 6. Cosa NON è stato provato

Cloudflare Access e D1 **remoti**; Firefox e WebKit; screen reader reali; dispositivi touch reali; CI su GitHub (da osservare sulla PR); più utenti in collaborazione (non esiste ancora).
