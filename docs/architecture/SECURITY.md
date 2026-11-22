# Sicurezza e privacy (stato reale)

**Stato:** canonico per la sintesi delle misure in vigore · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Dettaglio dell'autenticazione e del modello delle minacce: [authentication.md](authentication.md). Isolamento: [ADR-0007](decisions/0007-database-tenant-isolation.md). Gli audit storici (M0.H, stabilizzazione M3, M4.0.1) sono nell'archivio storico non pubblicato ([ADR-0018](decisions/0018-launch-repository-and-docs-archive.md)).

## Identità e accesso

| Aspetto               | Implementazione                                                                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Uso attuale           | **Solo locale** ([ADR-0017](decisions/0017-local-v1-baseline.md)): gli ambienti effettivamente usati (`dev`, `preview`, test) girano con `AUTH_MODE=dev`, senza token. Access è implementato ma mai configurato. |
| Identità (produzione) | **Cloudflare Access.** Il Worker verifica `cf-access-jwt-assertion` (RS256, JWKS del team, issuer e audience) in `apps/api/src/lib/access.ts`.                                                                   |
| Autorizzazione        | Ammessa solo l'email uguale a `OWNER_EMAIL`, altrimenti 403 (`middleware/auth.ts`). Dominio del team vincolato a `*.cloudflareaccess.com`.                                                                       |
| Modalità dev          | `AUTH_MODE=dev` con identità fissa, accettata solo con `ENVIRONMENT=development` su loopback.                                                                                                                    |
| Fail-closed           | Con variabili di produzione vuote ogni richiesta è rifiutata (`auth_misconfigured`); verificato dai test (`test/auth.test.ts`); lo script `check:config` è stato rimosso in v1.                                  |
| Sessioni              | Nessuna sessione né cookie applicativo: il cookie di Access vive all'edge Cloudflare. Nessun logout nell'app.                                                                                                    |
| Provisioning          | La riga `users` è creata alla prima richiesta autenticata.                                                                                                                                                       |

## Protezioni dell'API

- **CSRF** (`middleware/guards.ts`) su metodi non sicuri: `Content-Type` esattamente `application/json` (415), `Origin` uguale all'origine dell'API o ad `APP_ORIGIN`, `Sec-Fetch-Site` same-origin o none.
- **Limite del corpo:** 64 KiB.
- **CORS:** mai concesso (un'unica origine).
- **Header:** CSP `default-src 'none'; frame-ancestors 'none'` per l'API, CORP same-origin, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, `x-request-id` (`middleware/request.ts`). La SPA ha la sua CSP in `apps/web/public/_headers`, verificata dalla suite preview.
- **Log:** metodo, percorso, stato e durata; gli errori sconosciuti solo per nome. Nessun testo riservato.
- **Rate limiting:** **assente** (codice `rate_limited` definito ma non usato). Accettabile per un solo utente dietro Access; necessario prima della multiutenza (M5).

## Isolamento dei dati

1. `workspaceScope` verifica la membership in un solo punto; workspace altrui → 404.
2. I servizi prendono `workspaceId` dal contesto e filtrano ogni SQL per `workspace_id`.
3. Il database impedisce riferimenti fra workspace con FK composite e trigger ([DATA-MODEL](DATA-MODEL.md)).
4. Test: `ownership`, `kanban-isolation`, `m2-isolation`, `tenant-integrity`, `security-hardening` (enumera le rotte e verifica che siano protette).

## Segreti e configurazione

Nessun segreto nella repository né nel frontend. `wrangler.jsonc` di produzione contiene un identificativo D1 segnaposto e variabili Access vuote; nessun controllo automatico ne impedisce più le regressioni (`check-config.mjs` rimosso in v1). Nessun ambiente di staging: gli strumenti relativi sono recuperabili dalla storia git ([DEPLOYMENT](../development/DEPLOYMENT.md)). I nomi D1 conservano l'identità storica per non perdere i dati ([ADR-0014](decisions/0014-jobward-technical-rebranding.md)).

## Privacy

- L'app parte vuota. Il profilo **Dati demo** (solo `AUTH_MODE=dev` su loopback) è un'identità distinta (`DEMO_USER_EMAIL`) scelta con l'header `x-jobward-profile: demo`: i dati demo sono isolati da quelli reali con la stessa membership di workspace che separa due utenti. `POST /api/v1/demo/reset` cancella e rigenera **solo** il workspace di quell'identità; con il profilo reale o con Cloudflare Access risponde 404, e un `DEMO_USER_EMAIL` uguale a `DEV_USER_EMAIL` è rifiutato (500, fail closed). Aziende e persone del dataset (`apps/api/src/services/demo.ts`) sono inventate; nessun dato reale è versionato.
- La cronologia non contiene testi riservati (note, feedback): whitelist dei metadati in `packages/shared/src/timeline.ts`.
- Esportazione dei dati: **implementata** in JSON (`GET /api/v1/export`), senza ancora `companies` e `saved_views`. Cancellazione dell'account: **non implementata** (progettata per M5, [database.md](database.md#eliminazione-di-account-e-dati-progettazione-per-m5)). Backup: progettati, non operativi.

## Rischi aperti (sintesi)

Rischi aperti: [piano M4](../roadmap/m4-private-release-plan.md). In sintesi: Access e D1 remoto mai configurati né provati; nessun rate limiting; due advisory moderati della toolchain di sviluppo; nessun backup operativo.

## Requisiti per estensioni future

Ogni integrazione (API pubbliche, MCP, import) dovrà avere: autenticazione per token con ambiti minimi, autorizzazione per workspace, registro delle operazioni con origine, limiti di frequenza, revoca. Vedi Stream F/H della [roadmap](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md).
