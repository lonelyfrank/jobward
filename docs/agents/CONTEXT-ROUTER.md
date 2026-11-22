# Context Router (L1)

**Stato:** canonico. Indica **quali documenti aprire** per ogni attività. Sempre, prima di tutto: [AGENTS.md](../../AGENTS.md) (L0) e [CURRENT-CONTEXT](CURRENT-CONTEXT.md) (L3). Poi solo la voce pertinente: **Leggi** subito, **Se serve** solo se non basta, **Codice** come punto di partenza. **Prima di modificare codice**, leggi la riga del sottosistema in [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md): dipendenti, test, invarianti e documenti da aggiornare.

Percorsi: `W` = `apps/web/src`, `A` = `apps/api/src`, `S` = `packages/shared/src`.

- **Frontend / UI** — Leggi: [FRONTEND](../architecture/FRONTEND.md), specifica dell'area in [features](../features/INDEX.md) · Se serve: [COMPONENTS](../ux/COMPONENTS.md), [design system](../ux/design-system.md) · Codice: `W/routes`, `W/features/<area>`
- **UX / design** — Leggi: [PRODUCT-PRINCIPLES](../product/PRODUCT-PRINCIPLES.md), specifica dell'area · Se serve: [design system](../ux/design-system.md), [PERSONAS](../product/PERSONAS.md), [USER-JOURNEYS](../product/USER-JOURNEYS.md) · Codice: `W/components/ui`, `W/styles`
- **Guida utente / testi dell'interfaccia** — Leggi: [docs/user](../user/README.md), [FRONTEND](../architecture/FRONTEND.md#mappa-delle-rotte) · Se serve: [PRODUCT-PRINCIPLES](../product/PRODUCT-PRINCIPLES.md) · Codice: `W/layouts/nav.ts`, `W/routes`
- **API** — Leggi: [API-CONTRACTS](../architecture/API-CONTRACTS.md), [BACKEND](../architecture/BACKEND.md) · Se serve: [SECURITY](../architecture/SECURITY.md) · Codice: `A/modules`, `packages/schemas/src`
- **Database / migrazioni** — Leggi: [DATA-MODEL](../architecture/DATA-MODEL.md), [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md) (schema) · Se serve: [database.md](../architecture/database.md) (convenzioni), [SECURITY](../architecture/SECURITY.md), [ADR-0007](../architecture/decisions/0007-database-tenant-isolation.md), [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md) · Codice: `packages/database`
- **Regole di dominio (pipeline, candidature, attività)** — Leggi: [WORKFLOWS](../features/WORKFLOWS.md), [APPLICATIONS](../features/APPLICATIONS.md) · Se serve: [DOMAIN-GLOSSARY](../product/DOMAIN-GLOSSARY.md) · Codice: `S/`
- **Smart Workspace / viste / filtri** — Leggi: [SMART-VIEWS](../features/SMART-VIEWS.md), [motore di query](../architecture/smart-query-engine.md) · Se serve: [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md) · Codice: `S/smart-query.ts`, `A/services/query-sql.ts`
- **Nuova funzione** — Leggi: [CORE](../product/CORE.md) §8, voce in [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md), specifica dell'area, [TUTORIAL-FEATURE](../development/TUTORIAL-FEATURE.md) · Se serve: [scope policy](../roadmap/scope-policy.md), [DEPENDENCIES](../roadmap/DEPENDENCIES.md), [PRODUCT-VISION](../product/PRODUCT-VISION.md)
- **Bugfix** — Leggi: specifica dell'area, [TESTING](../development/TESTING.md) · Se serve: documento di architettura dell'area · Codice: test esistente più vicino al difetto
- **Test** — Leggi: [TESTING](../development/TESTING.md), [COMMANDS](../development/COMMANDS.md), colonna «Test» di [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md) · Codice: `apps/api/test`, `apps/web/e2e`
- **Sicurezza** — Leggi: [SECURITY](../architecture/SECURITY.md), [authentication](../architecture/authentication.md) · Codice: `A/middleware`
- **Deployment (fuori ciclo)** — Leggi: [DEPLOYMENT](../development/DEPLOYMENT.md), [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)
- **Pianificazione / priorità** — Leggi: [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) (indice), [CURRENT-STATE](../status/CURRENT-STATE.md) · Se serve: [milestones](../roadmap/milestones.md), [IMPLEMENTATION-PLAN](../roadmap/IMPLEMENTATION-PLAN.md)
- **Stato di una funzione** — Leggi: la riga per ID in [FEATURE-MATRIX](../status/FEATURE-MATRIX.md) · Se serve: la voce della [roadmap](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md)
- **Domande di prodotto** — Leggi: [CORE](../product/CORE.md), [PRODUCT-VISION](../product/PRODUCT-VISION.md) · Se serve: [GAP-ANALYSIS](../status/GAP-ANALYSIS.md)
- **Documentazione** — Leggi: [INDEX](../INDEX.md), [MEMORY-SYSTEM](MEMORY-SYSTEM.md) · Se serve: [PID-01-REPORT](../status/PID-01-REPORT.md), [AUDIT-REPORT](../status/AUDIT-REPORT.md)

## Come leggere documenti lunghi

- **Roadmap:** leggi l'indice iniziale; poi cerca la voce (`grep -n "### B-03" docs/roadmap/MASTER-FUNCTIONAL-ROADMAP.md`) e leggi solo quella sezione.
- **FEATURE-MATRIX:** cerca per ID (`grep -n "COM-01" docs/status/FEATURE-MATRIX.md`) invece di leggere tutte le tabelle.
- **CHANGE-IMPACT:** cerca il sottosistema (`grep -n "Pipeline e candidature" docs/architecture/CHANGE-IMPACT.md`).
- **Storia:** i report delle milestone non sono nella repository ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); non cercarli. Limiti di dimensione: `pnpm check:docs`.
