# Contribuire

**Stato:** canonico · **Origine:** JW-CORE-01, sintesi delle regole già vigenti ([governance](../roadmap/m4-private-release-plan.md#governance-di-integrazione-e-rilascio), [scope policy](../roadmap/scope-policy.md)). Regole operative per agenti: [agents/WORKFLOW](../agents/WORKFLOW.md).

## Perimetro

- Si implementa solo ciò che è in una milestone o iniziativa approvata. La presenza nel backlog o nella [roadmap funzionale](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) **non** è un'approvazione.
- Fuori perimetro senza nuova decisione: AI/LLM, funzioni per recruiter/aziende, ATS, marketplace; notifiche, scheduler, integrazioni email/calendario sono solo candidate.
- Prima di ogni modifica strutturale del database: piano di migrazione approvato.

## Git

- Si lavora su `main` (applicazione locale, [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md); repository di lancio, [ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)). I push partono dal worktree di lavoro verso `origin/main`; la CI gira a ogni push e le verifiche locali sotto restano obbligatorie prima di pushare. Il ramo locale `jobward-v1` contiene la storia precedente al lancio e non va mai pushato.
- Dal lancio la repository si gestisce come nuova (decisione del proprietario, 2026-11-22): nessuna PR o controllo obbligatorio su `main`; i lavori piccoli si committano direttamente su `main`, i rami servono solo per lavori paralleli (in worktree separati).
- Commit, push, PR, merge, deploy e migrazioni remote solo con autorizzazione esplicita **per quella specifica azione**: un'autorizzazione non si estende ad altre.
- Mai `reset --hard`, `clean`, `stash` o checkout distruttivi su lavoro altrui; le modifiche non committate si preservano.

## Qualità

Prima di proporre un'integrazione: `pnpm check`, poi `pnpm test:e2e` e `pnpm test:preview` se si tocca la UI o la configurazione. Nessuna modifica fatta solo per far passare un test. I risultati si riportano come sono, inclusi i fallimenti.

## Documentazione nello stesso commit

| Cambiamento              | Documento da aggiornare                                                                         |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Rotta API                | [API-CONTRACTS](../architecture/API-CONTRACTS.md)                                               |
| Schema o migrazione      | [DATA-MODEL](../architecture/DATA-MODEL.md)                                                     |
| Comportamento funzionale | specifica dell'area in [features](../features/INDEX.md)                                         |
| Stato di una funzione    | [FEATURE-MATRIX](../status/FEATURE-MATRIX.md)                                                   |
| Decisione architetturale | nuovo ADR in [decisions](../architecture/decisions/README.md) (mai riscrivere un ADR accettato) |
| Comando o script         | [COMMANDS](COMMANDS.md)                                                                         |
| Stato del progetto       | [CURRENT-STATE](../status/CURRENT-STATE.md)                                                     |

Prettier controlla anche i documenti: eseguire `pnpm exec prettier --write <file.md>` sui file modificati.
