# M3 — report finale di stabilizzazione

**Stato formale: CI PENDING.** La stabilizzazione locale è verificata; pubblicazione del solo branch e apertura PR verso main autorizzate il 2026-11-08. La CI remota sulla correzione deve ancora concludersi. Merge subordinato a una successiva autorizzazione esplicita; distribuzione esclusa. Risultati e revisioni effettivamente verificate nel [quality gate](quality-gate.md).

## Executive summary

Baseline main confermata all'avvio dell'audit: `fa20c06f8cee5148f39bba685c39dca55b48bd6e`. Worktree originale pulito; creato worktree isolato `/tmp/jobward-m3-stabilization-refactor`, branch `fix/m3-stabilization-refactor`, senza incorporare interventi degli altri worktree. Correzioni consolidate nel commit `e5bba44`; documentazione consolidata separatamente. M3 è funzionalmente integrata, M4 non implementata.

Identificati e corretti due difetti di ricerca: Back rapido lascia stato ottimistico non coerente con l'URL; un debounce con closure precedente perde un filtro appena scelto. Riproduzioni permanenti falliscono prima e passano dopo. Ripristinato lo scope Glass esplicito (solo container Kanban), mantenendo palette, token, animazioni e background. Riallineati locator e sincronizzazione dei test senza timeout più lunghi o nuove esclusioni.

## Root cause analysis

I quattro run richiesti sono stati letti, con job/log e inventario artefatti; esaminato il trace Playwright della ricerca della baseline. [RCA completa](ci-root-cause-analysis.md) per errore, classificazione, causa, correzione e prova. La ricerca è un difetto prodotto, i ruoli/menu e il nome del link sono test obsoleti, la misura zoom è una race del test, i target delle card un errore del misuratore. La vecchia failure migrazioni e la guardia pseudo-elementi erano già corrette nella baseline, ma lo scope Table del test era incoerente col requisito attuale.

| ID     | Errore e causa                                                                             | Classificazione                                          | Correzione                                                                  | Verifica                                                                              |
| ------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| M3S-01 | Verde trova anche Prato verde                                                              | Locator ambiguo                                          | Corrispondenza esatta, nomi UI conservati                                   | Suite background nei due temi                                                         |
| M3S-02 | menuitemradio inesistenti nel menu di navigazione                                          | Test obsoleto                                            | menuitem nel menu account                                                   | Prima voce, frecce, Esc, focus di ritorno e axe                                       |
| M3S-03 | 258×25 misura il testo e ignora il link esteso                                             | Misuratore scorretto                                     | Helper geometrico condiviso                                                 | Fixture positiva/negativa e click reale fuori dal titolo                              |
| M3S-04 | Tabella eredita Glass oltre lo scope esplicito                                             | Difetto prodotto rispetto al requisito                   | Wrapper opaco e rimozione selettori Table                                   | Nuova regressione rossa prima, verde dopo; guardie CSS/browser                        |
| M3S-05 | Misura durante l'espansione animata della toolbar                                          | Race del test                                            | Attesa delle animazioni finite                                              | Uguaglianza esatta, zoom, persistenza e DnD conservati                                |
| M3S-06 | Il test cerca il nome precedente del ritorno                                               | Test obsoleto                                            | Locator Torna alle bacheche                                                 | href e navigazione effettiva                                                          |
| M3S-07 | Back torna alla base URL mentre pending resta attivo                                       | Race prodotto                                            | URL unica fonte e commit sincrono delle azioni                              | Riproduzione deterministica rossa prima; suite ricerca 17/17 e ripetizione 20/20 dopo |
| M3S-08 | Guardia vietava anche lo pseudo-elemento decorativo ammesso                                | Test architetturale obsoleto, già risolto nella baseline | Preservata guardia, scope solo Kanban                                       | Baseline 10/10; unit finali nel gate                                                  |
| M3S-09 | Fixture API a 0005, timeline corrente richiede 0006; entries manca nella risposta d'errore | Incompatibilità fixture/API, già risolta nella baseline  | Solo la copia API riceve le migrazioni successive; diagnostica HTTP/entries | Tutti e tre gli script upgrade passano, SQL storico invariato                         |
| M3S-10 | Timer con closure precedente elimina il filtro appena scelto                               | Race prodotto                                            | Stato stabile e dipendenze complete dell'effetto                            | Test stage=null prima, saved dopo; mutation check rileva ancora il difetto            |
| M3S-16 | Preview assume vecchia sidebar e tema nel menu account                                     | Test obsoleto                                            | Navigazione dal menu a Impostazioni e radio Scuro, Esc/focus conservati     | Prima 6 passed, 1 failed, 7 did not run; dopo 14/14 passed                            |

## Refactoring

- OpportunitiesView: eliminata la copia ottimistica dei filtri; URL unica fonte di verità con commit sincrono supportato dal provider DOM di React Router; stato stabile e dipendenze complete per il debounce. Preservati semantica ricerca, OR/AND, durata 300 ms, URL e contratti API. Rischio circoscritto alla sincronizzazione; protetto da unit/E2E.
- Table/Glass: rimozione di classe e selettori Table; wrapper opaco con token esistente, geometria conservata. Token e fallback Kanban invariati; nuova regressione della route e guardia CSS.
- Test: helper touch esistente condiviso con riconoscimento geometrico dei link estesi; attesa delle animazioni finite per toolbar, readiness della Tabella prima di axe; locator accessibili esatti e ruoli correnti. Nessun cambio alle dimensioni dei pulsanti.

