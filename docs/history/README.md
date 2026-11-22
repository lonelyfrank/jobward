# Archivio storico

**Stato:** indice · **Decisione:** [ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md). I report delle milestone **non sono più nella repository**. Restano solo nella storia git locale del proprietario, non pubblicata. Per lo stato attuale vedi [CURRENT-STATE](../status/CURRENT-STATE.md); le regole valide sono nel codice e nei documenti canonici ([INDEX](../INDEX.md)).

| Milestone               | Cartella archiviata            | Contenuti                                                                       | Dove vive oggi ciò che vale                                                                                                                                                                        |
| ----------------------- | ------------------------------ | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M0 Foundation           | `docs/roadmap/m0-delivery.md`  | Consegna iniziale                                                               | [ADR-0001](../architecture/decisions/0001-modular-monolith-monorepo.md)–[0006](../architecture/decisions/0006-testing-strategy.md)                                                                 |
| M0.H Hardening          | `docs/m0h/`                    | Audit di sicurezza, database, frontend, readiness Cloudflare                    | [SECURITY](../architecture/SECURITY.md), [database](../architecture/database.md), [ADR-0007](../architecture/decisions/0007-database-tenant-isolation.md)                                          |
| M1 Boards & Cards       | `docs/m1/`                     | Contratti API, ordinamento Kanban, interazioni, accessibilità                   | [BOARDS](../features/BOARDS.md), [ADR-0008](../architecture/decisions/0008-kanban-ordering-and-board-loading.md)                                                                                   |
| M2 Information          | `docs/m2/`                     | Ciclo della candidatura, campi personalizzati, etichette, ricerca, tabella      | [OPPORTUNITIES](../features/OPPORTUNITIES.md), [ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md)–[0011](../architecture/decisions/0011-search-and-table-state.md) |
| M2.5 Modal & Interviews | `docs/m25/`                    | Dominio dei colloqui, modale                                                    | [APPLICATIONS](../features/APPLICATIONS.md), [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md)                                                                  |
| M3 Application Workflow | `docs/m3/`                     | Piano M3, consegne C1–C3, pacchetto Attività, stabilizzazione e registro rischi | [APPLICATIONS](../features/APPLICATIONS.md), [WORKFLOWS](../features/WORKFLOWS.md), [ADR-0014](../architecture/decisions/0014-jobward-technical-rebranding.md)                                     |
| M3.UI.1 / M3.UI.2       | `docs/m3-ui1/`, `docs/m3-ui2/` | Navigazione, ricerca globale, Kanban Glass, screenshot                          | [FRONTEND](../architecture/FRONTEND.md), [kanban-glass](../ux/kanban-glass.md), [design-system](../ux/design-system.md)                                                                            |
| M4.0 / M4.0.1           | `docs/m4/`                     | Audit di readiness dello staging, runbook (sospesi)                             | [DEPLOYMENT](../development/DEPLOYMENT.md), [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)                                                                                        |
| Smart Workspace SW.10   | `docs/roadmap/sw10-*.md`       | Audit e report del backfill `0011` (percorso sostituito da ADR-0017)            | [ADR-0016](../architecture/decisions/0016-smart-workspace-domain.md), [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)                                                              |

## Consultare l'archivio (solo nella copia locale del proprietario)

```bash
git log --oneline -- 'docs/m3/*'          # commit che toccano una cartella archiviata
git show <commit>:docs/m3/plan.md         # contenuto di un file a quel commit
```

Nei documenti, i nomi delle cartelle archiviate (`m1`, `m3/plan`, `M4.0.1`, …) restano come testo, senza collegamento.
