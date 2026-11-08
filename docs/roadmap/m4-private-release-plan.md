# M4 — Insights & Private Release

Piano di handoff, 2026-11-08. Nessuna funzionalità M4 implementata. M3 resta soggetta al [report di stabilizzazione](../m3/stabilization/final-report.md) e ai check della HEAD finale della PR #10, aperta dopo il merge esterno della PR #9 prima della fine della validazione. Il run 42506245939 resta verde storico su `7ff0ab0`; completamento e verifica della baseline finale integrata ancora richiesti.

| Checkpoint                                     | Obiettivo e deliverable                                                                                                                                                | Criteri di uscita                                                                                                                |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| M4-C1 — Analytics & Insights                   | Definire metriche e periodi con dominio condiviso; distinguere opportunità, inviate, fase, esito e posizione Kanban. Specifica e contratto prima dell'implementazione. | Numeri riconciliabili con fixture e dataset controllati, filtro workspace, fuso orario e stati vuoti; nessun dato inventato.     |
| M4-C2 — Esportazione e portabilità             | Formato documentato per dati del proprietario, riferimenti e task; distinguere export da backup/ripristino.                                                            | Export verificato su dati rappresentativi, assenza di dati di altri workspace e round-trip definito dove previsto.               |
| M4-C3 — Sicurezza, accessibilità, affidabilità | Risolvere rischi del registro, advisory della toolchain compatibili, verifiche browser/assistive e backup.                                                             | Checklist basata su prove, limiti residui espliciti; nessuna dichiarazione su browser/device non testati.                        |
| M4-C4 — Deploy privato Cloudflare              | Configurare Access proprietario, origine, binding D1, secrets e procedure operative.                                                                                   | Autorizzazione esplicita prima di deploy/migrazioni; backup e prova su copia; Access reale fail closed e smoke test post-deploy. |
| M4-C5 — Test personale e beta privata          | Eseguire scenari personali reali e raccogliere problemi in un registro prioritizzato.                                                                                  | Criteri di ingresso/uscita e ripristino documentati, affidabilità verificata nel tempo, nessuna perdita dati.                    |

## Handoff preciso a M4-C1

1. Pubblicazione branch/PR autorizzata il 2026-11-08; integrare la stabilizzazione solo dopo successiva autorizzazione esplicita al merge; esigere quality, E2E e preview remoti verdi sulla stessa revisione. Non usare il verde locale come sostituto.
2. Partire da `shared` per la semantica candidatura e da `overview.ts`/`tasks.ts` per conteggi e fuso del workspace; leggere ADR sul ciclo candidatura e separazione colonna/fase/esito.
3. Specificare intervalli temporali, date mancanti, archiviate, chiusure/riaperture e popolazione inclusa in ogni metrica. Confermare prodotto e privacy prima di cambiare contratti.
4. Preparare fixture multi-workspace solo nei test; nessuna abilitazione della multiutenza del prodotto.
5. Conservare i gate di ricerca, Tasks, timeline, zoom, background e scope Glass durante lo sviluppo Insights.

M5 rimane la fase finale di preparazione alla pubblicazione. La multiutenza limitata a un gruppo di amici può essere valutata come requisito esplicito della beta privata; non è implicita in M4 e non viene realizzata ora. Restano esclusi AI, scheduler, notifiche, automazioni e integrazioni non approvate.
