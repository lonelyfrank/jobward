# Comandi

**Stato:** canonico · **Verificato su:** `package.json` di `jobward-v1` (2026-11-21). Tutti dalla radice della repository.

## Sviluppo

| Comando                         | Effetto                                                                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                      | API (`wrangler dev --env dev`, porta 8787) e web (Vite, porta 5174)                                                                       |
| `pnpm dev:api` / `pnpm dev:web` | Separatamente                                                                                                                             |
| `pnpm db:reset:local -- --yes`  | **Cancella** il D1 locale (anche i dati reali) dopo averne copiato lo stato in `apps/api/.wrangler/backups/`, poi riapplica le migrazioni |
| `pnpm db:seed:demo`             | Con l'API avviata, rigenera il solo profilo **Dati demo** (come Impostazioni → Rigenera dati demo)                                        |
| `pnpm db:migrate:local`         | Applica le migrazioni mancanti al D1 locale                                                                                               |
| `pnpm db:generate`              | Nuova migrazione da `packages/database/src/schema.ts`                                                                                     |
| `pnpm format`                   | Prettier in scrittura su tutta la repository (documenti inclusi)                                                                          |
| `pnpm docs:screenshots`         | Con `pnpm dev` avviato: rigenera i Dati demo e salva le schermate della guida in `docs/user/images/` (Chromium di Playwright)             |

## Verifiche

| Comando               | Che cosa verifica                                                                                                                                                                                               | Durata indicativa |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `pnpm typecheck`      | TypeScript strict in tutti i pacchetti                                                                                                                                                                          | 15 s              |
| `pnpm lint`           | ESLint type-aware, react-hooks, jsx-a11y, zero warning                                                                                                                                                          | 35 s              |
| `pnpm format:check`   | Prettier su tutta la repository, **inclusi i Markdown**                                                                                                                                                         | 11 s              |
| `pnpm check:contrast` | Contrasto WCAG dei token, tema chiaro e scuro                                                                                                                                                                   | < 1 s             |
| `pnpm check:docs`     | Limiti di dimensione dei documenti di bootstrap e delle immagini, collegamenti relativi, nessun rimando all'archivio storico ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)) | < 1 s             |
| `pnpm db:check`       | Schema TypeScript coerente con le migrazioni                                                                                                                                                                    | 2 s               |
| `pnpm test`           | Vitest in tutti i pacchetti (API nel runtime Workers su D1 di test)                                                                                                                                             | ~1 min            |
| `pnpm build`          | Build web + dry-run del Worker                                                                                                                                                                                  | ~20 s             |
| `pnpm check`          | Tutto quanto sopra                                                                                                                                                                                              | ~2–3 min          |
| `pnpm test:e2e`       | Playwright sullo stack di sviluppo (porte 5199/8799, DB ricreato in `.e2e-state`)                                                                                                                               | ~20 min           |
| `pnpm test:preview`   | Playwright sulla build di produzione: header, CSP, fallback SPA                                                                                                                                                 | ~40 s             |

Rimossi con [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md): `staging:*`, `build:staging`, `check:config`, `check:brand`, `test:identity`, `db:upgrade-test`, `test:search:d1` (recuperabili dalla storia git).

## Comandi per agenti (lettura economica)

| Bisogno                    | Comando                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| Stato git sintetico        | `git status --short && git log -3 --oneline`                                 |
| Trovare un simbolo         | `grep -rn "nomeSimbolo" apps packages --include=*.ts --include=*.tsx`        |
| Rotte API                  | `grep -rn "\.\(get\|post\|patch\|put\|delete\)(" apps/api/src/modules`       |
| Solo il riepilogo dei test | `pnpm test > /tmp/t.log 2>&1; grep -E "Test Files\|Tests \|FAIL" /tmp/t.log` |
| Un solo file di test API   | `pnpm --filter @jobward/api exec vitest run test/<file>.test.ts`             |

Vitest scrive gli errori su stderr: per salvare tutto in un file usare `> file 2>&1` (non `2>&1 > file`). Non troncare l'output di un comando fallito prima di aver letto l'errore completo.
