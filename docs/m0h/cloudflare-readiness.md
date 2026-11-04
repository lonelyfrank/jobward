# M0.H — Readiness per Cloudflare

> **Nessun deploy è stato eseguito. Nessuna credenziale è stata usata né risorsa Cloudflare creata.**
> Tutto ciò che segue è verificato su **Wrangler 4.157 / workerd in locale**, salvo dove indicato.

## 1. Sintesi

| Domanda                                            | Risposta                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| La configurazione di produzione è sicura **oggi**? | Sì, perché **fail-closed**: senza variabili Access ogni rotta dati risponde 500 `auth_misconfigured` (provato su workerd) |
| È pronta per un deploy?                            | **No**: mancano database reale, dominio/route, applicazione Access e valori delle variabili (§3)                          |
| L'autenticazione live è verificata?                | **No.** Solo simulata. Vedi la checklist di collaudo (§5)                                                                 |
| "Production ready"?                                | **Non lo dichiaro.** Test locali verdi ≠ collaudo su Cloudflare                                                           |

## 2. Configurazione pronta (verificata in locale)

| Elemento                                  | Stato | Verifica                                                                                                                         |
| ----------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------- |
| `wrangler deploy --dry-run`               | ✅    | `pnpm build`: bundle e binding corretti (`DB`, `ASSETS`, variabili), nessun avviso                                               |
| Binding D1 `DB` + `migrations_dir`        | ✅    | Migrazioni `0000`/`0001` applicate in locale con `wrangler d1 migrations apply`, anche su DB con dati                            |
| Asset statici + SPA fallback              | ✅    | Anteprima: `/boards` → `index.html`; `not_found_handling: single-page-application`                                               |
| Instradamento API                         | ✅    | `run_worker_first: ["/api/*"]`: le API passano dal Worker, gli asset **non** invocano il Worker; `/api/x` sconosciuto → JSON 404 |
| `_headers`                                | ✅    | Applicato a pagina, fallback e asset (header identici al file, test automatico). Non alle risposte `/api/*`                      |
| Separazione dev / produzione              | ✅    | Livello superiore = produzione; `env.dev`, `env.preview` solo `development`+`dev`; `check:config` lo impone                      |
| Guardia dev                               | ✅    | Richiede `ENVIRONMENT=development` **e** hostname di loopback: un `wrangler deploy --env dev` accidentale non apre l'accesso     |
| `workers_dev:false`, `preview_urls:false` | ✅    | Evita un ingresso non coperto da Access (H-03). **Richiede un dominio personalizzato**: vedi §3                                  |
| Nessun segreto nel repo                   | ✅    | Le variabili Access sono configurazione (non segreti) e restano **vuote** nel repo; `check:config`                               |
| Fail-closed                               | ✅    | Provato su workerd con la config di produzione non configurata                                                                   |

Anteprima locale della build di produzione: `pnpm test:preview` (ambiente `preview`: stesso Worker + Static Assets, identità di sviluppo, D1 locale).

## 3. Configurazione mancante (da fare al collaudo, non prima)

