# M1 — Report dei test

Tutti i numeri sono stati **eseguiti in questa sessione** (ambiente pulito: `dist`, `.e2e-state`, `test-results` rimossi prima di ogni gate).
Baseline di partenza (stesso comando, branch di partenza): 163 test unitari/integrazione, 31 E2E, 8 di anteprima.

## Esito

| Controllo                                            | Risultato                                                                 |
| ---------------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm typecheck`                                     | ✅ 5 package                                                              |
| `pnpm lint --max-warnings=0`                         | ✅                                                                        |
| `pnpm format:check`                                  | ✅                                                                        |
| `pnpm check:contrast`                                | ✅ **70 coppie** (38 + 32 nuove: 8 token `accent-*` × 2 sfondi × 2 temi)  |
| `pnpm check:config`, `pnpm db:check`                 | ✅ (3 migrazioni coerenti con lo schema)                                  |
| `pnpm test` (unitari + integrazione)                 | ✅ ****287** (shared 17 · schemas 32 · web 62 · api 176; baseline 163)**  |
| `pnpm build`                                         | ✅ (web + dry-run del Worker)                                             |
| `pnpm test:e2e` (stack reale, Chromium)              | ✅ **65 passati** (31 preesistenti + 16 `boards.spec` + 18 `kanban.spec`) |
| `pnpm test:preview` (build di produzione, CSP reale) | ✅ **9 passati** (8 preesistenti + 1 nuovo sui flussi di M1)              |

## Unitari e integrazione (Vitest)

| Package            | Test | Cosa copre in M1                                                                                                                                                                                                                             |
| ------------------ | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/shared`  | 17   | Ordinamento: inserimento, gap esaurito, duplicati, **proprietà su 400 mosse casuali**, ancora mancante                                                                                                                                       |
| `packages/schemas` | 32   | Contratti M1: template, parziali con ≥ 1 campo, rifiuto di campi sconosciuti (nessun mass-assignment), URL solo http(s), campi di M2 rifiutati, ancore esplicite                                                                             |
| `apps/api`         | 176  | Su **D1 reale (Miniflare) con le migrazioni reali**: bacheche (13), colonne (11), schede (17), ordinamento e concorrenza (14), **isolamento e integrità (14)**, overview (+1), rotte protette                                                |
| `apps/web`         | 62   | Stato del Kanban (funzioni pure, 11) e interfaccia (23): galleria, bacheca, creazione rapida, spostamento da menu, **ottimistico + rollback**, archivia/ripristina, colonne (crea, modifica, sposta, elimina con/senza schede), intestazione |

## Isolamento e integrità (richiesti da M1 §6)

`kanban-isolation.test.ts` (14 test), con **fotografia dei dati della vittima prima/dopo ogni attacco** (`toEqual`):

| Tentativo                                                                                             | Esito atteso e verificato                                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 15 operazioni (lettura, modifica, sposta, elimina, archivia…) su id altrui, col **proprio** workspace | `404`, nessun dato della vittima nella risposta, nulla cambia |
| Le stesse operazioni indicando il workspace **della vittima**                                         | `404` (non membro), nulla cambia                              |
| Risposta per risorsa altrui vs inesistente                                                            | **Indistinguibili** (stesso status, codice e messaggio)       |
| Spostare la propria scheda in una colonna/ancora altrui, o viceversa                                  | `404` / `409`, nulla cambia da nessuna delle due parti        |
| Eliminare una propria colonna spostando le schede in una colonna altrui                               | `404`, nulla spostato                                         |
| Scheda con colonna di un'altra **bacheca** o di un altro **workspace** (via SQL)                      | Rifiutato dal **database** (FK composita, ADR-0007)           |
| `UPDATE cards SET column_id` verso colonna altrui (via SQL)                                           | Rifiutato dal database                                        |
| Evento di cronologia che riferisce una scheda altrui (insert e re-puntamento)                         | Rifiutato dal trigger (anche dopo la correzione `0002`)       |
| Eliminare la propria bacheca                                                                          | Non tocca i dati altrui                                       |
| Membro `viewer`: lettura sì, scrittura                                                                | `403`                                                         |
| `workspaceId` mancante/vuoto; `Content-Type` non JSON; `Origin` estraneo                              | `400` / `415` / `403`                                         |
| `workspaceId` nel corpo di una creazione                                                              | Ignorato: la scheda nasce nel workspace autenticato           |

