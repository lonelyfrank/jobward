# ADR-0001 — Modular monolith in un monorepo leggero

**Stato:** Accettato · **Data:** 2026-11-04

## Contesto

Il prodotto parte come strumento personale e deve poter diventare multiutente. Frontend e backend condividono
contratti (schemi, vocabolari). Il team è una persona; la complessità operativa va minimizzata.

## Decisione

- Un **monolite modulare** su un solo Worker; moduli per risorsa (`modules/`), logica in `services/`, dati in `packages/database`.
- **Monorepo pnpm** con `apps/web`, `apps/api` e tre package interni: `database`, `schemas`, `shared`.
- I package interni esportano **direttamente i sorgenti TypeScript** (nessuno step di build intermedio): Vite, esbuild/Wrangler e Vitest li compilano nativamente.
- Struttura proposta dalla specifica adottata senza variazioni; `routes/` ospita le schermate, `features/` la logica per area.

## Alternative scartate

- **Microservizi/code**: nessuna esigenza reale; moltiplicherebbero deploy, osservabilità e superfici d'attacco.
- **Repo separate per frontend e API**: i contratti Zod condivisi diventerebbero un problema di versionamento.
- **Package con build propria (tsup/tsc)**: più configurazione e rischio di artefatti obsoleti, nessun beneficio a questa scala.

## Conseguenze

Un solo deploy e una sola origine. I confini tra moduli sono per convenzione (non imposti dal compilatore): vanno
difesi in code review. Se un modulo dovesse diventare un servizio, i confini sono già tracciati.
