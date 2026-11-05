# M3.0 — Audit tecnico

**Data:** 2026-11-05 · **Branch:** `m3-application-workflow` (da `m25-smart-application-modal` @ `d931ff6`)

## 1. Stato della repository

| Domanda                  | Esito                                                                                                                                                                                                                                            |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| M2 è in `main`?          | **Quasi.** `origin/main` = `aa27f82` contiene M2 (feature, test, documentazione). Manca il solo `6864d7a` (test E2E «fuori viewport»), presente su `m2-information-customization`. Il `main` **locale** è fermo a `ba2ff11`, 18 commit indietro. |
| M2.5 è in `main`?        | **No.** Esiste solo sul branch locale `m25-smart-application-modal` (8 commit sopra `aa27f82`), **mai pubblicato**: la CI di GitHub non l'ha mai eseguito.                                                                                       |
| Base corretta per M3     | La punta di M2.5 (`d931ff6`). Partire da `main` farebbe perdere colloqui, modale e migrazione `0004`, di cui M3 ha bisogno.                                                                                                                      |
| Migrazioni non integrate | `0004_m25_interviews.sql` (tabella `interviews` + ricostruzione controllata di `activity_events`). Applicata sui DB di test; **mai** su un D1 remoto.                                                                                            |
| Working tree             | Pulito alla partenza.                                                                                                                                                                                                                            |

**Dipendenza.** M3 → M2.5 → (6864d7a) → PR di M2. Le tre cose vanno integrate nell'ordine; M3 non può precedere M2.5.

## 2. Baseline

Vedi §9.

## 3. Architettura

Monorepo pnpm: `apps/web` (SPA React/Vite/TanStack Query/Radix), `apps/api` (Worker Hono su Cloudflare, D1 via Drizzle + istruzioni `batch()` raw), `packages/{shared,schemas,database}`.

| Strato      | Dove                                                                               | Pulizia per la Local Edition                                                                       |
| ----------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Costanti    | `shared/constants.ts` (stati, fasi, esiti, tipi di evento)                         | ✅ pure                                                                                            |
| Contratti   | `schemas/*` (Zod): input/output dell'API, **`summarizeInterviews` pura**           | ✅ riutilizzabili                                                                                  |
| Dominio     | **sparso**: regole di transizione dei colloqui dentro `api/services/interviews.ts` | ⚠️ mescolato con SQL D1 (`D1Database.prepare`, `batch`); non estraibile così com'è                 |
| Persistenza | `api/services/*` con istruzioni SQL e guardie atomiche                             | ⚠️ legata a D1/SQLite; SQLite è portabile, l'API `D1Database` no                                   |
| Auth        | `middleware/auth.ts` (Cloudflare Access / identità di sviluppo) → `workspaceId`    | ✅ i servizi ricevono già `workspaceId`/`actorUserId` come parametri, non leggono l'autenticazione |

## 4. Mappa M3 ↔ stato attuale (la scoperta principale)

M2.5 ha già anticipato gran parte di M3.1 e M3.3. **Non si reimplementa**: si completa.

| Requisito M3                                    | Esiste già (M2.5/M2)                                                                                                          | Manca                                                                                                                                |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **M3.1** modale centrale, schermo intero mobile | ✅ `Dialog variant="workspace"`; focus trap, Esc, ripristino del focus, conferma modifiche non salvate, reduced-motion, #hash | Schede **Note** e **Documenti**; intestazione con **stato pipeline**; area azioni contestuali                                        |
| Sezioni Panoramica/Colloqui/Timeline            | ✅ Panoramica · Colloqui · Dettagli · Cronologia                                                                              | «Timeline» (oggi «Cronologia») con note; «Dettagli» (modulo di modifica) non è nell'elenco di M3: va deciso dove vive                |
| **M3.2** pipeline                               | ✅ **due assi** ortogonali: `stage` (7) ed `outcome` (6), più `archivedAt`; `stage_changed` con `{from,to}`                   | Stato generale a 9 valori; tabella di transizioni; riapertura; storico completo degli esiti; correzione                              |
| **M3.3** colloqui                               | ✅ entità `interviews`, più round, riprogrammazione, completa/annulla, esito, feedback, fuso IANA, round successivo, tetto 50 | Modalità «altro» (oggi `video/phone/onsite`/vuoto); coerenza esplicita con la pipeline                                               |
| **M3.4** timeline                               | ✅ 17 tipi di evento, atomici con la modifica, guardia SQL «solo se è cambiato», senza testi riservati                        | **Note manuali** (nessuna entità), eventi «offerta», «riapertura», **anti-duplicazione dei retry** (non esiste), ordinamento stabile |
| **M3.5** azioni rapide                          | ⚠️ una sola «prossima azione» derivata (`overdue`/`record_feedback`/`schedule`) + «Aggiorna fase»                             | Insieme di azioni **dipendenti dal contesto** secondo gli esempi del requisito                                                       |
| Documenti                                       | ❌ nessuna entità; **nessun binding R2/KV**; gli allegati sono in backlog «dopo M4» (`docs/roadmap/backlog.md`)               | Tutto: va deciso il perimetro (§7, D3)                                                                                               |

