# Deployment

**Stato:** canonico · **Aggiornato:** 2026-11-21 · Decisione: [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md).

## Stato

Jobward gira **solo in locale**. Non esistono staging, produzione né D1 remoto, e la pubblicazione è fuori dal ciclo corrente per scelta del proprietario.

| Ambiente       | Esiste? | Note                                                                                                |
| -------------- | ------- | --------------------------------------------------------------------------------------------------- |
| Locale dev     | sì      | `pnpm dev`, D1 locale in `apps/api/.wrangler/state`                                                 |
| Locale preview | sì      | build di produzione servita localmente (`wrangler dev --env preview`), usata da `pnpm test:preview` |
| Staging        | no      | strumenti rimossi in v1                                                                             |
| Produzione     | no      | `wrangler.jsonc` di livello principale inerte e fail-closed (D1 segnaposto, Access vuoto)           |

## Quando si vorrà pubblicare

Il lavoro già fatto è recuperabile dalla storia git di `main` (`c007e53`):

- wrapper protetto `scripts/staging.mjs` con approvazioni a scadenza, inventario verificato e token dedicato, più i suoi test;
- runbook M4.0.1 e audit M4.0, nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md));
- autenticazione Cloudflare Access già implementata e testata nel Worker ([authentication](../architecture/authentication.md)).

Prima di pubblicare con dati reali servono: una strategia di migrazioni incrementali a partire dalla base `0000_jobward_v1`, rate limiting (H-02), backup verificati e cancellazione dell'account (H-05), decisione sull'autenticazione (H-07). Voci in [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md#stream-h--platform--sustainability).
