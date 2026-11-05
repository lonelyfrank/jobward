# M1 — Relazione di consegna

**Branch:** `m1-boards-cards` · **Data:** 2026-11-05
**Stato:** pronta per revisione. **Nessun merge, nessun deploy, nessuna PR creata, nessun push.** La decisione finale è del proprietario della repository.

> ⚠️ **Prerequisito non soddisfatto.** La PR #2 (correzione E2E/H-23) era **aperta** e la CI di `main` era **rossa** per quello stesso difetto.
> Non essendo ammesso il merge automatico, M1 è stata **impilata sul branch della PR #2** (`fix/m0h-ci-e2e`, `c3004c6`), non su `main`.
> **Prima di integrare M1 va integrata la PR #2** (il diff di M1 resta pulito: non contiene i commit della PR #2).

## 1. In sintesi

Meet Roulette è ora **utilizzabile** per organizzare candidature reali: si apre l'app, si crea una bacheca da template, si personalizzano le colonne,
si registrano opportunità con il solo titolo, si modificano, si spostano e riordinano (mouse, tastiera, touch oppure menu), si consultano i dettagli e la
cronologia, si archiviano e ripristinano, e tutto persiste dopo il refresh — da desktop e da telefono.

## 2. Funzioni realmente implementate

| Area          | Funzione                                                                                                                                                                            | Verificata da                                    |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| **Bacheche**  | Crea (da template **Job Search Standard / Minimal / Personalizzata**, atomica), visualizza, rinomina, descrizione, colore, **preferite**, ordine, elimina con conferma              | API (13 test), web, E2E                          |
| **Colonne**   | Crea, rinomina, colore, fase (etichetta), ordina, **conteggio schede**, eliminazione **controllata** (mai in cascata sulle schede)                                                  | API (11), web, E2E                               |
| **Schede**    | **Creazione rapida col solo titolo** nella colonna e dalla barra superiore; titolo, note, priorità, **azienda**, **URL dell'annuncio**; date; archivia/ripristina                   | API, web, E2E                                    |
| **Dettaglio** | Pannello laterale (telefono: schermo intero), indirizzo condivisibile, modifica dei soli campi cambiati, **cronologia** (creazione, spostamenti, priorità, archivio), focus gestito | E2E, axe                                         |
| **Kanban**    | Trascinamento di schede (tra colonne e nella stessa) e colonne con **mouse, touch, tastiera**; **menu alternativo** per tutto; ottimistico con **rollback**; coda seriale           | E2E (reali), web                                 |
| **Overview**  | Conteggi reali, **opportunità recenti**, bacheche recenti, passi di avvio reali; rimossi gli indicatori "M1"                                                                        | API, web, E2E                                    |
| **Sicurezza** | `workspaceScope` unico; isolamento tra workspace anche **nel database**; CSRF; `viewer` sola lettura; tetti atomici                                                                 | `kanban-isolation.test.ts` (14), rotte enumerate |

I **template sono letti dal modulo dati condiviso** (`@meet-roulette/shared`), anche dal server.

## 3. Funzioni incomplete o volutamente rinviate

