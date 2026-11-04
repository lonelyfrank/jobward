# M0.H — Baseline della repository

**Branch di partenza:** `m0-foundation` @ `c315096` · **Branch di lavoro:** `m0h-hardening` · **Data:** 2026-11-04
**Ambiente:** Fedora 44, Node 22.23.1, pnpm 12.15.0, Playwright Chromium (build di fallback ubuntu24.04).

Obiettivo: verificare le affermazioni di `docs/roadmap/m0-delivery.md` **sullo stato effettivo del codice**, prima di qualunque modifica.

## 1. Procedura

`node_modules` di root e dei package sono stati **eliminati** insieme agli artefatti di build, poi: `pnpm install --frozen-lockfile` e ciascun controllo, uno per uno, con exit code e log salvati. Nessuna modifica al codice prima del completamento della baseline.

## 2. Risultati reali

| Controllo                        | Esito | Dettaglio                                                                  |
| -------------------------------- | ----- | -------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | ✅    | Lockfile coerente con i `package.json`; nessun avviso bloccante            |
| `pnpm typecheck`                 | ✅    | 5 package, 0 errori (11 s)                                                 |
| `pnpm lint`                      | ✅    | 0 errori, 0 warning (15 s)                                                 |
| `pnpm format:check`              | ✅    |                                                                            |
| `pnpm check:contrast`            | ✅    | 38 coppie (19 per tema)                                                    |
| `pnpm test`                      | ✅    | **101** test: shared 5 · schemas 24 · web 26 · api 46. Nessun test saltato |
| `pnpm build`                     | ✅    | Frontend + dry-run del Worker. Warning Vite: chunk > 500 kB                |
| `pnpm test:e2e`                  | ✅    | **11** passati, 0 saltati, 0 flaky (40 s)                                  |

### Confronto con le affermazioni del report M0

| Affermazione                          | Verificata? | Nota                                                                                           |
| ------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| 101 test unit/integrazione/componenti | ✅          | Esattamente 101                                                                                |
| 11 E2E                                | ✅          | Esattamente 11                                                                                 |
| Typecheck, lint, build, contrasto     | ✅          |                                                                                                |
| Bundle JS ≈ 645 kB, **≈ 170 kB gzip** | ⚠️ parziale | Raw 645,17 kB corretto. **gzip reale: 201,32 kB** (Vite). Il "170" era errato → issue **H-18** |
| `_headers` "non verificato"           | ✅ onesta   | Verificato in M0.H (vedi `security-audit.md`)                                                  |
| CI "non eseguita"                     | ✅ onesta   | Resta non eseguita (nessuna run su GitHub: `gh run list` vuoto)                                |

## 3. Struttura e configurazione esaminate

| Area                | Osservazioni                                                                                                                                                                              |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Monorepo pnpm       | `apps/{web,api}` + `packages/{database,schemas,shared}`; `catalog` per le versioni condivise; package interni come sorgenti TS; `allowBuilds` limitato a `esbuild`, `workerd`             |
| TypeScript          | `strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`. `schemas` con `lib` esplicita (corretto in M0)                                                           |
| Vite / Vitest       | Proxy `/api` configurabile; test jsdom; `css: false`                                                                                                                                      |
| Wrangler            | Produzione al livello superiore (fail-closed); ambiente `dev`; `database_id` segnaposto. **Assenti**: `workers_dev:false`, ambiente per l'anteprima della build                           |
| Schema D1 / Drizzle | 13 tabelle, CHECK, FK, `workspace_id` ovunque. **FK semplici**: nessuna garanzia sull'appartenenza allo stesso workspace (→ H-01)                                                         |
| Schemi Zod          | Validazione per tutte le entità; URL limitati a http(s); campi personalizzati tipizzati                                                                                                   |
| Middleware Hono     | request-id, log, header, CSRF, limite payload, auth, errori                                                                                                                               |
| Frontend            | Router con `WorkspaceGate`/`AppShell`; componenti UI Radix; token semantici                                                                                                               |
| Test                | API nel runtime Workers su migrazioni reali; RTL con fetch simulato; Playwright + axe                                                                                                     |
| CI                  | Un workflow; action `@v4` non fissate; nessuna run; nessun controllo di deriva schema↔migrazioni                                                                                          |
| Dipendenze          | `pnpm audit`: **0 vulnerabilità in produzione**; 2 "moderate" solo in dev (minimatch via typescript-eslint, esbuild vecchio in drizzle-kit). Nessuna dipendenza dichiarata e inutilizzata |

## 4. Come riprodurre

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules apps/web/dist apps/api/dist
git checkout m0-foundation
pnpm install --frozen-lockfile
pnpm typecheck && pnpm lint && pnpm format:check && pnpm check:contrast && pnpm test && pnpm build && pnpm test:e2e
```

## 5. Limiti della baseline

Un solo ambiente (Linux, Chromium). Il lockfile è stato risolto con la cache locale dello store pnpm: la baseline non prova l'installazione da registry freddo.
