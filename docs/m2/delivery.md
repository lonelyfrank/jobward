# M2 — Relazione di consegna

**Branch:** `m2-information-customization` (da `main` @ `35b7614`) · **Data:** 2026-11-05
**Stato:** pronta per revisione. **Nessun merge, nessun deploy, nessun push, nessuna PR creata.** La decisione finale è del proprietario della repository.

## 1. In sintesi

Il Kanban di M1 è ora uno strumento da **registrare, personalizzare, cercare e confrontare**. Si può aggiungere una scheda con il solo titolo e, quando serve, arricchirla con dati professionali, fase ed esito (indipendenti dalla colonna), etichette e campi definiti dall'utente per la propria professione; si cerca e si filtra sul server tra tutte le bacheche o dentro una; si confronta in **Tabella** (elenco compatto a telefono) con ordinamento, paginazione e colonne configurabili. Kanban e Tabella mostrano gli stessi dati e si aggiornano a vicenda. La dashboard conta ciò che l'utente ha registrato, non ciò che il nome di una colonna fa supporre.

## 2. Prerequisito risolto per primo: la CI di `main`

`main` era **rossa** sul merge di M1 (M2-00): un falso positivo di contrasto di axe campionava un fade-in a metà + un primo test instabile all'avvio a freddo. Meccanismo riprodotto, test corretti (nessun controllo rimosso, nessuna soglia toccata). **La conferma definitiva arriverà dalla CI della PR**: la causa è dimostrata, il runner no.

## 3. Funzioni completate (verificate)

| Area     | Funzione                                                                                                                                                                                                                                                                                                                                                                             | Verificata da                                                 |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------- |
| **M2.1** | Dettagli professionali completi (posizione, sede, modalità, contratto, retribuzione con **lordo/netto/non specificato**, fonte, URL, date); patch per campo (assente ≠ `null`); **colonna ≠ fase ≠ esito**; suggerimento di fase esplicito e non distruttivo; eventi `stage_changed`/`application_submitted`/`application_closed`; statistiche semantiche; Card Detail 2.0 a sezioni | 44 API, 6 schemi, web, 9 E2E                                  |
| **M2.2** | Campi personalizzati (8 tipi, ID opzioni stabili, tipo immutabile, config accettata solo se i valori restano validi, disattiva/riattiva, elimina con conferma); configuratore con anteprima; **etichette** (CRUD, colori token, assegnazione, eliminazione controllata)                                                                                                              | 35 API + matrice di isolamento (8) con mutation check, 10 E2E |
| **M2.3** | `GET /opportunities` (ricerca, 9 gruppi di filtri, ordinamento a insieme chiuso, paginazione); schermata Opportunità e Tabella di bacheca; stato nell'indirizzo; colonne locali; responsive; ricerca globale dalla barra                                                                                                                                                             | 21 API (compresa iniezione e 2.000 schede), 16 E2E            |
| **M2.4** | Coerenza Kanban/Tabella, code splitting, axe su ogni schermata, anteprima sotto CSP reale, documentazione                                                                                                                                                                                                                                                                            | gate finale                                                   |

## 4. Test (da ambiente pulito, commit finale)

| Controllo                                                                                                 | Esito                                                                 |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `pnpm check` (typecheck, lint, format, contrasto, config, `db:check`, **`db:upgrade-test`**, test, build) | ✅                                                                    |
| Unit + integrazione                                                                                       | ✅ **439** (shared 17 · schemas 38 · web 100 · api 284); baseline 287 |
| E2E su stack reale                                                                                        | ✅ **100/100** (65 + 35 nuovi)                                        |
| Anteprima di produzione (CSP reale)                                                                       | ✅ **10/10**                                                          |
| Aggiornamento di un DB M1 popolato (601 schede)                                                           | ✅ dati identici                                                      |
| Dettaglio, mutation check e prestazioni in [testing-report.md](testing-report.md).                        |

## 5. Problemi trovati e corretti

9 (M2-00…M2-08: **nessun P0, nessun P1**; 6 × P2 compresa la CI di `main`, 3 × P3), tutti corretti o prevenuti — [issue-register.md](issue-register.md). I più rilevanti:
**M2-08** violazione CSP `eval` di Zod comparsa con il code splitting (vista solo con la CSP di produzione), **M2-01** risposta di eliminazione non conforme al contratto (il client segnalava un errore a eliminazione riuscita), **M2-04** la migrazione generata da drizzle-kit avrebbe ricostruito `application_details` cancellando i dati di M1 (riscritta in forma additiva e provata).

## 6. Decisioni architetturali

[ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md) ciclo della candidatura e statistiche · [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md) campi personalizzati conservativi · [ADR-0011](../architecture/decisions/0011-search-and-table-state.md) ricerca SQL, tabella, stato nell'indirizzo. Una sola migrazione, **additiva** (`0003`: `salary_basis` e due indici).
Esito della valutazione della concorrenza (§10 del prompt): **nessun token di versione** — il pannello invia i soli campi cambiati; scritture dipendenti da altro stato sono condizionate nel SQL (ADR-0009 §6).

## 7. Commit

| Commit                 | Checkpoint                                                                                               |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `4b2da17`              | **M2-00** correzione CI di `main` (test) + piano, contratti, registro                                    |
| `f505d60`              | **M2.1** dettagli, fase/esito, statistiche, migrazione 0003, pannello 2.0, test di aggiornamento         |
| `7a902bf`              | **M2.2** API di etichette e campi personalizzati, contratti, matrice di isolamento                       |
| `68ff31c`              | **M2.3** API di ricerca e filtri                                                                         |
| `bcfbd95` + correzioni | **M2.2–M2.3** interfaccia (etichette, campi, ricerca, Tabella), E2E, anteprima, ADR e docs               |
| ultimi commit          | stabilizzazione dei dati degli E2E; area di tocco dei titoli dell'elenco compatto; documentazione finale |

> **Nota sulla granularità.** Ho committato per moduli coerenti **dove il codice compilava da solo**: backend di M2.2 e di M2.3 sono commit separati (con `app.ts`/`index.ts` messi in staging nella forma intermedia). L'**interfaccia** di M2.2 e M2.3 è invece un commit unico: condividono router, pannello, chiavi di cache e la query della Tabella usa i campi/etichette; separarli avrebbe prodotto commit che non compilano. E, come in M1, i test E2E su browser reale sono arrivati dopo l'interfaccia — è per questo che alcuni difetti (M2-01, M2-05, M2-06, M2-08) sono emersi tardi.

## 8. Limiti residui

1. **Nessun filtro né colonna per i campi personalizzati** nella Tabella (l'architettura è pronta; richiede una decisione su come interrogare i valori JSON).
2. **Ricerca solo ASCII case-insensitive** (`è` ≠ `È`); nessun FTS5 (ADR-0011).
3. **Nessuna modifica inline** in tabella (scelta di accessibilità/correttezza).
4. **Tipo di un campo non convertibile**; riordino delle opzioni solo salvando il campo.
5. **Nessun token di versione**: la stessa modifica concorrente a uno stesso campo da due dispositivi è «l'ultima vince».
6. **Un solo browser** (Chromium) e **nessun screen reader reale**; non provati Firefox/WebKit, touch reali, Cloudflare Access/D1 remoti.
7. La bacheca carica ancora **tutte** le schede con tutti i dettagli (tetto 2.000): accettabile, da misurare con dati reali.
8. Il pannello di dettaglio è lungo per schede ricche (sezioni comprimibili come mitigazione).
9. La **CI su GitHub** non è stata eseguita in locale: da osservare sulla PR.
10. Le modifiche dei campi personalizzati non compaiono nella cronologia.

## 9. Readiness per una PR

**Sì, con una condizione:** aprire la PR da `m2-information-customization` verso `main`, **attendere la CI** (in particolare _E2E_ e _quality_, perché M2-00 è corretta ma non confermata sul runner) e rivedere il diff dei contratti ([api-contracts.md](api-contracts.md)) e della migrazione `0003`. Nessun P0/P1 aperto. La migrazione è additiva e provata su un database M1 popolato; **non** ho eseguito `wrangler d1 migrations apply` su D1 remoto (nessun deploy).

## 10. Prerequisiti per M3

1. Integrare M2 e riportare la CI a verde.
2. Decidere se le **attività** (`tasks`) si colleghino a fase/esito (es. promemoria dopo una candidatura inviata): i dati ci sono (`appliedOn`, `stage`), il comportamento no.
3. Decidere dove mostrare **scadenze e follow-up**: colonna della Tabella, filtro («con attività scadute»), sezione del pannello. Il registro delle colonne (`TABLE_COLUMNS`) e `GET /opportunities` sono pronti a riceverli.
4. Estendere la cronologia (`activity_events`) oltre gli eventi semantici principali, se servono le modifiche ai campi personalizzati.
5. Valutare se un filtro «per campo personalizzato» serve davvero prima di introdurre colonne tipizzate (ADR-0010 §8).
6. Prima del rilascio privato (M4): screen reader reali, Firefox/WebKit, dispositivi touch reali, Cloudflare Access e D1 remoti.

## 11. Cosa NON è stato fatto (esplicitamente)

Nessun merge, deploy, push, PR o modifica di `main`. Nessuna integrazione Trello, scraping, candidatura automatica, account pubblici, pagamenti, funzioni social, chat, AI, notifiche, automazioni email, calendari, marketplace o dashboard per recruiter. Attività, follow-up e scadenze (M3) ed esportazione/deploy (M4) non sono stati anticipati.
