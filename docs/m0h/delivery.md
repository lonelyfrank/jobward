# M0.H — Relazione di consegna

**Branch:** `m0h-hardening` (da `m0-foundation` @ `c315096`) · **Data:** 2026-11-04
**Stato:** pronta per revisione. **Nessun merge, nessun deploy, nessuna PR creata, nessun push.** La decisione finale è del proprietario della repository.

## 1. Sintesi degli interventi

Verificata la baseline (tutti i valori del report M0 confermati, tranne un'inesattezza sul peso gzip), sono stati eseguiti un audit di sicurezza, del database, del frontend, delle prestazioni, della CI e della deployabilità Cloudflare. Ogni difetto è stato **riprodotto** prima di essere corretto e coperto da un test di regressione, che è stato verificato **fallire** sul codice originale.

**Esito complessivo: 0 P0, 1 P1 trovato e corretto, nessuna regressione.**

## 2. Problemi trovati

Dettaglio in [issue-register.md](issue-register.md). **23 voci verificate** (1 P1, 9 P2, 13 P3):

- **P1 — H-01:** il database accettava riferimenti tra workspace diversi (6 associazioni incrociate su 6 sondate; non sfruttabile in M0 perché nessun endpoint scrive in quelle tabelle).
- **P2:** `_headers` rendeva immutabili per un anno anche gli asset **mancanti** (H-02) · Worker raggiungibile su `*.workers.dev` fuori da Access (H-03) · nessun controllo di deriva schema↔migrazioni (H-08) · CI su action obsolete e non fissate (H-07) · drawer che bloccava la pagina passando a desktop (H-11) · focus perso alla chiusura del drawer (H-12) · stato del tema duplicato (H-13) · menu modale con violazione axe (H-15) · CSP `style-src 'unsafe-inline'` (H-09, accettato).
- **P3:** Content-Type permissivo, `X-Frame-Options` incoerente, `OWNER_EMAIL` non normalizzato, violazione CSP da Zod JIT, target touch da 36 px, focus spostato al caricamento in dev, icone schiacciate a 1024 px, SQL di migrazione non applicabile a D1, messaggio su sessione scaduta, **"≈170 kB gzip" errato nel report M0 (reale 201 kB)**, ottimizzazione del bundle, componenti riservati a M1.

## 3. Correzioni effettuate

| Area           | Intervento                                                                                                                                                                                                                                                                         |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database       | Migrazione `0001_tenant_integrity` (FK composite + 5 trigger; `RESTRICT`→`NO ACTION`), scritta a mano per D1 con **guardia** che protegge i dati; `pnpm db:check` contro la deriva                                                                                                 |
| Sicurezza      | `Content-Type` JSON esatto · `X-Frame-Options: DENY` · `OWNER_EMAIL` normalizzato e gestione di `undefined` · `workers_dev`/`preview_urls` disattivati · `_headers` senza `immutable` · Zod `jitless` (zero violazioni CSP) · `pnpm check:config` (invarianti di Cloudflare in CI) |
| Frontend       | Drawer chiuso al passaggio a desktop · focus restituito alla chiusura · tema con store unico · menu account non modale · target 44 px · focus StrictMode-safe · icone e griglia delle statistiche · messaggio su sessione scaduta                                                  |
| Prestazioni    | Onboarding caricato a richiesta + chunk `vendor-react`                                                                                                                                                                                                                             |
| CI             | Action aggiornate (v7/v6) e **fissate per SHA**; `db:check`, `check:config`, E2E di anteprima; `workflow_dispatch`; telemetria Wrangler disattivata                                                                                                                                |
| Strumenti      | Ambiente `preview` + suite di anteprima sulla build di produzione (Static Assets)                                                                                                                                                                                                  |
| Documentazione | `docs/m0h/` (8 file), ADR-0007, aggiornati README, architettura, roadmap e backlog; corretto il peso gzip                                                                                                                                                                          |

## 4. Test eseguiti e risultati (stato finale, eseguiti in questa sessione)

| Controllo                        | Risultato                                                            |
| -------------------------------- | -------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅                                                                   |
| `pnpm typecheck`                 | ✅ 5 package                                                         |
| `pnpm lint --max-warnings=0`     | ✅                                                                   |
| `pnpm format:check`              | ✅                                                                   |
| `pnpm check:contrast`            | ✅ 38 coppie                                                         |
| `pnpm check:config`              | ✅                                                                   |
| `pnpm db:check`                  | ✅                                                                   |
| `pnpm test`                      | ✅ **163** (shared 5 · schemas 24 · web 28 · api 106). Baseline: 101 |
| `pnpm build`                     | ✅ **senza warning** sui chunk                                       |
| `pnpm test:e2e`                  | ✅ **31** (baseline 11) · 0 saltati · 0 flaky                        |
| `pnpm test:preview` _(nuovo)_    | ✅ **8**                                                             |
| `pnpm audit --prod`              | ✅ 0 vulnerabilità · (`pnpm audit`: 2 moderate **solo dev**, R-04)   |

Dettagli e mutation check: [testing-report.md](testing-report.md).

## 5. Risultati verificati rispetto a quelli solo dichiarati

**Verificati con evidenza:** verifica JWT e fail-closed (unit + configurazione di produzione reale su workerd) · isolamento tra workspace nel DB (con test che falliscono senza la migrazione) · aggiornamento di un DB M0 con dati · header e CSP reali servite da Static Assets, zero violazioni nell'app · assenza di CORS · nessun overflow a 5 larghezze · tastiera/focus · axe in chiaro/scuro · prestazioni misurate.
**Non verificati:** Cloudflare Access reale · CI su GitHub · comportamento sull'edge di Static Assets · screen reader · altri browser.

## 6. Prestazioni (metodo: `vite build`, valori riportati da Vite; composizione dalla sourcemap)

| JS iniziale                  | Prima (branch)     | Dopo                                                              | Variazione            |
| ---------------------------- | ------------------ | ----------------------------------------------------------------- | --------------------- |
| Raw                          | 645,66 kB (1 file) | 606,59 kB (`index` 293,24 + `vendor-react` 312,76 + runtime 0,59) | **−39,07 kB (−6,1%)** |
| gzip                         | 201,69 kB          | 188,91 kB                                                         | **−12,78 kB (−6,3%)** |
| Onboarding (solo 1° accesso) | in `index`         | 41,12 kB / 14,73 kB gzip a richiesta                              | —                     |

Composizione prima: react-dom 202 kB (32%), react-router 92 (15%), zod 84 (13%), react-hook-form 33, query-core 32, app 30, tailwind-merge 27. Il warning del chunk > 500 kB è sparito **senza alzare la soglia**. Il guadagno è modesto e va dichiarato tale: ridurlo ancora richiederebbe sostituire Zod con `zod/mini` (~−60 kB, riscrittura degli schemi, **non** a basso rischio). Valore baseline M0 misurato in questa sessione: 645,17 kB / **201,32 kB** gzip.

## 7. Rischi residui

| ID                   | Rischio                                                                        | Sev | Stato                                       |
| -------------------- | ------------------------------------------------------------------------------ | --- | ------------------------------------------- |
| R-01                 | Cloudflare Access reale non provato                                            | —   | 🔵 impedimento ambientale; checklist pronta |
| R-02                 | CI GitHub mai eseguita                                                         | P2  | 🔵                                          |
| R-07                 | Static Assets provato solo in locale (workerd), non sull'edge                  | P2  | 🔵                                          |
| R-03                 | Nessun rate limiting applicativo                                               | P2  | 🟡 M5; WAF nel frattempo                    |
| H-09                 | CSP con `style-src 'unsafe-inline'` (Radix)                                    | P2  | 🟡 accettato, motivato                      |
| R-08                 | Nessuna prova con screen reader; solo Chromium                                 | P2  | 🔵 M4                                       |
| H-22                 | Comportamento alla scadenza della sessione Access da confermare dal vivo       | P3  | 🟡                                          |
| R-04–R-06, R-09–R-11 | Vulnerabilità solo dev, JWKS, trigger fuori da drizzle, un solo browser, M1/M2 | P3  | 🟡 vedi registro                            |

## 8. Stato della CI

**Non verificata.** `gh run list` non mostra alcuna esecuzione: il workflow parte solo su PR o push su `main`. È stato riscritto (action v7/v6 fissate per SHA dopo aver letto i loro `action.yml`; input verificati) e **ogni suo comando** è stato eseguito in locale. Restano non provati: risoluzione delle action, `playwright install --with-deps` su `ubuntu-latest`, tempi. Per verificarla basta aprire una PR da `m0h-hardening` (o fare push, che qui non è stato fatto).

## 9. Stato Cloudflare

Nessun deploy, nessuna risorsa creata. La configurazione di produzione è **fail-closed** e **pronta come configurazione**, ma **non pronta al deploy** (database reale, dominio personalizzato, applicazione Access, variabili). Elenco e checklist di collaudo: [cloudflare-readiness.md](cloudflare-readiness.md).

## 10. Valutazione di merge readiness

| Criterio di accettazione                             | Esito                                                           |
| ---------------------------------------------------- | --------------------------------------------------------------- |
| P0 aperti = 0                                        | ✅ 0                                                            |
| P1 aperti = 0 (o impedimenti ambientali documentati) | ✅ 0 (R-01 è ambientale e documentato; il codice è fail-closed) |
| Nessuna regressione                                  | ✅ tutti i test di M0 restano verdi                             |
| Typecheck, lint, formattazione, build                | ✅                                                              |
| Test unitari, integrazione, E2E                      | ✅ 163 / 31 / 8                                                 |
| Documentazione aggiornata                            | ✅                                                              |
| Sicurezza locale verificata                          | ✅                                                              |
| Limiti del collaudo Cloudflare dichiarati            | ✅                                                              |
| CI verificata **oppure segnalata**                   | ✅ segnalata come **non verificata**                            |

**Giudizio:** il branch soddisfa i criteri di accettazione di M0.H ed è **pronto per la revisione e per il merge in `m0-foundation`** (e da lì verso `main`, a vostra decisione). **Non è "production ready"**: restano da fare il collaudo su Cloudflare e la prima esecuzione della CI. Consiglio di aprire la PR **prima** di fidarsi dei risultati sulla CI e di eseguire la checklist §5 di `cloudflare-readiness.md` al primo deploy privato.

## 11. Raccomandazioni per M1

1. **Valorizzare `workspace_id` in ogni `INSERT`** (le FK composite rifiutano incoerenze): creazione bacheca + colonne da template in un unico `batch()`.
2. Scrivere i **test di M1 sulle invarianti** già presenti (scheda↔colonna↔bacheca↔workspace) invece di duplicarle nel service layer; il service deve però restituire errori chiari (409) alla loro violazione.
3. **Spostamento schede:** implementare e testare l'algoritmo a posizioni con gap (ADR-0004) prima della UI; tenere presente `NO ACTION` sulle colonne.
4. **Drag & drop:** l'alternativa da tastiera/menu è un requisito; riusare gli E2E di tastiera/focus come modello.
5. **Pannello di dettaglio:** il focus management già testato per drawer e menu va esteso (restituzione del focus, trap, Esc).
6. **Modali di conferma** (eliminazione bacheca): usare `Dialog` Radix, tenendo presente che i modali iniettano `<style>` (CSP, H-09) e che la CSP reale è coperta da `test:preview`: aggiungere lì i nuovi flussi.
7. Aprire la **PR** per far girare la CI e correggere subito eventuali differenze.
8. **Tablet:** rivalutare il layout 768–1024 px con il Kanban, la cui larghezza minima sarà il vincolo.
9. Decidere paginazione del carico schede, elenco chiuso di colori/icone, regola del cambio di fase proposto (già nel piano M1).
