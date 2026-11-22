# Flusso di lavoro degli agenti

**Stato:** canonico · **Origine:** JW-CORE-01. Le regole non negoziabili sono in [AGENTS.md](../../AGENTS.md); qui il procedimento.

## Ciclo di un task

1. **Obiettivo:** riformula il task in una frase e verifica che sia approvato ([scope policy](../roadmap/scope-policy.md)); se amplia una milestone, fermati e chiedi.
2. **Baseline git:** `git status --short`, `git branch --show-current`, `git log -3 --oneline`, `git worktree list`. Annota modifiche non committate altrui e non toccarle.
3. **Contesto:** [CURRENT-CONTEXT](CURRENT-CONTEXT.md) → [CONTEXT-ROUTER](CONTEXT-ROUTER.md) → solo i documenti indicati → riga del sottosistema in [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md). Verifica sul codice ogni affermazione dei documenti su cui basi una modifica.
4. **Piano:** per modifiche strutturali (migrazioni, contratti, workflow) scrivi un piano e attendi approvazione.
5. **Implementazione:** modifiche piccole e verificabili; un argomento per commit.
6. **Verifica:** i comandi pertinenti di [COMMANDS](../development/COMMANDS.md); riporta gli esiti reali.
7. **Documentazione:** aggiorna i proprietari (tabella sotto) nello stesso commit; Prettier sui Markdown toccati.
8. **Chiusura:** aggiorna [CURRENT-CONTEXT](CURRENT-CONTEXT.md); per passaggi di consegna usa [HANDOFF-TEMPLATE](HANDOFF-TEMPLATE.md).

## Aggiornamento della documentazione

| Se cambi…                               | Aggiorna                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| una rotta, un input o un output API     | [API-CONTRACTS](../architecture/API-CONTRACTS.md)                                                                      |
| schema, migrazioni, vocabolari          | [DATA-MODEL](../architecture/DATA-MODEL.md) (+ [DOMAIN-GLOSSARY](../product/DOMAIN-GLOSSARY.md) se cambia un concetto) |
| un comportamento visibile               | la specifica dell'area in [features](../features/INDEX.md)                                                             |
| etichette, navigazione, percorsi utente | la [guida utente](../user/README.md)                                                                                   |
| dipendenze o test di un sottosistema    | [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md)                                                                      |
| lo stato di una funzione                | la riga in [FEATURE-MATRIX](../status/FEATURE-MATRIX.md) con l'evidenza                                                |
| una decisione architetturale            | nuovo ADR in [decisions](../architecture/decisions/README.md); mai riscrivere un ADR accettato                         |
| struttura delle cartelle                | [REPOSITORY-MAP](../architecture/REPOSITORY-MAP.md)                                                                    |
| comandi o script                        | [COMMANDS](../development/COMMANDS.md)                                                                                 |
| test o suite                            | [TESTING](../development/TESTING.md)                                                                                   |
| stato di milestone, rami, blocchi       | [CURRENT-STATE](../status/CURRENT-STATE.md)                                                                            |
| priorità o perimetro                    | solo su decisione del proprietario: scope policy, milestones, roadmap                                                  |

**Riferimenti verificabili:** cita percorsi di file reali (e righe quando utili); non descrivere comportamenti che non hai verificato nel codice. Indica in testa al documento il commit di verifica quando ne aggiorni lo stato.

## Report di consegna

Il resoconto di una consegna va nella descrizione del commit o della PR; nei documenti resta solo ciò che vale anche dopo (stato in `docs/status/`, regole nei documenti canonici, decisioni negli ADR). Niente nuove cartelle `docs/<milestone>/` ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)). CURRENT-CONTEXT contiene solo il rimando.
