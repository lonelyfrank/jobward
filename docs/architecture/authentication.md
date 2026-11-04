# Autenticazione e autorizzazione

> Decisione formale: [ADR-0003](decisions/0003-authentication-strategy.md).

## Sintesi

| Fase      | Meccanismo                                                                                    | Stato        |
| --------- | --------------------------------------------------------------------------------------------- | ------------ |
| **M0–M4** | Accesso privato del proprietario tramite **Cloudflare Access**; il Worker **verifica il JWT** | Implementato |
| **M5**    | Account pubblici con sessioni proprie (libreria compatibile con Workers/D1 da valutare)       | Non iniziato |

Il modello dati è già multiutente (`users`, `workspaces`, `workspace_members`) e ogni endpoint dati passa dal
controllo di appartenenza: il passaggio a M5 **sostituisce il modo di stabilire l'identità**, non il modello di
autorizzazione.

## Perché non un login "fatto in casa" in M0

Una password condivisa o un token statico sarebbero una scorciatoia destinata a restare nel prodotto, esattamente
ciò che la specifica vieta. Cloudflare Access offre MFA, provider di identità, revoca delle sessioni, durata
configurabile e log di accesso senza codice nostro da mantenere o attaccare, e protegge **anche** gli asset statici.
Il costo è la dipendenza da Cloudflare, già presupposta dallo stack.

## Flusso in produzione (`AUTH_MODE=access`)

```mermaid
sequenceDiagram
  participant B as Browser
  participant A as Cloudflare Access
  participant W as Worker
  participant D as D1
  B->>A: GET https://app… (nessuna sessione)
  A-->>B: login (IdP / OTP) e cookie CF_Authorization
  B->>A: GET /api/v1/me (con cookie)
  A->>W: richiesta + header Cf-Access-Jwt-Assertion (JWT RS256)
  W->>W: verifica firma (JWKS del team), iss, aud, exp; email == OWNER_EMAIL
  W->>D: trova o crea l'utente (email minuscola)
  W-->>B: 200 { user, workspaces }
```

Il Worker non si fida mai di header "email", cookie o altro: **solo del JWT validato**. Algoritmo fissato a RS256.

## Modello delle minacce

| Minaccia                                              | Difesa                                                                                                      | Test                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| Richiesta senza identità                              | 401 `unauthenticated`                                                                                       | `auth.test.ts`                          |
| Header email/cookie falsificati                       | Ignorati: serve il JWT firmato                                                                              | `auth.test.ts`                          |
| JWT con chiave, audience, emittente o scadenza errati | 401, senza rivelare il motivo                                                                               | `auth.test.ts`                          |
| Altro utente dello stesso team Access                 | 403: l'email deve coincidere con `OWNER_EMAIL`                                                              | `auth.test.ts`                          |
| Configurazione mancante o incoerente                  | **Fail-closed**: 500 `auth_misconfigured` (mai accesso)                                                     | `auth.test.ts`                          |
| Modalità `dev` raggiunta in produzione                | Rifiutata se `ENVIRONMENT≠development` **o** se l'hostname non è di loopback                                | `auth.test.ts`                          |
| Accesso ai dati di un altro workspace                 | `requireMembership`; risposta **identica** a "inesistente" (404) per non rivelarne l'esistenza              | `ownership.test.ts`                     |
| CSRF (il cookie di Access è inviato in automatico)    | JSON obbligatorio (415), `Origin` e `Sec-Fetch-Site` verificati (403), nessun CORS concesso                 | `workspaces.test.ts`, E2E               |
| Payload abusivi                                       | Limite 64 KiB (413), validazione Zod rigorosa (400)                                                         | `workspaces.test.ts`                    |
| Fuga di informazioni negli errori e nei log           | Errori generici con `requestId`; i log non contengono header, cookie, token, query string o body            | `workspaces.test.ts`, `logging.test.ts` |
| XSS                                                   | React codifica l'output; nessun `dangerouslySetInnerHTML`; URL utente limitati a `http(s)`; CSP restrittiva | `schemas.test.ts`, `_headers`           |

### Rischi residui e cosa NON è coperto in M0

- **Rate limiting applicativo**: non implementato. In M0–M4 l'unico utente ammesso è il proprietario autenticato da Access; il rate limiting su login e recupero account appartiene a M5, quando esisteranno endpoint pubblici. (Il codice `rate_limited` è già nel contratto.)
- **Recupero account, revoca sessioni, durata sessioni**: delegati ad Access (M0–M4); da realizzare in M5.
- **CSP**: usa `style-src 'unsafe-inline'` perché Radix/React applicano stili inline. Da stringere con nonce quando possibile.
- La verifica automatica dell'accessibilità e della sicurezza **non sostituisce** un audit manuale prima della release privata (M4).

## Configurazione del deploy privato (non eseguita in M0)

1. Creare il database: `wrangler d1 create meet-roulette` e inserire l'`database_id` in `wrangler.jsonc`.
2. Applicare le migrazioni in remoto: `wrangler d1 migrations apply DB --remote --env ""`.
3. In Cloudflare Zero Trust creare un'**applicazione self-hosted** sul dominio del Worker con una policy che ammetta **solo** l'email del proprietario.
4. Impostare in `wrangler.jsonc` (default): `ACCESS_TEAM_DOMAIN` (`<team>.cloudflareaccess.com`), `ACCESS_AUD` (audience tag dell'applicazione), `OWNER_EMAIL`. Non sono segreti, ma sono specifici dell'account.
5. Costruire e distribuire: `pnpm build` poi `wrangler deploy --env ""`.
6. Verificare: senza login → redirect ad Access; con token non valido → 401; con un altro account → bloccato da Access e, in ogni caso, 403 dal Worker.

> Il deploy richiede autorizzazione esplicita: non fa parte di M0.

## Evoluzione verso M5 (account pubblici)

Requisiti elencati nella specifica: account personali, sessioni sicure (cookie HttpOnly/Secure/SameSite), CSRF,
recupero account, rate limiting, revoca sessioni. La scelta della libreria andrà fatta con una valutazione
(compatibilità Workers/D1, manutenzione, hashing con Web Crypto) e un nuovo ADR. Candidati da valutare, senza
decisione presa: Better Auth, soluzione basata su sessioni custom su D1 (pattern Lucia, ora deprecata come libreria).
Il `middleware/auth.ts` espone già un'unica funzione `authenticate(deps)` che risolve `{id, email}`: sostituirla non
tocca moduli e servizi.