| Elemento                                          | Dove / come                                                                                                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Database D1 reale                                 | `wrangler d1 create meet-roulette` → sostituire il `database_id` segnaposto (l'invariante `check:config` va aggiornata di conseguenza)                          |
| **Dominio personalizzato**                        | Con `workers_dev:false` il Worker non ha altro indirizzo: aggiungere `routes: [{ "pattern": "app.<tuodominio>", "custom_domain": true }]`                       |
| Applicazione Access (self-hosted)                 | Zero Trust → Access → Applications, sul **solo** hostname dell'app (pagine **e** `/api/*`), policy _Allow_ con l'email del proprietario, durata sessione scelta |
| `OWNER_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | `ACCESS_AUD` = "Application Audience (AUD) Tag" dell'app; `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`. Non sono segreti                                |
| Migrazioni remote                                 | `wrangler d1 migrations apply DB --remote --env ""` (su database nuovo la guardia di 0001 è soddisfatta)                                                        |
| Regola di rate limiting (WAF) su `/api/*`         | Misura provvisoria finché l'app non ha rate limiting (R-03)                                                                                                     |
| Backup                                            | D1 Time Travel + export pianificato (vedi `docs/architecture/database.md`); **prova di ripristino** prima di avere dati reali                                   |
| HSTS a livello di zona                            | L'app invia `max-age=31536000`; valutare `includeSubDomains`/preload a livello zona solo se tutto il dominio è HTTPS                                            |

## 4. Strategia dei domini

**Un solo hostname** per frontend e API (es. `app.<dominio>`): stessa origine → **nessun CORS**, cookie di Access non condivisi con altri siti, un'unica applicazione Access da mantenere. Non creare un sottodominio separato per l'API. Disattivati `*.workers.dev` e gli URL di anteprima. Un ambiente di staging, se servirà, deve avere un **proprio** hostname, un proprio D1 e una **propria** applicazione Access (`ACCESS_AUD` diverso).

## 5. Checklist di collaudo su Cloudflare reale

Da eseguire **dopo** un deploy autorizzato. Segnare data, esito e screenshot/log; nessun test deve usare dati reali.

**Accesso (R-01)**

- [ ] Senza sessione, `GET https://app.<dominio>/` → redirect al login di Access (non l'HTML dell'app).
- [ ] Senza sessione, `GET /api/v1/me` → redirect/blocco di Access (mai dati). Anche `GET /api/health` è dietro Access (l'intero hostname è protetto): un monitor esterno richiederebbe un **service token** o una policy dedicata — decisione da prendere prima di attivare un monitoraggio.
- [ ] Con l'account proprietario: l'app si carica, `GET /api/v1/me` → 200 con la propria email.
- [ ] Con un **altro** account (anche se l'IdP lo consente): bloccato da Access; se si forza l'accesso del Worker con un JWT dell'altro utente → 403.
- [ ] L'header `Cf-Access-Jwt-Assertion` arriva al Worker; `aud` è un array con `ACCESS_AUD`; il claim `email` è presente (se manca il Worker risponde 401: verificarlo).
- [ ] Un JWT con `aud` di **un'altra** applicazione Access dello stesso team → 401.
- [ ] `https://<worker>.workers.dev` e un URL di anteprima → **non raggiungibili**.
- [ ] Rotazione delle chiavi: documentare quando Cloudflare ruota (il test locale simula 30 s di cooldown); verificare che dopo la rotazione un nuovo JWT sia accettato.
- [ ] Sessione scaduta durante l'uso: osservare cosa fa il `fetch` (redirect cross-origin → errore di rete). Verificare che il messaggio "ricarica la pagina" appaia e che il ricaricamento riporti al login (**H-22**).
- [ ] Logout/revoca della sessione Access: l'app perde l'accesso entro la durata prevista.

**Header e routing sull'edge (R-07)**

- [ ] `/`, `/boards` (deep link), un asset, `/favicon.svg`: `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy`, `Strict-Transport-Security`, `Permissions-Policy`, `Cross-Origin-Opener-Policy` come in `_headers`.
- [ ] `/assets/inesistente.js`: **non** `Cache-Control: immutable`. Annotare cosa risponde l'edge a richieste **non** di navigazione (in locale risponde HTML a tutto).
- [ ] `/api/v1/non-esiste` → JSON 404 dal Worker, con `Cache-Control: no-store`.
- [ ] L'app si carica **senza violazioni CSP** (console del browser) con un account reale.
- [ ] Gli asset con hash restituiscono `ETag` e `304` alla richiesta condizionale.

**Protezioni HTTP**

- [ ] `POST /api/v1/workspaces` con `Origin` di un altro sito → 403; con `Content-Type: text/plain` → 415.
- [ ] Nessun `Access-Control-Allow-*` in alcuna risposta.

**Dati**

- [ ] Onboarding: creazione del workspace, refresh, il dato persiste (D1 remoto); una seconda creazione → 409.
- [ ] `wrangler d1 migrations list DB --remote`: `0000` e `0001` applicate.
- [ ] Time Travel: ripristino di prova a un istante precedente.

**Osservabilità**

- [ ] I log (observability) contengono `requestId`, metodo, percorso e status; **nessun** token, cookie, query string, email.

## 6. Cosa si può eseguire in locale / cosa richiede Cloudflare

| Test                                                            |    Locale    |  Richiede Cloudflare  |
| --------------------------------------------------------------- | :----------: | :-------------------: |
| Verifica JWT, `iss`/`aud`/`exp`, algoritmi, fail-closed         |      ✅      |                       |
| Rotazione chiavi (simulata) e indisponibilità JWKS              |      ✅      | _comportamento reale_ |
| Header applicati da Static Assets, CSP reale, fallback SPA      | ✅ (workerd) |     _edge reale_      |
| Migrazioni su D1 (anche con dati)                               |      ✅      |       D1 remoto       |
| Config di produzione fail-closed                                |      ✅      |                       |
| Redirect e login di Access; policy; sessione/revoca             |              |          ✅           |
| JWKS reale e claim reali del JWT                                |              |          ✅           |
| `workers_dev` disattivato; dominio personalizzato; HSTS di zona |              |          ✅           |
| Time Travel e backup                                            |              |          ✅           |

## 7. Limiti della piattaforma da tenere presenti

- **D1** non ha transazioni interattive: si usano `batch()` e SQL con condizioni (già nel design). Le FK sono sempre applicate; `PRAGMA foreign_keys` non è utilizzabile nelle migrazioni (da qui la scrittura a mano di 0001).
- **Static Assets**: le risposte degli asset ricevono `_headers`; quelle del Worker no. Con `run_worker_first: ["/api/*"]` solo le chiamate API consumano invocazioni del Worker.
- **Workers**: `eval`/`new Function` non sono consentiti (per questo `jitless` di Zod è coerente anche lato Worker).
- Il Worker **non** ha accesso al filesystem: i file di configurazione non si leggono a runtime.
