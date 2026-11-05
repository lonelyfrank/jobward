# M2 — Relazione sui test

Tutto eseguito in questa sessione, **da ambiente pulito** (`dist`, stato E2E e artefatti rimossi; `pnpm install --frozen-lockfile`), sul commit finale del branch.

## Riepilogo

| Controllo                                                                                             | Risultato                                                                                       |
| ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `pnpm check` (typecheck, lint, format, contrasto, config, db:check, **db:upgrade-test**, test, build) | ✅                                                                                              |
| Test unitari e di integrazione                                                                        | ✅ **439** (shared 17 · schemas 38 · web 100 · api 284); baseline 287                           |
| `pnpm test:e2e` (browser → Vite → Wrangler → D1 locale)                                               | ✅ **100/100** (65 di M1 + 9 dettagli + 10 personalizzazione + 16 ricerca/tabella)              |
| `pnpm test:preview` (build di produzione, CSP reale)                                                  | ✅ **10/10** (9 + 1 nuovo flusso M2 senza violazioni CSP)                                       |
| Aggiornamento di un database M1 popolato (`pnpm db:upgrade-test`)                                     | ✅ 601 schede (60 archiviate), dettagli, eventi, etichetta: dati identici; 8 vincoli verificati |
| Mutation check dei controlli di isolamento                                                            | ✅ 3 controlli rimossi → i test falliscono (§3)                                                 |

CI di `main` prima di M2: **rossa** (M2-00, corretta). CI del branch: **da osservare sulla PR** (non eseguita in locale).

## 1. Test per area

