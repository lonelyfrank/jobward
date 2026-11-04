# M0.H — Audit di sicurezza

Metodo: lettura del codice → **sonde** (test esplorativi che registrano il comportamento senza darne per scontato l'esito) → correzione → test di regressione → **mutation check** (si rompe di proposito il controllo e si verifica che il test fallisca). I rinvii a `H-xx`/`R-xx` sono nel [registro](issue-register.md).

## B1. Cloudflare Access

| Verifica                                | Esito         | Come è provata                                                                                                                                                        |
| --------------------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Firma JWT validata con il JWKS del team | ✅            | `auth.test.ts`: token firmato con altra chiave → 401                                                                                                                  |
| Algoritmo fissato a RS256               | ✅            | `security-hardening.test.ts`: HS256 con stesso `kid` e `alg: none` → 401 (algorithm confusion)                                                                        |
| `iss`, `aud`, `exp`                     | ✅            | `auth.test.ts`: ciascuno errato → 401. `nbf` è gestito da `jose` ma **non ha un test dedicato**                                                                       |
| Identità del proprietario               | ✅            | Altro utente autenticato → 403; confronto senza maiuscole/spazi (H-06)                                                                                                |
| Header "email" e cookie non sono fidati | ✅            | `auth.test.ts`: solo il JWT conta                                                                                                                                     |
| Token falsificati / malformati          | ✅            | 401 senza rivelare il motivo (`jwks`, `signature`, `expired` assenti dal corpo)                                                                                       |
| Configurazione incompleta → fail-closed | ✅            | Variabili vuote, **assenti**, dominio non valido → 500 `auth_misconfigured`; provato anche sul Worker reale (sotto)                                                   |
| Rotazione chiavi / cache JWKS           | ✅ (simulata) | Test con `fetch` simulato: scarica da `https://<team>/cdn-cgi/access/certs`, usa la cache, rifiuta una nuova chiave entro il cooldown di 30 s, la accetta dopo (R-05) |
| JWKS non raggiungibile                  | ✅            | Rete assente / 500 / JWKS invalido → 401, senza dettagli (non distinguibile da "non autenticato": R-05)                                                               |
| `AUTH_MODE=dev` isolato                 | ✅            | Richiede `ENVIRONMENT=development` **e** hostname di loopback                                                                                                         |

**Guardia dev e proxy/hostname non attendibili.** L'hostname è letto da `new URL(request.url)`, non da header. Provati: `127.0.0.1`, `[::1]`, `LOCALHOST` ✅ ammessi; `localhost.evil.com`, `evil.localhost`, `0.0.0.0`, un dominio pubblico → 500, **anche con `Host: localhost` e `X-Forwarded-Host: localhost` falsificati**. Sul bordo Cloudflare la richiesta è instradata per hostname, quindi un client non può presentarsi come `localhost` verso il dominio dell'app.

**Configurazione di produzione reale in esecuzione locale** (livello superiore di `wrangler.jsonc` su workerd, nessun account):

| Scenario                                                        | Risultato osservato                                                                         |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Non configurata: `/api/v1/me`, `/workspaces`, `/overview`, POST | **500 `auth_misconfigured`** ovunque, anche con header `cf-access-authenticated-user-email` |
| Non configurata: `/api/health`, `/`                             | 200                                                                                         |
| Configurata (valori finti), senza JWT                           | 401                                                                                         |
| Configurata, JWT falso                                          | 401                                                                                         |
| Configurata, solo header email                                  | 401                                                                                         |

Un controllo statico (`pnpm check:config`, in CI) impedisce di indebolire questi invarianti: `AUTH_MODE=access`, `ENVIRONMENT=production`, variabili Access vuote, `workers_dev:false`, `preview_urls:false`, ambienti locali con `database_id` `local-*`.

**Non dichiarato verificato: l'autenticazione dal vivo** (R-01). Vedi la checklist in [cloudflare-readiness.md](cloudflare-readiness.md).

**Scoperta (H-03):** senza `workers_dev:false` il Worker sarebbe raggiungibile anche su `*.workers.dev`, dove **Access non si applica**: gli asset statici sarebbero pubblici. I dati restavano protetti dal JWT nel Worker (difesa in profondità), ma l'ingresso è stato chiuso.

## B2. Autorizzazioni

| Verifica                                        | Esito | Prova                                                                                                                                                                        |
| ----------------------------------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ogni rotta privata richiede autenticazione      | ✅    | **Test che enumera `app.routes`**: ogni rotta registrata sotto `/api/v1` risponde 401 senza credenziali, con ogni metodo. Una rotta aggiunta in M1 è coperta automaticamente |
| Anche i percorsi non registrati sotto `/api/v1` | ✅    | 401 (non 404): non si rivela quali rotte esistono                                                                                                                            |
| Le uniche rotte pubbliche sono dichiarate       | ✅    | Test: `['GET /api/health']`                                                                                                                                                  |
| Appartenenza al workspace                       | ✅    | `requireMembership`; workspace altrui = inesistente → stessa risposta 404 (`ownership.test.ts`)                                                                              |
| ID alterati                                     | ✅    | Percorsi relativi, SQL injection, unicode, NUL, 65 caratteri, parametro duplicato → **400/404, mai 500**                                                                     |
| SQL injection nei dati                          | ✅    | Un nome di workspace con `'); DROP TABLE…` viene salvato come testo; le tabelle esistono ancora                                                                              |
| Isolamento garantito dal **database**           | ✅    | H-01: ora anche il DB rifiuta riferimenti tra workspace (vedi [database-audit.md](database-audit.md))                                                                        |

**Mutation check:** togliendo il controllo `owner`, il controllo di ownership, spostando una rotta fuori dal middleware di auth → i test falliscono.

## B3. CSRF e HTTP

| Verifica                               | Esito               | Dettaglio                                                                                                                                                     |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Type`                         | ✅ (corretto, H-04) | Solo `application/json` esatto (con parametri). `application/jsonx`, `json-patch+json`, `text/plain`, assente → 415                                           |
| `Origin`                               | ✅                  | Diverso → 403; **`null` → 403**; ammessi stessa origine e `APP_ORIGIN`                                                                                        |
| `Sec-Fetch-Site`                       | ✅                  | `cross-site` e `same-site` → 403                                                                                                                              |
| Limite payload                         | ✅                  | 64 KiB: 413 sia con `Content-Length` sia **chunked senza** `Content-Length`                                                                                   |
| CORS                                   | ✅                  | **Nessun** `Access-Control-*`, nemmeno al preflight (`OPTIONS` → 404). Provato anche dal browser (anteprima)                                                  |
| Header di sicurezza API                | ✅ (corretto, H-05) | `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`, CSP `default-src 'none'`, `Cache-Control: no-store`, HSTS; nessun `Server`/`X-Powered-By` |
| Errori                                 | ✅                  | Corpo standard con `requestId`; l'errore interno è generico; nessun dettaglio di stack                                                                        |
| Logging                                | ✅                  | Test: né token, né cookie, né query string, né body, né email nei log (anche per errori imprevisti)                                                           |
| "Il middleware equivale a protezione?" | —                   | No: ciascun controllo ha un test che **fallisce** quando il controllo viene rimosso (mutation check)                                                          |

Limite noto: una richiesta **senza** `Origin` e senza `Sec-Fetch-Site` con JSON valido è accettata (client non browser, es. `curl`). È coerente con il modello: gli attacchi CSRF provengono da browser, che inviano sempre almeno uno dei due.

## B4. CSP e Workers Static Assets

**Domanda:** `public/_headers` funziona con Workers Static Assets (modalità di deploy scelta), non solo con Pages?
**Risposta, verificata su Wrangler 4.157/workerd (emulazione locale):** sì. Wrangler riporta `Parsed 1 valid header rule` e gli header compaiono su pagina, **fallback SPA**, asset, `favicon`, `theme-init.js`. **Le risposte di `/api/*` non ricevono `_headers`**: sono generate dal Worker, che aggiunge i propri (provato).

| Verifica                                                                                       | Esito          | Dettaglio                                                                                                                                             |
| ---------------------------------------------------------------------------------------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header identici a `_headers` su `/`, `/boards`, `/settings`, asset                             | ✅             | `e2e-preview`: il test legge `_headers` e confronta valore per valore                                                                                 |
| `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, HSTS, COOP, Permissions-Policy | ✅             | idem                                                                                                                                                  |
| Routing SPA                                                                                    | ✅             | `/opportunities` → `index.html`                                                                                                                       |
| `/api/*` non ricade nell'HTML                                                                  | ✅             | `/api/v1/non-esiste` → 404 JSON dal Worker con `no-store`                                                                                             |
| Asset reali: tipo MIME, ETag, 304                                                              | ✅             |                                                                                                                                                       |
| **Asset mancante**                                                                             | ❌→✅ **H-02** | Rispondeva `200 text/html` con `Cache-Control: immutable` (1 anno). Rimossa la regola `immutable`                                                     |
| App reale sotto la CSP di produzione                                                           | ❌→✅ **H-10** | Violazione `script-src eval` (Zod JIT) → `jitless`. Dopo: **zero** violazioni e zero errori in console su onboarding, navigazione, menu, tema, drawer |

**CSP — tentativo di irrigidimento (H-09).** Ho provato `style-src 'self'` (+ `style-src-attr 'unsafe-inline'`): l'app reale sotto quella CSP viene bloccata, perché Radix (`react-remove-scroll-bar`) inietta un elemento `<style>` a ogni menu/dialog modale, con contenuto che dipende dalla larghezza della scrollbar → **né hash né nonce sono praticabili** con asset statici. Non si indebolisce la CSP per eliminare errori: si mantiene `style-src 'self' 'unsafe-inline'` (identica a M0) e si **riduce la superficie**: il menu account è ora non modale. `script-src` resta `'self'` senza `unsafe-inline`/`unsafe-eval` (il test lo vieta). Rischio residuo: stili inline iniettabili solo se esistesse un'iniezione HTML, che l'app non ha (nessun `innerHTML`/`dangerouslySetInnerHTML`, output codificato da React, URL utente limitati a http(s)).

**Non verificato sull'edge reale (R-07):** il fallback SPA per richieste che **non** sono navigazioni (in locale risponde HTML a tutto) e la precedenza degli header sul bordo. Test dal vivo in [cloudflare-readiness.md](cloudflare-readiness.md).

## Esito

**0 vulnerabilità P0.** 1 P1 (isolamento nel DB) corretto. Nessuna regressione dei controlli esistenti (tutti i test di M0 restano verdi). **Residui**: R-01 (Access reale), R-03 (rate limiting), R-07 (edge), H-09 (CSP `style-src`).
