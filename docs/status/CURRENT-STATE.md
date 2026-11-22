# Stato corrente del progetto

**Stato:** canonico per lo stato operativo · **Aggiornato:** 2026-11-22 · **Linea di lavoro:** ramo `main` nel worktree `/home/frank/jobward-core-docs`, pubblicato su `origin/main`. Decisioni di riferimento: [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md) (applicazione locale), [ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md) (lancio senza storia).

## In una frase

Jobward è un'**applicazione locale completa** orientata alla visione del [Core](../product/CORE.md): opportunità indipendenti dalle bacheche (Inbox), candidature multiple per opportunità con snapshot all'invio, pipeline validata, colloqui, attività, Insights, Calendario ed esportazione. Pubblicazione, multiutenza e ambienti remoti sono **fuori dal ciclo corrente** e si valuteranno dopo.

## Che cosa contiene la v1

| Base                              | Contenuto                                                                                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `origin/main` `c007e53`           | M0–M3 code complete, M4.0/M4.0.1                                                                                                                |
| + `feat/ui-dialogs-motion`        | rifinitura UI (tooltip, dialoghi, animazioni delle schede)                                                                                      |
| + `feat/m5-sw1-smart-kanban`      | Smart Filter/Kanban (SW.1), motore di query v2 (SW.3), opportunità senza bacheca (SW.10-a)                                                      |
| + JW-CORE-01 e v1 (storia locale) | documentazione; base di migrazione unica; candidature come fonte dello stato; Opportunity Center; Insights; Calendario; esportazione; dati demo |

Funzioni ed evidenze: [FEATURE-MATRIX](FEATURE-MATRIX.md).

## Aggiunte v1.1

Bacheca canonica «Pipeline» (C-01), inserimento guidato in quattro passi (B-04), aziende e avviso dei duplicati (B-05), viste salvate (D-04). Migrazioni additive `0001_companies`, `0002_saved_views`.

## Dati

- Database di sviluppo: `apps/api/.wrangler/state` del worktree `jobward-core-docs`. Contiene i **dati reali** del proprietario (identità `dev@jobward.local`, workspace «Work»: le candidature inserite per provare l'app) e il profilo **Dati demo** (`frank@demo.jobward.local`, workspace «Ricerca lavoro»), rigenerabile da Impostazioni. Non va azzerato: `db:reset:local` ne fa comunque una copia in `apps/api/.wrangler/backups/`.
- Il D1 originale del proprietario nel worktree principale (`/home/frank/jobward/apps/api/.wrangler/state`) è **intatto**; una copia di backup è stata fatta prima di qualunque lettura.

## Verifiche

Ultimo esito completo: [AUDIT-REPORT](AUDIT-REPORT.md#verifiche-v1). Comandi: [COMMANDS](../development/COMMANDS.md).

## Rami e worktree

| Ramo / worktree                                                           | Stato                                                                        |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `main` — `/home/frank/jobward-core-docs`                                  | **Linea di lavoro attiva**, upstream `origin/main` (commit radice di lancio) |
| `jobward-v1` (stesso repository, non estratto)                            | Archivio locale con la storia precedente al lancio: **mai pusharlo**         |
| `docs/jw-core-01` (stesso worktree, antenato di `jobward-v1`)             | Documentazione JW-CORE-01, commit locale                                     |
| `feat/ui-dialogs-motion` — `/home/frank/jobward` (principale)             | Integrato in `jobward-v1`; worktree intatto con il file non tracciato M4.1-A |
| `feat/m5-sw1-smart-kanban` — `/home/frank/jobward-smart-workspace`        | Integrato in `jobward-v1`; worktree intatto (`scripts/spike/` non tracciato) |
| `ui/design-v2`, `m3-ui-glass-surface`, `jobward-staging`, worktree `/tmp` | Non toccati                                                                  |

## Fuori dal ciclo corrente

Staging e deploy Cloudflare, Access reale, D1 remoto, CI come gate di rilascio, multiutenza, rate limiting, cancellazione dell'account. La governance di `main` (PR e controlli richiesti) resta valida quando si vorrà integrare.

## Decisioni aperte del proprietario

1. Priorità tra le prossime capacità: contatti e registro comunicazioni (C-05), matrice comparativa (B-07), offerte ricevute (C-08), timeline globale (D-05).
2. Scope policy invariata: AI/LLM, recruiter/ATS e marketplace restano esclusi senza nuova decisione.