| Elemento                                                                                                  | Stato                                                                                                      |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Campi professionali oltre azienda e URL (stipendio, sede, modalità, contratto, date, **fase**, **esito**) | **M2** (le colonne del DB esistono; l'API li rifiuta con 400, non li ignora)                               |
| Cambio di fase proposto quando si sposta in una colonna con categoria                                     | **Non implementato per scelta**: la categoria è solo un'etichetta (M1 §5 "conservativa"). Decisione per M2 |
| Etichette, campi personalizzati, filtri, ricerca, vista tabella                                           | M2 (la ricerca nella barra superiore resta dichiarata "in arrivo")                                         |
| Attività, scadenze, cronologia estesa                                                                     | M3                                                                                                         |
| Icone delle bacheche, eliminazione definitiva di schede                                                   | Non previste in M1 (le schede si archiviano)                                                               |
| Procedura guidata di onboarding con scelta del template e prima opportunità                               | Sostituita da creazione da template + checklist reale dell'Overview                                        |
| Contatori "Candidature inviate" e "Colloqui"                                                              | Restano a 0 finché M2 non introduce i dati; lo dichiarano                                                  |

## 4. Test eseguiti

Tutti eseguiti in questa sessione, **da ambiente pulito** (`dist`, stato E2E e artefatti rimossi; `pnpm install --frozen-lockfile`). Dettaglio: [testing-report.md](testing-report.md).

| Controllo                                                                        | Risultato                                                                                   |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `pnpm check` (typecheck, lint, format, contrasto, config, db:check, test, build) | ✅                                                                                          |
| Test unitari e di integrazione                                                   | ✅ **287** (shared 17 · schemas 32 · web 62 · api 176); baseline 163                        |
| Contrasto WCAG dei token                                                         | ✅ 70 coppie (38 + 32 nuove)                                                                |
| `pnpm test:e2e` (browser reale → Vite → Wrangler → D1)                           | ✅ **65** (31 preesistenti + 34 nuovi), con axe, mouse, tastiera, touch, rollback           |
| `pnpm test:preview` (build di produzione, CSP reale)                             | ✅ **9** (8 + 1)                                                                            |
| Responsive 390 / 768 / 1024 / 1360 px                                            | ✅ nessuno scroll orizzontale della pagina, axe senza violazioni, target ≥ 44 px a telefono |

**Prima del gate finale** gli E2E avevano mostrato 3 fallimenti, tutti difetti dei test (non dell'app) poi corretti; un timeout isolato nel test di archiviazione **non è stato riprodotto**
(vedi la sezione "Stabilità" del report). Nessun test è stato disattivato o indebolito per far passare il gate: l'unico cambio di soglia è `test.slow()` sul controllo axe di 12 schermate.

## 5. Problemi

Dettaglio in [issue-register.md](issue-register.md). **Nessun P0/P1 aperto.** Trovati e corretti durante M1: **1 P1** (la migrazione `0001` di M0.H impediva di eliminare qualunque bacheca con schede),
**6 P2**, 2 P3. Sono noti 10 limiti (L-01…L-10), tra cui: peso del bundle (+159 kB), nessuna prova con screen reader reali, nessun token di versione nella modifica delle schede.

## 6. Cambiamenti di architettura

Vedi [architecture.md](architecture.md) e [ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md). I principali:
**migrazione `0002`** (correzione del trigger) · middleware **`workspaceScope`** (un solo controllo di appartenenza; l'overview lo riusa) · ordinamento con **funzioni pure condivise** client/server e
**`UPDATE … FROM`** per il ribilanciamento · **tetti atomici** per bacheche/colonne/schede · `@dnd-kit/core` classico (non `@dnd-kit/react` 0.x) · menu **piatti** invece di sottomenu.
Nessuna nuova tabella: lo schema di M0 bastava.

## 7. Commit

| Commit     | Checkpoint                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `23a082d`  | **M1.1** backend (ordinamento, migrazione 0002, `workspaceScope`, bacheche/colonne) **+ backend di M1.2** (schede)                   |
| `c25a847`  | **M1.1–M1.3** interfaccia (galleria, bacheca, colonne, schede, dettaglio, Kanban) con test web                                       |
| `50c2b39`  | **M1.4** test E2E e di anteprima                                                                                                     |
| `7725543`  | **M1.4** stabilizzazione degli E2E emersi dal gate pulito (+ menu entro lo spazio disponibile, aree di tocco di galleria e Overview) |
| _(finale)_ | **M1.4** documentazione e consegna                                                                                                   |

> **Nota onesta sulla granularità.** Non c'è un commit per checkpoint. In ordine: il backend è stato scritto e **testato a moduli** (bacheche → colonne → schede → ordinamento → isolamento, con la suite API
> eseguita a ogni passo); poi l'interfaccia (galleria → bacheca/colonne → schede e dettaglio → trascinamento) con i test web; infine gli E2E su stack reale. **Non** mi sono fermato a M1.1 per eseguire un E2E
> completo prima di scrivere le schede, e le prove su browser reale sono arrivate dopo l'interfaccia: è per questo che alcuni difetti (M1-05, M1-06, M1-07) sono emersi tardi.
> I commit sono raggruppati **per livello** perché il backend di bacheche, colonne e schede è inscindibile (`GET /boards/:id` restituisce le schede) e la bacheca contiene fin dall'inizio il Kanban;
> separarli a posteriori avrebbe prodotto commit che non compilano.

## 8. Prerequisiti per M2

1. **Integrare la PR #2** e riportare la CI di `main` a verde; poi integrare M1.
2. **Decidere** il comportamento del cambio di fase proposto (M1 non scrive `stage`/`outcome`).
3. Allargare `cardDetailsInput` a `applicationDetailsInput` (il resto del backend è già pronto: tabella, vincoli, tenancy).
4. Decidere la visibilità dei campi per modalità (scheda del Kanban vs tabella) e la gestione di valori e definizioni dei campi personalizzati (le tabelle e i trigger esistono dal M0.H).
5. Valutare il **code splitting** della vista bacheca prima di aggiungere altre viste pesanti (JS già +159 kB).
6. Prima del rilascio privato (M4): prova manuale con screen reader, trascinamento da tastiera tra colonne, dispositivi touch reali, Firefox/WebKit; **Cloudflare Access e D1 remoti** restano non provati.

## 9. Cosa NON è stato fatto (esplicitamente)

Nessun merge, deploy, push, PR o modifica di `main`. Nessuna autenticazione pubblica, funzione AI, scraping, integrazione esterna o abbonamento. Nessun dato fittizio in produzione
(l'app parte vuota). Non sono stati anticipati M2, M3 o M4: l'unica dipendenza introdotta è l'uso di `application_details.company` e `source_url`, già nello schema di M0.