| File                                               |   Test | Copre                                                                                                                                                            |
| -------------------------------------------------- | -----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api/application-details.test.ts`                  |     40 | dettagli, patch assente/`null`, validazione (20 casi), retribuzione sullo stato risultante, colonna≠fase≠esito, eventi, isolamento                               |
| `api/overview.test.ts` (nuovi)                     |      4 | «inviata»/«in colloquio», nome della colonna irrilevante, archiviate, spostamento                                                                                |
| `api/labels.test.ts`                               |     14 | CRUD, colori token, unicità, tetti, assegnazione idempotente, eliminazione controllata, isolamento, FK composita                                                 |
| `api/custom-fields.test.ts`                        |     21 | 8 tipi, ID opzioni, config non valide, tipo immutabile, config incompatibile (409), disattiva/riattiva, eliminazione, ordine, null≠assente                       |
| `api/m2-isolation.test.ts`                         |      8 | matrice cross-workspace (15 operazioni), nessuna fuga in elenchi/conteggi, `workspaceId` nel body, cross-bacheca, trigger del database                           |
| `api/opportunities.test.ts`                        |     21 | testo, caratteri speciali/iniezione, filtri e loro combinazione, ordinamenti, paginazione, contratto strict, isolamento, 2.000 schede                            |
| `schemas` (nuovi)                                  |      6 | `updateCardInput`, `salaryIssues`, alias, lordo/netto                                                                                                            |
| `web/card-form`, `salary`, `values`, `table-state` | 4 file | bozza→patch, importi, valori dei campi, URL ↔ stato                                                                                                              |
| `e2e/details.spec.ts`                              |      9 | creazione col solo titolo, tutti i dettagli, validazione, errore del server, colonna≠fase≠esito, suggerimento, Overview, telefono                                |
| `e2e/customization.spec.ts`                        |     10 | configuratore, riordino, valori di ogni tipo, disattiva/riattiva, opzioni, eliminazione, etichette, Impostazioni, telefono                                       |
| `e2e/search.spec.ts`                               |     16 | Kanban→Tabella, ricerca/attesa, speciali, filtri, ordinamento, dettaglio dalla tabella, coerenza, Opportunità, colonne, pagine, errore, 390/768 px, scuro, tocco |
| `e2e-preview` (nuovo)                              |      1 | flusso M2 completo sotto la CSP di produzione                                                                                                                    |

## 2. Migrazione (obbligatori 1–7)

| #                                                                                                                                                               | Caso                                        | Dove                                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1                                                                                                                                                               | database vuoto                              | tutta la suite API applica `0000…0003` a un D1 vuoto                                                                                                                                           |
| 2–4                                                                                                                                                             | M1 popolato, archiviate, dettagli esistenti | `db:upgrade-test`: 601 schede (60 archiviate), dettagli con importi/fase/data, evento, etichetta → dati **identici campo per campo**, `salary_basis = NULL` ovunque, `foreign_key_check` vuoto |
| 5                                                                                                                                                               | molte schede                                | 601 nell'aggiornamento; 2.000 nella prova di ricerca                                                                                                                                           |
| 6                                                                                                                                                               | scrittura cross-workspace                   | scheda su bacheca/colonna altrui rifiutata dal database dopo l'aggiornamento; `m2-isolation`                                                                                                   |
| 7                                                                                                                                                               | riferimento tra bacheche diverse            | valore di un campo di un'altra bacheca: trigger; scheda su colonna di un'altra bacheca                                                                                                         |
| Verificati anche: `salary_basis` rifiuta valori fuori vocabolario; nome di campo duplicato (senza maiuscole) rifiutato; stesso nome in un'altra bacheca lecito. |

## 3. Mutation check (i controlli falliscono se rimossi)

| Controllo rimosso                                                                                                                                        | Test che falliscono |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------: |
| `getField` senza filtro per workspace                                                                                                                    |                   1 |
| `listLabels`/`getLabel` senza filtro per workspace                                                                                                       |                   6 |
| valore su campo di un'altra bacheca (controllo di bacheca + predicato SQL)                                                                               |                   1 |
| Dopo il ripristino: 43/43 (labels, custom-fields, isolamento). Il trigger del database resta l'ultima difesa e ha un test proprio che salta il servizio. |

## 4. Prestazioni

**Ricerca** (test `opportunities.test.ts`, 2.000 schede in una bacheca, runtime workerd/D1 locale): tutte le schede (pagina da 50) 15–16 ms · ricerca testuale 10–13 ms · per azienda 10–13 ms · filtri + ordinamento 8–9 ms · pagina 40 (offset 1.950) ordinata per azienda 15–22 ms (3 esecuzioni, portatile con 4 core, D1 locale: indicativo, non un confronto con il servizio remoto). La soglia del test (1,5 s) intercetta scansioni patologiche, non è un benchmark.

**Bundle** (build di produzione, JS gzip a 9):

| Percorso                                         | Baseline M1 (main)       | M2                                               |
| ------------------------------------------------ | ------------------------ | ------------------------------------------------ |
| Caricamento iniziale (Overview, Impostazioni, …) | 765,6 kB / 237,3 kB gzip | **713,4 kB / 219,8 kB gzip** (−52 / −17)         |
| + Kanban (chunk a richiesta)                     | —                        | +65,8 kB / +21,5 kB gzip                         |
| Pagina Kanban in totale                          | 765,6 / 237,3            | 779,2 / 241,3 (+13,6 / +4,0)                     |
| + Opportunità / Tabella                          | —                        | +22,7 / +7,6 gzip                                |
| Configuratore dei campi, Etichette               | —                        | +13,3 / +4,7 e +4,9 / +1,8 gzip (solo se aperti) |
| CSS                                              | 35,3 kB / 7,75 gzip      | 36,6 kB / 7,82 gzip                              |

Il peso aggiunto da M2 (tabella, filtri, configuratore, etichette, form avanzati) **non entra nel caricamento iniziale**; spostare il Kanban a richiesta ha anche ridotto la home. Nessuna soglia di avviso è stata alzata.

**Carico della bacheca:** `GET /boards/:id` restituisce ora ogni scheda con tutti i dettagli (campi `null` compresi). Con il tetto di 2.000 schede il JSON non compresso resta nell'ordine del megabyte e si comprime molto bene; non è stata necessaria una forma ridotta (ADR-0009). Da rivalutare se i volumi reali lo richiedessero.

## 5. Accessibilità e responsive

axe (WCAG 2.2 AA) su ogni schermata nuova, temi chiaro e scuro; larghezze 390/768 px; area di tocco ≥ 44 px a telefono su pannello, configuratore, filtri e elenco. Dettaglio e limiti in [ux-review.md](ux-review.md).

## 6. Stabilità

Durante il lavoro sono emersi e sono stati corretti (vedi [issue-register.md](issue-register.md)): M2-01…M2-08. In particolare **M2-08** (violazione CSP `eval` dovuta al code splitting) è visibile **solo** con la CSP di produzione: la suite di anteprima è quindi parte del gate, non un extra.
Nessun test è stato disattivato o indebolito; le correzioni ai test E2E sono di due tipi dichiarati: attese esplicite (`expect.poll`, animazioni) e dati univoci (la suite completa condivide un workspace). Nella suite completa ci sono stati due falsi rossi causati da **modifiche ai sorgenti mentre la suite girava** (ricarica di Vite): per questo il gate finale è stato eseguito senza toccare i file.

## 7. Cosa NON è stato provato

Cloudflare Access e D1 **remoti**; Firefox e WebKit (solo Chromium); screen reader reali; dispositivi touch reali; CI su GitHub (da osservare sulla PR); carichi oltre 2.000 schede per bacheca; collaborazione tra più utenti (non esiste ancora).
