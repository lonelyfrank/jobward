# Candidature

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Obiettivo: [PRODUCT-VISION §4 Application Workspace](../product/PRODUCT-VISION.md#4-application-workspace).

## Ambito

Ciclo di vita della candidatura: stato, transizioni, storico, colloqui, note, documenti, comunicazioni, offerte, esiti.

## Stato attuale

- **Più candidature per opportunità** (1:N, tabella `applications`, sequenza 1, 2, 3…): fase, esito e data d'invio vivono solo nella candidatura; la corrente è quella con la sequenza più alta (vista `current_applications`). Snapshot dei dati dell'annuncio all'invio; ricandidatura dopo una chiusura dal pannello «Candidati» / «Nuova candidatura» (`apps/web/src/features/applications/`). Stato di pipeline derivato a 10 valori (APP-01, [DATA-MODEL](../architecture/DATA-MODEL.md#ciclo-di-vita-della-candidatura)).
- **Pipeline:** `POST /cards/:id/pipeline` con grafo di transizioni puro, conferma, idempotenza, confronto e scambio e annullamento facoltativo dei colloqui futuri ([BACKEND](../architecture/BACKEND.md#logica-di-dominio-rilevante)). UI: `apps/web/src/features/pipeline/`.
- **Colloqui** (APP-02): round numerati per scheda; programmazione con fuso orario, riprogrammazione, completamento con esito e feedback, annullamento immutabile ([ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md)).
- **Note** (APP-03) e **documenti come riferimenti** (APP-04), entrambi idempotenti con tombstone.
- **Timeline** (APP-05): eventi ∪ note ∪ attività per scheda, a cursore; nessun testo riservato.
- **Modale a 6 schede:** Panoramica, Colloqui, Timeline, Note, Documenti, Dettagli; guardia delle modifiche non salvate.

## Regole vincolanti

- Fase, esito e colonna sono indipendenti ([ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md)).
- Le transizioni passano SOLO dalla pipeline e dalla creazione di una nuova candidatura; `PATCH /cards/:id` non accetta più fase, esito né data d'invio ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)).
- Un round annullato è immutabile; un esito di colloquio richiede il completamento.
- Metadati degli eventi in whitelist (`packages/shared/src/timeline.ts`).

## Gap e voci di roadmap

| Gap                                                | Voce       |
| -------------------------------------------------- | ---------- |
| Politica unica delle transizioni                   | A-02       |
| Eventi legati alla candidatura, con origine        | A-03, A-05 |
| Colloqui della candidatura                         | C-02       |
| Timeline per candidatura                           | C-03       |
| Contatti e registro comunicazioni                  | C-05       |
| File e snapshot dei documenti (richiede decisione) | C-07       |
| Offerte ricevute                                   | C-08       |

## Dettaglio storico

Le motivazioni di dettaglio (ciclo della candidatura M2, dominio dei colloqui M2.5, consegne M3) sono nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); le decisioni valide sono in [ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md), [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md) e [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md).
