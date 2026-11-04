# ADR-0006 — Strategia di test e quality gate

**Stato:** Accettato · **Data:** 2026-11-04

## Decisioni

- **Piramide**: molti unit/integrazione veloci, pochi E2E ad alto valore.
- **Integrazione API nel runtime reale** (Miniflare via `@cloudflare/vitest-plugin`) su un D1 con **le migrazioni di produzione**: ciò che si testa è lo schema che verrà distribuito. Niente mock del database.
- **Componenti**: React Testing Library con `fetch` simulato **al confine di rete**, così attraversano client API, validazione delle risposte, router e provider reali. Query per ruolo/etichetta (testano anche l'accessibilità).
- **E2E**: Playwright su stack reale (Vite → Worker → D1 locale), DB ricreato a ogni esecuzione, porte dedicate. `@axe-core/playwright` verifica WCAG 2.x A/AA (+2.2 AA) su ogni schermata in entrambi i temi.
- **I test devono poter fallire**: i controlli di sicurezza sono stati validati con "mutazioni" deliberate (rimozione del controllo owner e di ownership → i test falliscono) e axe è stato verificato su una pagina volutamente scorretta.
- **Anteprima della build di produzione** (M0.H): `pnpm test:preview` esegue gli E2E contro il Worker con **Static Assets** (stessa strada del deploy), per verificare header, CSP reale, fallback SPA e instradamento `/api/*`, che `vite dev` non può mostrare.
- **Quality gate**: typecheck, lint (`--max-warnings=0`, type-aware + jsx-a11y), Prettier, contrasto, `check:config` (invarianti Cloudflare), `db:check` (deriva schema↔migrazioni), test, build, E2E, anteprima. CI su GitHub Actions con action fissate per SHA.
- **Onestà dei risultati**: si riporta solo ciò che è stato eseguito; l'automazione dell'accessibilità non sostituisce l'audit manuale.

## Conseguenze

L'E2E richiede Chromium e ~1 minuto. La CI non è stata eseguita in M0 (nessun remoto configurato): il workflow è verificato solo localmente nei suoi comandi.