Inoltre il test di M0.H che **enumera automaticamente** le rotte `/api/v1` verifica che ogni rotta nuova risponda `401` senza credenziali.

## E2E su stack reale (Playwright + axe)

Browser → Vite → Wrangler (Worker) → D1 locale, database ricreato a ogni esecuzione.

| Scenario richiesto (M1 §8)                        | Dove                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1 Creazione bacheca · 2 da template               | `boards.spec.ts` (Job Search Standard, Minimal, Personalizzata)                                                               |
| 3 Rinomina bacheca                                | `boards.spec.ts`                                                                                                              |
| 4 Crea colonna · 5 Rinomina colonna               | `boards.spec.ts` (nome, colore, fase, sposta)                                                                                 |
| 6 Crea scheda · 7 Modifica scheda                 | `boards.spec.ts` (creazione rapida in serie; pannello con validazione URL, priorità, note)                                    |
| 8 Sposta scheda · 9 Riordina                      | `kanban.spec.ts` (**mouse**, **tastiera**, **touch**, **menu**, selettore del pannello)                                       |
| 10 Persistenza dopo refresh                       | Ogni test ricarica la pagina e rilegge i dati                                                                                 |
| 11 **Rollback dopo errore**                       | `kanban.spec.ts` (risposta 500 intercettata → la scheda torna; poi riprova e riesce)                                          |
| 12 Archiviazione e ripristino                     | `boards.spec.ts` (menu, "Annulla", pannello, elenco archiviate, persistenza)                                                  |
| 13 Eliminazione colonna con schede                | `boards.spec.ts` (obbligo di scegliere dove spostarle; nessuna scheda persa)                                                  |
| 14 Accesso negato a workspace altrui              | `boards.spec.ts` (bacheca inesistente/altrui → "non trovata"; API 404) + isolamento API                                       |
| 15 Uso da tastiera                                | `kanban.spec.ts` (Spazio/frecce/Spazio, Esc, Invio sul titolo, menu), `boards.spec.ts` (focus)                                |
| 16 Uso su mobile                                  | `kanban.spec.ts` (touch reale via CDP, tocco breve vs pressione lunga, flusso senza trascinamento, pannello a schermo intero) |
| Responsive 390 / 768 / 1024 / 1360 px             | `kanban.spec.ts` (nessuno scroll orizzontale della pagina; axe a ogni larghezza; touch ≥ 44 px)                               |
| Overview con conteggi reali e opportunità recenti | `boards.spec.ts`                                                                                                              |

**Sotto la CSP di produzione** (`test:preview`, build reale con `_headers`): creazione, trascinamento, pannello, conferma — nessuna violazione CSP né errore in console.

## Cosa NON è coperto

Vedi [issue-register.md](issue-register.md) §B e [accessibility.md](accessibility.md): screen reader reali, trascinamento da tastiera tra colonne, dispositivi touch reali, Firefox/WebKit,
Cloudflare Access e D1 remoto, carichi elevati (nessun test di prestazioni oltre le 150 righe del test di ribilanciamento).

## Prove che i test mordono

I difetti M1-01 … M1-07 sono stati **scoperti proprio da questi test** (alcuni solo dal browser reale: M1-05, M1-06, M1-07; i test jsdom passavano).
Ogni correzione ha il suo test di regressione indicato nel registro.

## Stabilità degli E2E (da dichiarare)

Il primo gate pulito ha mostrato **3 fallimenti** (poi corretti e rieseguiti da zero con esito verde), che non erano difetti dell'app ma dei test: un link troppo generico
dopo la modifica dell'Overview, una rotta intercettata rimossa prima della risposta, e il controllo axe su 12 schermate (19–30 s) a ridosso del limite di 30 s (ora `test.slow()`).
In una esecuzione precedente il test di archiviazione ha avuto un **timeout isolato** (menu aperto, voce "Archivia" non cliccabile): non è stato riprodotto in 4 esecuzioni successive.
È stata applicata una correzione plausibile (il menu non può più superare lo spazio disponibile nella finestra), ma **la causa non è dimostrata**: se riappare va trattato come un difetto aperto.
Il carico della macchina (portatile a 4 core) incide sui tempi: la CI di GitHub, con `retries: 1`, è più tollerante.
