# Documentazione di Jobward — indice

**Agenti:** iniziate da [AGENTS.md](../AGENTS.md) e [agents/CONTEXT-ROUTER](agents/CONTEXT-ROUTER.md); non leggete tutto. **Chi usa l'app:** [guida utente](user/README.md). **Chi sviluppa o progetta:** [product/CORE](product/CORE.md), [status/CURRENT-STATE](status/CURRENT-STATE.md), [development/GETTING-STARTED](development/GETTING-STARTED.md).

Legenda: **C** canonico (fonte di verità per il suo argomento) · **⚠** canonico con parti superate (vedi avviso in testa al file).

## Uso dell'applicazione

[README](user/README.md) (installazione, navigazione, limiti) · [USER-GUIDE](user/USER-GUIDE.md) (percorsi passo per passo) · [TROUBLESHOOTING](user/TROUBLESHOOTING.md) (problemi comuni e domande).

## Prodotto — che cosa è e che cosa deve diventare

| Documento                                                                         | Tipo | Contenuto                                       |
| --------------------------------------------------------------------------------- | ---- | ----------------------------------------------- |
| [CORE](product/CORE.md)                                                           | C    | Identità, principi, non-obiettivi               |
| [PRODUCT-VISION](product/PRODUCT-VISION.md)                                       | C    | Il prodotto finito, entità, sezioni             |
| [PERSONAS](product/PERSONAS.md)                                                   | C    | Profili di riferimento                          |
| [USER-JOURNEYS](product/USER-JOURNEYS.md)                                         | C    | Percorsi e copertura attuale                    |
| [DOMAIN-GLOSSARY](product/DOMAIN-GLOSSARY.md)                                     | C    | Termini: ideale e corrispondenza nel codice     |
| [PRODUCT-PRINCIPLES](product/PRODUCT-PRINCIPLES.md)                               | C    | Regole di interazione verificabili              |
| [vision](product/vision.md)                                                       | ⚠    | Visione originaria (integrata nel Core)         |
| [requirements](product/requirements.md) · [user-stories](product/user-stories.md) | ⚠    | Requisiti originari; stati superati             |
| [domain-model](product/domain-model.md)                                           | ⚠    | Modello originario; vedi DATA-MODEL e glossario |

## Architettura — come è costruito

| Documento                                                                               | Tipo | Contenuto                                      |
| --------------------------------------------------------------------------------------- | ---- | ---------------------------------------------- |
| [overview](architecture/overview.md)                                                    | ⚠    | Panoramica e responsabilità                    |
| [REPOSITORY-MAP](architecture/REPOSITORY-MAP.md)                                        | C    | Dove si trova che cosa                         |
| [CHANGE-IMPACT](architecture/CHANGE-IMPACT.md)                                          | C    | Dipendenti, test e invarianti per sottosistema |
| [DATA-MODEL](architecture/DATA-MODEL.md)                                                | C    | Tabelle, vincoli, relazioni (as-built)         |
| [database](architecture/database.md)                                                    | ⚠    | Convenzioni, migrazioni, backup, cancellazione |
| [API-CONTRACTS](architecture/API-CONTRACTS.md)                                          | C    | Catalogo degli endpoint                        |
| [BACKEND](architecture/BACKEND.md) · [FRONTEND](architecture/FRONTEND.md)               | C    | Strati, logica, codice dormiente               |
| [SECURITY](architecture/SECURITY.md) · [authentication](architecture/authentication.md) | C    | Sicurezza, privacy, accesso                    |
| [ADR](architecture/decisions/README.md)                                                 | C    | Decisioni architetturali 0001–0018             |

## Funzionalità — specifiche per area

[features/INDEX](features/INDEX.md): [opportunità](features/OPPORTUNITIES.md) · [candidature](features/APPLICATIONS.md) · [workflow](features/WORKFLOWS.md) · [bacheche](features/BOARDS.md) · [viste](features/SMART-VIEWS.md) · [analytics](features/ANALYTICS.md) · [integrazioni](features/INTEGRATIONS.md).

UX: [design system](ux/design-system.md) ⚠ · [catalogo dei componenti](ux/COMPONENTS.md) · [sidebar](ux/sidebar.md) · [kanban-glass](ux/kanban-glass.md) · [sfondi](ux/board-backgrounds.md) · [architettura dell'informazione](ux/information-architecture.md) ⚠ · [schermate](ux/screens.md) ⚠.

## Roadmap — perimetro e pianificazione

| Documento                                                         | Tipo | Contenuto                                             |
| ----------------------------------------------------------------- | ---- | ----------------------------------------------------- |
| [scope-policy](roadmap/scope-policy.md)                           | C    | Che cosa è vietato senza nuova decisione (vincolante) |
| [milestones](roadmap/milestones.md)                               | ⚠    | Definizioni M0–M5; stato «corrente» storico           |
| [m4-private-release-plan](roadmap/m4-private-release-plan.md)     | ⚠    | Piano M4 sospeso (ADR-0017); governance di rilascio   |
| [MASTER-FUNCTIONAL-ROADMAP](roadmap/MASTER-FUNCTIONAL-ROADMAP.md) | C    | Capacità future per stream (A–H)                      |
| [DEPENDENCIES](roadmap/DEPENDENCIES.md)                           | C    | Grafo e percorso critico                              |
| [IMPLEMENTATION-PLAN](roadmap/IMPLEMENTATION-PLAN.md)             | C    | Interventi A/B/C proposti                             |
| [backlog](roadmap/backlog.md)                                     | ⚠    | Candidati non approvati                               |

## Sviluppo

[GETTING-STARTED](development/GETTING-STARTED.md) (anche variabili d'ambiente e configurazione) · [TUTORIAL-FEATURE](development/TUTORIAL-FEATURE.md) (una funzione da capo a fine) · [COMMANDS](development/COMMANDS.md) · [TESTING](development/TESTING.md) · [CONTRIBUTING](development/CONTRIBUTING.md) · [DEPLOYMENT](development/DEPLOYMENT.md).

## Stato — che cosa esiste davvero

[CURRENT-STATE](status/CURRENT-STATE.md) · [FEATURE-MATRIX](status/FEATURE-MATRIX.md) (capacità ed evidenze) · [GAP-ANALYSIS](status/GAP-ANALYSIS.md) · [AUDIT-REPORT](status/AUDIT-REPORT.md) · [PID-01-REPORT](status/PID-01-REPORT.md) (audit documentale, memoria, efficienza del contesto).

## Riferimento tecnico

Non esiste una cartella `reference/` separata: endpoint in [API-CONTRACTS](architecture/API-CONTRACTS.md), tabelle in [DATA-MODEL](architecture/DATA-MODEL.md), comandi in [COMMANDS](development/COMMANDS.md), variabili e configurazione in [GETTING-STARTED](development/GETTING-STARTED.md#configurazione-e-variabili-dambiente).

## Agenti

[CONTEXT-ROUTER](agents/CONTEXT-ROUTER.md) · [CURRENT-CONTEXT](agents/CURRENT-CONTEXT.md) · [MEMORY-SYSTEM](agents/MEMORY-SYSTEM.md) · [WORKFLOW](agents/WORKFLOW.md) · [TOKEN-EFFICIENCY](agents/TOKEN-EFFICIENCY.md) · [HANDOFF-TEMPLATE](agents/HANDOFF-TEMPLATE.md).

## Storico

I report delle milestone (M0–M4, SW.10) non sono più nella repository: [history/README](history/README.md) dice che cosa contenevano e dove vive oggi ciò che vale ([ADR-0018](architecture/decisions/0018-launch-repository-and-docs-archive.md)).
