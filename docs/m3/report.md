# M3.0 — Relazione di chiusura e autorizzazione delle decisioni

**Data:** 2026-11-05 · **Branch:** `m3-application-workflow`

## Stato e perimetro

Alla ripresa del lavoro il commit `13a0713` (`feat(m3.0): audit tecnico, rebranding a Jobward, ADR-0013 e piano di M3`) era già presente, con working tree pulito. `git stash list` non mostrava stash e `refs/stash` era assente: `m3.0-wip` non è stato riapplicato. Audit, rebranding e i due loghi risultano già inclusi nel commit esistente; la documentazione iniziale era ancora in attesa di conferma delle decisioni.

La chiusura aggiunge un commit documentale, senza riscrivere quello esistente. Recepisce nel [piano](plan.md):

- **D1–D3 approvate:** dieci stati derivati, sei schede con Dettagli, documenti come riferimenti.
- **D4 approvata con condizioni:** conservazione integrale di dati/eventi, verifica di chiavi esterne, indici, vincoli e trigger; upgrade da M2.5 popolato; prova degli eventi di riapertura. Nessuna operazione distruttiva sui dati utente.
- **D5 approvata con condizioni:** ID client stabile, verifica backend del payload originale, replay senza duplicati, 409 per payload differente, concorrenza e atomicità colloquio/evento con prove di rollback.
- **D6 rinviata:** identificatori tecnici esistenti invariati.
- **UX:** Panoramica come centro operativo, modulo esistente in Dettagli e azioni frequenti nelle sezioni pertinenti.

**M3.1–M3.5 non sono state avviate.** `0005` non è stata creata né applicata; le garanzie D4/D5 sono criteri per l'implementazione futura, non funzionalità già disponibili.

## Baseline pulita: risultati effettivi

Baseline precedente su `d931ff6`, con lavoro M3.0 messo da parte. Sono stati letti i log originali, non soltanto i conteggi dell'audit:

| Comando             | Risultato confermato                                                                 |
| ------------------- | ------------------------------------------------------------------------------------ |
| `pnpm check`        | `CHECK_EXIT=0`; 472 test unitari/integrazione; build web e Worker dry-run completate |
| `pnpm test:e2e`     | `E2E_EXIT=0`; **117/117** passati in 8,1 minuti                                      |
| `pnpm test:preview` | `PREVIEW_EXIT=0`; **11/11** passati in 21,4 secondi                                  |

I log sono `clean-check.log`, `clean-e2e.log`, `clean-preview.log` nella cartella locale `/tmp/claude-1000/-home-frank-jobward/f367a7fe-1f09-4694-ad58-ed4fcc93cf57/scratchpad/`. Tutti terminano con i risultati sopra riportati. Nessun processo di questa baseline risultava ancora attivo alla verifica dei processi host.

## Verifiche di chiusura sullo stato M3.0

È stato rieseguito **`pnpm check`**, con exit **0**, sul codice di `13a0713` durante l'aggiornamento documentale. Non sono stati modificati codice applicativo, test, configurazioni o migrazioni. La formattazione dei documenti finali viene verificata separatamente prima del commit.

| Verifica inclusa in `pnpm check`            | Risultato                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Typecheck di tutti i pacchetti              | Passato                                                                                      |
| Lint con zero warning                       | Passato                                                                                      |
| Formattazione                               | Passata; ricontrollata dopo gli aggiornamenti documentali                                    |
| Contrasto token e configurazione Cloudflare | Passati                                                                                      |
| `db:check`                                  | Migrazioni coerenti con lo schema                                                            |
| `db:upgrade-test`                           | Passato, con dati preservati e verifiche di vincoli/trigger sull'upgrade esistente M1 → M2.5 |
| Test shared                                 | **17/17**                                                                                    |
| Test schemas                                | **43/43**                                                                                    |
| Test web                                    | **106/106** in 10 file                                                                       |
| Test API/integrazione                       | **306/306** in 20 file                                                                       |
| Build web                                   | Passata                                                                                      |
| Build Worker                                | Passata con `wrangler deploy --dry-run`; nessuna pubblicazione                               |

Log della riesecuzione: `/tmp/jobward-m30-check-full.log`. Un primo tentativo nella sandbox si era fermato in `db:check` dopo typecheck, lint, formattazione, contrasto e configurazione verdi (`/tmp/jobward-m30-check.log`); la riesecuzione fuori dalla sandbox ha superato anche quel controllo, senza modificare lo schema.

Gli **E2E e l'anteprima riportati sopra appartengono alla baseline pulita**, non a una nuova esecuzione dopo il rebranding. Non sono stati ripetuti per questo aggiornamento esclusivamente documentale. Le nuove prove D4/D5 richiedono le future implementazioni e non sono state eseguite. Restano i limiti già noti: browser Chromium, nessun lettore di schermo reale e nessuna nuova verifica CI remota.

## Processo Wrangler e porte

La verifica host tramite `ps` e `ss` ha confermato il processo preesistente **PID 1258785**, con comando `wrangler dev --env dev --port 8788` dalla vecchia cartella `meet-roulette`. Il relativo `workerd` mantiene l'inspector in ascolto su **9229**. Le porte **5199/8799** (E2E) e **8797** (anteprima) risultavano libere. Nessun processo preesistente è stato terminato; l'eventuale conflitto dell'inspector va gestito con una porta dedicata in una futura esecuzione.

## Loghi

Entrambi i file forniti sono già versionati e sono stati ispezionati: [`jobward.png`](../../jobward.png), 866 × 288 RGBA trasparente, e [`jobward-white.png`](../../jobward-white.png), 2172 × 724 RGB su fondo bianco. La seconda immagine contiene la stessa scritta scura, non una variante bianca per il tema scuro. Gli originali sono conservati integri.

Il componente logo e la favicon continuano a usare il segnaposto ereditato. Audit, ADR-0013 e piano ora distinguono gli asset disponibili dall'integrazione grafica ancora da effettuare. Il debito M3-04 resta aperto; anche M3-01 (riapertura) e M3-02 (retry) restano aperti fino all'implementazione e verifica.

## Piano M3.1–M3.5, non avviato

La [sequenza di commit e la matrice delle fasi](plan.md#10-sequenza-di-commit-locali-con-verifica-a-ogni-passo) seguono le dipendenze tecniche:

1. Dominio puro di pipeline, timeline e azioni rapide.
2. Migrazione `0005`, contratti, API e idempotenza con tutte le prove D4/D5. Definire qui la persistenza del fingerprint originale prima di finalizzare lo schema.
3. Sei schede, Panoramica operativa, note/documenti/timeline e azioni contestuali; estensione dei colloqui esistenti.
4. E2E desktop/mobile, accessibilità, chiusura/riapertura, concorrenza e regressioni.
5. Documentazione e verifica completa finale.

Questa sequenza richiede una nuova autorizzazione prima di C1. Il lavoro resta sul branch `m3-application-workflow`; il riferimento locale `main` resta `ba2ff11955e8b9c566ba6a3d9e05f99187e4ba35`. Nessun push, merge, PR o deploy è stato eseguito.