## 5. Rebranding (eseguito in M3.0)

Inventario: 206 occorrenze fuori da `docs/`; **185** sono lo scope `@meet-roulette/*`; le altre sono testo visibile (6), configurazione Worker/D1 (10), identità di sviluppo (3).

- **Rinominato** (commit M3.0): `<title>`, meta description, `<noscript>`, titolo del tab, wordmark, onboarding, `package.json` (descrizione), README, visione, panoramica di architettura, unit test del titolo. Il nome sta in **un solo posto**: `apps/web/src/lib/brand.ts`.
- **Non rinominato, per scelta** (motivi e strategia in [ADR-0013](../architecture/decisions/0013-rebranding-jobward.md)): scope dei pacchetti, nome dei Worker, `database_name` D1, `DEV_USER_EMAIL`, repository.
- **Manifest dell'applicazione:** **non esiste** (nessun `manifest.webmanifest`, nessuna PWA); non è stato creato: sarebbe una funzione nuova, non un rebranding.
- **Logo:** nessun nuovo logo. `LogoMark`/`favicon.svg` restano il marchio ereditato (una ruota), marcato come segnaposto nel codice. **Debito di brand:** l'icona richiama ancora il vecchio nome.
- **Documenti storici** (consegne e registri M0–M2.5) lasciati invariati: sono cronaca datata.

## 6. Problemi e rischi trovati

| ID    | Gravità | Titolo                                                                                                                                                                                                                                                                |
| ----- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-01 | P2      | **La riapertura di una candidatura non lascia traccia.** `cards.ts` registra `application_closed` solo se l'esito diventa ≠ «in attesa»; `rejected → pending` non produce alcun evento. La storia degli esiti è incompleta.                                           |
| M3-02 | P2      | **Nessuna protezione dai retry** sulle creazioni (`POST` colloqui). Un secondo invio dello stesso modulo (doppio tocco, rete instabile) crea un secondo round e un secondo evento. Le patch di stato sono invece naturalmente idempotenti (guardia «solo se cambia»). |
| M3-03 | P3      | La logica di transizione dei colloqui è dentro i servizi con SQL: non testabile in isolamento né riusabile da una Local Edition.                                                                                                                                      |
| M3-04 | P3      | Marchio grafico ancora legato al vecchio nome (vedi §5).                                                                                                                                                                                                              |
| M3-05 | Info    | Un processo `wrangler dev` (PID 1258785, avviato 3 h fa dalla vecchia cartella `/home/frank/meet-roulette`, oggi inesistente) è rimasto in esecuzione. Non è stato toccato; può confliggere con le porte degli E2E.                                                   |
| R-01  | Rischio | `0004` (ricostruzione di `activity_events`) non è mai stata applicata a un D1 remoto. Ogni nuovo tipo di evento richiede un'altra ricostruzione (il `CHECK` sull'elenco dei tipi non è modificabile): v. piano, D5.                                                   |
| R-02  | Rischio | Un solo browser (Chromium), nessun screen reader reale, nessuna CI eseguita su M2.5 (limiti già dichiarati in M2.5).                                                                                                                                                  |

Nessun P0/P1 trovato nel codice esistente.

## 7. Dipendenze da servizi remoti

Solo **Cloudflare Workers + D1** (runtime e dati) e **Cloudflare Access** (identità). Nessun servizio AI, e-mail, analytics, font o script esterni (la CSP lo impone: `default-src 'self'`). Nessuna dipendenza da aggiungere per M3.

## 8. Accessibilità e responsività (stato)

La modale ha già: focus trap e ripristino, Esc, etichette, `forceMount` + `hidden` per i pannelli inattivi (M25-01), aree di tocco ≥ 44 px verificate a 390 px, axe sulle schede, `prefers-reduced-motion`. Limiti noti: nessun lettore di schermo reale, un solo browser.

## 9. Baseline dei test

Eseguita su `d931ff6` con albero pulito (modifiche M3.0 messe da parte), 2026-11-05:

| Controllo                                                                                             | Esito                                               |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `pnpm check` (typecheck, lint, format, contrasto, config, `db:check`, `db:upgrade-test`, test, build) | ✅ exit 0                                           |
| Unit + integrazione                                                                                   | ✅ 472 (shared 17 · schemas 43 · web 106 · api 306) |
| E2E su stack reale (`pnpm test:e2e`)                                                                  | ✅ 117/117 (8,1 min)                                |
| Anteprima di produzione (`pnpm test:preview`)                                                         | ✅ 11/11                                            |

Coincide con i numeri dichiarati in `docs/m25`. Nessun blocco nella baseline. Un primo `pnpm check` (exit 0) si era sovrapposto alle mie modifiche ed è stato scartato come baseline.
