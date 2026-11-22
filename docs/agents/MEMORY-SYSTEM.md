# Sistema di memoria del progetto

**Stato:** canonico · **Origine:** JW-CORE-01. Come la conoscenza del progetto è organizzata perché agenti e sviluppatori riprendano il lavoro senza ricostruire il contesto.

## Livelli

| Livello | Che cosa               | File                                                                                                                                                 | Dimensione obiettivo        | Quando si legge                 |
| ------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------- |
| **L0**  | Bootstrap              | [AGENTS.md](../../AGENTS.md) (+ [CLAUDE.md](../../CLAUDE.md) che lo importa)                                                                         | ≤ 4.500 byte (~1.200 token) | sempre, automaticamente         |
| **L1**  | Router                 | [CONTEXT-ROUTER](CONTEXT-ROUTER.md)                                                                                                                  | ≤ 5.500 byte (~1.500 token) | sempre, all'inizio              |
| **L2**  | Conoscenza di dominio  | `docs/product`, `docs/architecture`, `docs/features`, `docs/roadmap`, `docs/development`, `docs/status`                                              | illimitata, modulare        | solo i file indicati dal router |
| **L3**  | Memoria di lavoro      | [CURRENT-CONTEXT](CURRENT-CONTEXT.md)                                                                                                                | ≤ 3.000 byte (~800 token)   | sempre, all'inizio              |
| Storico | Report delle milestone | fuori dalla repository ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); indice in [history](../history/README.md) | —                           | mai (non pubblicato)            |

## Tre tipi di conoscenza

| Tipo           | Contenuto                                               | Dove vive                                                                                                   | Cambia                   |
| -------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------ |
| **Permanente** | Identità, principi, architettura, contratti, decisioni  | L2: product, architecture, features, ADR                                                                    | raramente, con revisione |
| **Operativa**  | Stato verificato del codice, attività in corso, blocchi | [CURRENT-STATE](../status/CURRENT-STATE.md), [FEATURE-MATRIX](../status/FEATURE-MATRIX.md), CURRENT-CONTEXT | a ogni consegna          |
| **Storica**    | Motivazioni delle decisioni                             | ADR (anche superati); i report delle milestone sono solo nella storia git locale                            | mai (solo aggiunte)      |

## Un proprietario per ogni informazione

| Informazione                                  | Proprietario unico                                                                                       |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Che cos'è Jobward, principi, non-obiettivi    | [CORE](../product/CORE.md)                                                                               |
| Prodotto ideale                               | [PRODUCT-VISION](../product/PRODUCT-VISION.md)                                                           |
| Significato dei termini                       | [DOMAIN-GLOSSARY](../product/DOMAIN-GLOSSARY.md)                                                         |
| Che cosa è approvato                          | [scope policy](../roadmap/scope-policy.md), [milestones](../roadmap/milestones.md), piano M4, roadmap SW |
| Capacità future e priorità                    | [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md)                                     |
| Tabelle e vincoli                             | [DATA-MODEL](../architecture/DATA-MODEL.md)                                                              |
| Convenzioni DB, migrazioni, backup            | [database.md](../architecture/database.md)                                                               |
| Endpoint                                      | [API-CONTRACTS](../architecture/API-CONTRACTS.md)                                                        |
| Stato di ogni funzione                        | [FEATURE-MATRIX](../status/FEATURE-MATRIX.md)                                                            |
| Stato del progetto, rami, blocchi             | [CURRENT-STATE](../status/CURRENT-STATE.md)                                                              |
| Attività in corso di un agente                | [CURRENT-CONTEXT](CURRENT-CONTEXT.md)                                                                    |
| Decisioni architetturali                      | [ADR](../architecture/decisions/README.md)                                                               |
| Comandi                                       | [COMMANDS](../development/COMMANDS.md)                                                                   |
| Dipendenze, test e documenti per sottosistema | [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md)                                                        |
| Uso dell'applicazione                         | [docs/user](../user/README.md)                                                                           |

Gli altri documenti **rimandano** al proprietario invece di ripeterne il contenuto. Un'informazione trovata in due posti va ridotta a un rimando.

## Memoria personale degli agenti

Gli strumenti degli agenti hanno memorie proprie, non versionate (es. memoria automatica di Claude Code). Regole:

- vi si salvano preferenze e indicazioni del proprietario e puntatori ai documenti, **non** copie dei fatti della repository;
- se una memoria personale contraddice la repository, si verifica sul codice e si corregge la memoria;
- le decisioni del proprietario che valgono per tutti vanno trascritte in un documento versionato (ADR, scope policy, roadmap), non solo in memoria personale.

## Affidabilità di un'informazione

Quando un fatto non è verificato nel codice, dichiaralo con una di queste etichette (nei report e nei documenti di stato):

| Etichetta        | Significato                                                       |
| ---------------- | ----------------------------------------------------------------- |
| **VERIFICATO**   | confermato da codice, configurazione, test eseguiti o ispezione   |
| **DOCUMENTATO**  | scritto in un documento ma non ricontrollato                      |
| **PIANIFICATO**  | approvato o proposto, non implementato                            |
| **DEDOTTO**      | interpretazione ragionevole da confermare                         |
| **IGNOTO**       | prove insufficienti                                               |
| **IN CONFLITTO** | le fonti divergono: riportare entrambe, non scegliere in silenzio |

Un fatto DOCUMENTATO, DEDOTTO o IGNOTO non si promuove a canonico senza verifica. Le memorie personali degli agenti valgono al massimo come DOCUMENTATO.

## Archiviazione

- Un documento **in parte** superato riceve in testa un avviso `> **Avviso (<task>, <data>):**` che dice che cosa è superato e quale documento lo sostituisce.
- Un documento **del tutto** superato si elimina, dopo aver portato nel documento canonico ciò che vale ancora: la storia git lo conserva ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)). Non si creano cartelle di report per milestone.
- Gli ADR accettati non si riscrivono: si aggiunge un nuovo ADR e si aggiorna lo stato nell'[indice degli ADR](../architecture/decisions/README.md).
- Una memoria personale superata si sostituisce con un puntatore alla storia nella repository.

## Prevenzione dell'obsolescenza

Regole di aggiornamento nello stesso commit: [WORKFLOW](WORKFLOW.md#aggiornamento-della-documentazione). Ogni documento canonico dichiara in testa lo stato e il commit su cui è stato verificato; un documento con commit di verifica vecchio rispetto all'area modificata è sospetto e va riverificato prima dell'uso. Controllo rapido: `git log --oneline <commit-di-verifica>..HEAD -- <percorsi dell'area>`; se elenca commit, riverifica le affermazioni che usi. Limiti di dimensione, collegamenti relativi e assenza di rimandi all'archivio si verificano con `pnpm check:docs` (parte di `pnpm check`).