Motivazioni, benefici e limiti: [frontend](frontend-refactor.md), [test](test-refactor.md), [architettura](architecture-audit.md). Nessuna estrazione di moduli per numero di righe o riscrittura generale.

## Quality gate e database

`pnpm check`: **PASS in 695,11 s**, inclusi controlli statici, database, **1.291 test passati** (632 shared, 59 schemas, 172 web, 428 API), zero failure/skip, build Vite e dry-run Worker. E2E completo: **237 passed, 1 skipped preesistente, zero failure/retry Playwright**, 1289,48 s. Preview: **14/14 passed**, 33,92 s, build e stack Worker locali. Prima dei gate completi, ricerca browser **17/17** e ripetizione dei due casi Back/filtri **20/20**.

La sola modifica successiva a check/E2E riguarda il test della preview (M3S-16), poi verificato con tutta la suite preview e controlli statici. Sorgenti applicativi, configurazione, migrazioni e test E2E normali sono identici fra le due revisioni; confronto per-file e manifest A/B nel quality gate. I risultati delle varianti precedenti del prodotto non vengono riutilizzati come prova della correzione finale.

Risultati reali e limiti nel [quality gate](quality-gate.md). Schema/migrazioni storiche 0000–0007 invariati; installazione vuota, upgrade popolato, rollback e isolamento su fixture D1 locali. Aggiunte verifiche esplicite per default/persistenza background al secondo passaggio del runner. [Database audit](database-audit.md). Nessun database remoto o dato personale modificato.

## Documentazione prodotta

[Architettura](architecture-audit.md), [RCA CI](ci-root-cause-analysis.md), [frontend](frontend-refactor.md), [backend](backend-audit.md), [database](database-audit.md), [test](test-refactor.md), [quality gate](quality-gate.md), [sicurezza/accessibilità](security-accessibility.md), [code health](code-health.md), questo report e [registro corrente](issue-register.md). Preparato il [piano M4](../../roadmap/m4-private-release-plan.md); README, milestone, registro storico e contratto UX Glass/background riallineati.

## Problemi residui e readiness

Nessun P0 rilevato. P1: verifica CI remota della revisione finale, blocco formale di chiusura. P2: advisory moderate nella toolchain dev e verifica Access/D1 remoti prima del rilascio privato. P3: altri browser, lettori di schermo/device reali, warning HydrateFallback e un flaky tastiera/zoom storico non riprodotto localmente, la cui causa puntuale resta da confermare. [Registro prioritizzato](issue-register.md).

## Proposta di chiusura

**CI PENDING sulla correzione.** I gate locali passano, con il perimetro A/B dichiarato. La readiness tecnica locale non sostituisce i criteri formali: non usare CLOSED finché CI e integrazione richieste non sono effettivamente soddisfatte. Al momento del consolidamento locale nessun push/PR ancora eseguito; nessun merge, modifica settings GitHub, deploy o migrazione remota autorizzati.

## Handoff M4-C1

Dopo CI verde sulla revisione finale e successiva autorizzazione esplicita al merge: integrare la stabilizzazione, definire metriche Insights a partire dal dominio condiviso e dai contatori Overview/Tasks, precisare fuso, archiviate, date mancanti e riaperture; approvare specifica e contratti prima dell'implementazione. M4-C2 portabilità, C3 affidabilità/accessibilità/sicurezza, C4 deploy privato, C5 uso personale/beta. Multiutenza per amici solo come futura decisione esplicita; M5 resta preparazione finale alla pubblicazione.

## Review di consolidamento — 2026-11-08

Commit sorgenti `e5bba44`, base `fa20c06`. Manifest B verificato: 367 file, nessun drift. Rieseguiti 18/18 test mirati ricerca/Glass; formattazione e diff controllati prima della pubblicazione. Il worktree originale è pulito e conserva HEAD `fa20c06`; nessuna modifica preesistente scartata. Nessuna nuova funzionalità, variazione di dipendenze/workflow/SQL o implementazione M4/M5. Nessun segreto, dato reale o artefatto temporaneo individuato nei 34 file revisionati; output browser/database e dipendenze restano ignorati e fuori dai commit. Ricerca GitHub: nessuna issue aperta al momento della review; P0/P1 sono tracciati nel registro locale.

Inventario dei **12 deliverable**:

| N.  | Deliverable                     | Documento                                                              |
| --- | ------------------------------- | ---------------------------------------------------------------------- |
| 1   | Audit architetturale            | [architecture-audit.md](architecture-audit.md)                         |
| 2   | Root cause CI                   | [ci-root-cause-analysis.md](ci-root-cause-analysis.md)                 |
| 3   | Refactor frontend               | [frontend-refactor.md](frontend-refactor.md)                           |
| 4   | Audit backend                   | [backend-audit.md](backend-audit.md)                                   |
| 5   | Audit database                  | [database-audit.md](database-audit.md)                                 |
| 6   | Refactor test                   | [test-refactor.md](test-refactor.md)                                   |
| 7   | Quality gate                    | [quality-gate.md](quality-gate.md)                                     |
| 8   | Sicurezza/accessibilità         | [security-accessibility.md](security-accessibility.md)                 |
| 9   | Code health                     | [code-health.md](code-health.md)                                       |
| 10  | Report finale                   | Questo documento                                                       |
| 11  | Registro problemi               | [issue-register.md](issue-register.md)                                 |
| 12  | Handoff M4, solo pianificazione | [m4-private-release-plan.md](../../roadmap/m4-private-release-plan.md) |
