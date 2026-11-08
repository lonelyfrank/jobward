# M3 — quality gate

Ambiente: Fedora Linux, Node 22.23.1, pnpm 12.15.0, Chromium Playwright 1.64.1; stack Worker/workerd e D1 esclusivamente locali. Worktree `/tmp/jobward-m3-stabilization-refactor`, branch `fix/m3-stabilization-refactor`, base `fa20c06f8cee5148f39bba685c39dca55b48bd6e` con correzioni consolidate nel commit `e5bba44` (manifest B invariato).

Evidenze grezze locali in `/tmp/jobward-m3-evidence`; i log non sono aggiunti alla repository. Il run 42433287150 della baseline resta un fallimento storico. La correzione ha superato il [run remoto 42506245939](https://github.com/lonelyfrank/jobward/actions/runs/42506245939) sul commit `7ff0ab0`: 2/2 job conclusi con successo. Il presente aggiornamento documentale è successivo a quella prova e deve superare la CI della propria HEAD; gli esiti aggiornati sono nella PR #9.

## Revisioni verificate

La correzione finale elimina pending e usa stato URL/commit sincrono. La precedente variante con reset su popstate è stata invalidata da una nuova riproduzione della ricerca; i suoi risultati non sono accettazione della correzione finale. I tentativi intermedi sono registrati sotto e nella RCA.

Base Git indicata sopra + patch locale. Manifest SHA-256 di 367 file sorgenti/configurazioni/asset, inclusi i nuovi test, esclusi documenti e output generati:

- **A:** `c1c88e504b8aeab3b84c81897e78d9f55df6159bfec33fc55a7dd953f96b6134`, implementazione finale verificata da check ed E2E completo; elenco per-file in `source-manifest-before-preview-test-fix.sha256`.
- **B:** `369bc4ca471fbf729fd47c5fa32f06dec6b219068d7c37fc07edc03db8c0dc52`, patch finale con il solo test preview riallineato; elenco per-file in `source-manifest.sha256`.

Il confronto dei due elenchi mostra **un solo file diverso: apps/web/e2e-preview/preview.spec.ts**. Sorgenti applicativi, configurazioni, SQL, altri test e script sono identici. Dopo questa modifica sono stati rieseguiti typecheck, lint, formattazione e tutta la preview. La suite API/database e l'E2E normale non sono state ripetute per un cambiamento esclusivo del test preview. I file tracciati fuori dal manifest restano identificati dalla base Git; gli altri cambiamenti sono documentali. Commit sorgenti `e5bba44`; pubblicazione autorizzata il 2026-11-08, CI remota della revisione `7ff0ab0` superata (vedi sotto).

## Risultati di accettazione

| Comando              | Esito effettivo                                                                  | Revisione | Durata                   |
| -------------------- | -------------------------------------------------------------------------------- | --------- | ------------------------ |
| pnpm typecheck       | PASS, tutti i package                                                            | B         | 20,24 s                  |
| pnpm lint            | PASS, zero warning                                                               | B         | 43,26 s                  |
| pnpm format:check    | PASS, inclusi i documenti aggiornati                                             | B         | 12,48 s                  |
| pnpm check:contrast  | PASS, token                                                                      | A         | inclusa in check         |
| pnpm check:config    | PASS                                                                             | A         | inclusa in check         |
| pnpm check:brand     | PASS                                                                             | A         | inclusa in check         |
| pnpm test:identity   | PASS                                                                             | A         | inclusa in check         |
| pnpm db:check        | PASS, nessun drift                                                               | A         | inclusa in check         |
| pnpm db:upgrade-test | PASS, tre script: upgrade popolati, isolamento, rollback, 0007 e runner ripetuto | A         | inclusa in check         |
| pnpm test            | PASS: shared 632, schemas 59, web 172, API 428 = **1.291**; zero failed/skipped  | A         | web 36,72 s; API 58,55 s |
| pnpm build           | PASS, Vite + Worker deploy --dry-run                                             | A         | inclusa in check         |
| pnpm check           | PASS, aggregato degli script da typecheck a build                                | A         | **695,11 s**             |
| pnpm test:e2e        | PASS: **237 passed, 1 skipped preesistente, 0 failed, 0 retry Playwright**       | A         | **1289,48 s**            |
| pnpm test:preview    | PASS: **14/14**, zero failure/skip, build e Worker locali                        | B         | **33,92 s**              |

Gli script da typecheck a build sono stati tutti eseguiti in sequenza da pnpm check sulla revisione A. Le durate per sottocomando non sono state campionate dal runner, salvo quelle riportate da Vitest; i tempi dei package concorrenti non vanno sommati. Il gate aggregato usa tempo monotono e termina con exit 0. E2E e preview sono esecuzioni aggiuntive e sequenziali, senza altre suite concorrenti. La preview ricostruisce anche la build Vite.

Prima dei gate completi, l'implementazione finale passa tutti i **172 test frontend** e l'intera suite ricerca **17/17** (1,3 minuti). Ripetizione aggiuntiva dei due casi Back/filtri: **20/20 passati**, dieci per caso, in 2,0 minuti, stessi timeout e asserzioni. Nessun retry automatico Playwright locale.

Lo skip è il confronto visuale manuale opzionale workspace-visual.spec.ts senza WORKSPACE_VISUAL_DIR, già presente nella baseline. Nessuna nuova esclusione. Output browser finale conservato anche in `/tmp/jobward-m3-evidence/final-url-source-test-results`.

## Riproduzioni preliminari

| Comando/caso                                   | Risultato                                                                                      |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| pnpm install --frozen-lockfile --offline       | 518 pacchetti riutilizzati, zero download; lockfile invariato.                                 |
| pnpm typecheck sulla baseline                  | Passato.                                                                                       |
| vitest src/styles/glass.test.ts sulla baseline | 10 passed, 2.02 s.                                                                             |
| Playwright subset originale dei cinque file CI | 54 passed, 8 failed, 11 did not run, 7.0 min; ricerca e zoom non falliscono in quel tentativo. |
| Regressione unitaria Table prima del fix       | 1 failed, 4 passed.                                                                            |
| Regressione Back deterministico prima del fix  | 1 failed: checkbox ancora checked, URL già senza stage.                                        |
| Regressione debounce prima del fix             | 1 failed, 2 passed: stage null anziché saved.                                                  |
| Subset unitario dopo i fix                     | 18 passed su tre file, 7.21 s.                                                                 |
| Regressione Back dopo il fix                   | 1 passed, 15.2 s stack incluso.                                                                |
| pnpm db:upgrade-test preliminare               | Tutti e tre gli script passati; incluso upgrade M1→0007, rollback e API reale locale.          |
| pnpm audit --json                              | 2 moderate dev, zero high/critical; exit 1 per advisory, dettagli in code-health.              |

## Esecuzioni intermedie escluse dall’accettazione

Tentativi nel sandbox falliti per EROFS/EPERM/DNS sono errori ambientali, poi rieseguiti con autorizzazione. Un primo pnpm test con nuova regressione Table ancora intenzionalmente rossa ha fermato il web e interrotto l'API: non è un esito della suite finale. Una riesecuzione browser con cartelle condivise è stata invalidata e interrotta; non entra nei risultati di accettazione.

Durante i gate sono stati corretti errori di tipo/lint nei nuovi test. Una prima suite completa si è fermata sul test del debounce con clock reale (171 passed, 1 failed nel web; API interrotta da pnpm); la variante finale usa tempo virtuale, senza estendere timeout, e il mutation check continua a rilevare il difetto. Un tentativo con userEvent e fake timer è stato interrotto; la versione finale usa eventi DOM con flush React. Il controllo aggiuntivo integrity_check è stato rifiutato da D1 con SQLITE_AUTH: sostituito dal controllo FK supportato, senza modificare migrazioni e senza dichiarare superato il controllo non disponibile.

La prima suite browser completa ha concluso 226 passed, 11 failed e 1 skipped in 21.4 minuti: le failure erano tutte nella nuova matrice estesa, il cui locator della galleria includeva anche la sidebar desktop. I riavvii del worker duplicavano poi la fixture con lo stesso nome. Corretti lo scope a main e il setup immutabile riutilizzabile, senza modificare il prodotto; la matrice mirata è poi passata; la suite completa della variante finale è riportata sopra. Nessuna failure dei test esistenti è stata esclusa per questo motivo.

La matrice finale corretta è passata **16/16 in 1.6 minuti**: 14 casi multivista (84 combinazioni vista/tema/larghezza) più due casi touch. Un tentativo di eseguire check ed E2E contemporaneamente ha concluso 220 passed, 2 failed, 15 did not run e 1 skipped in 1599,63 s, con due timeout locali: setup Colloqui ancora sul caricamento prima di qualunque richiesta API (trace: 272 risorse Vite, zero richieste /api), e caso responsive dark 768 px al limite cumulativo di 30 s dopo cinque navigazioni, con i risultati già renderizzati. Il gate check in quella esecuzione è passato; il risultato browser di quel tentativo non viene usato per l’accettazione; sopra è riportata la successiva esecuzione isolata della variante finale. Questa procedura parallela non riproduce il workflow CI, che impone needs:quality. Nessuna aspettativa o timeout è stata modificata per compensare il carico.

Le esecuzioni individuali preliminari precedono la conferma cumulativa finale: pnpm check riesegue tutti i controlli statici, database, unit/integration e build sul manifest finale indicato sopra. E2E e preview sono gate aggiuntivi e non sono inclusi nello script check. I log e gate-results.jsonl conservano anche i tentativi falliti; non vengono cancellati per presentare soltanto gli esiti verdi.

La prima esecuzione browser sulla variante URL unica è stata terminata con SIGTERM (exit 143 del processo padre) dopo 201 casi completati e zero failure Playwright. Non è arrivata al riepilogo e non è un PASS. La causa del segnale esterno non è determinata; nessuna attribuzione a un timeout dei test. Log e output parziale conservati come `url-source-interrupted-e2e.log` e `url-source-interrupted-test-results`. Il check già concluso resta valido; E2E e preview sono eseguiti separatamente, uno dopo l'altro, sulla stessa patch.

Il primo riavvio E2E è uscito in 1,33 s prima dei test perché la porta 8799 era ancora occupata dagli orfani del run interrotto. Ispezione fuori sandbox: sette processi Wrangler/workerd/Vite con cwd nel solo worktree temporaneo; terminati esclusivamente quei PID dopo verifica dell'ownership. Log `url-source-port-conflict.log`. Nessun server di altri worktree arrestato, nessuna attivazione di reuseExistingServer o modifica delle porte per nascondere il conflitto.

La prima preview della revisione A ha concluso 6 passed, 1 failed e 7 did not run in 44,75 s: il test cercava Impostazioni nella sidebar, poi avrebbe cercato Scuro come menuitemradio. Sorgenti e snapshot confermano la UI corrente: menu account navigabile, tema nei radio delle Impostazioni. Corretto esclusivamente il test (M3S-16); preview B 14/14. Log e trace precedenti conservati in `preview-obsolete-navigation.log` e `preview-obsolete-navigation-results`.

Controllo finale del perimetro: 34 file modificati/nuovi, di cui 18 documenti e 16 file di codice/test; tutte le modifiche non documentali sono coperte dal manifest B e non presentano drift. Presenti tutti i 12 deliverable, nessun collegamento locale interrotto nei documenti aggiornati, git diff --check pulito. Worktree originale ancora pulito a fa20c06. Workflows, configurazioni, lockfile, schema e migrazioni storiche invariati.

## Accettazione remota — PR #9

Revisione `7ff0ab09e8d556031c017e7a7781204dfec0781e`, base main `fa20c06`; run [42506245939](https://github.com/lonelyfrank/jobward/actions/runs/42506245939), stato **completed / success**, tentativo 1. Due job conclusi con successo; nessun gate applicativo in esecuzione sulla revisione indicata.

| Gate remoto              | Risultato                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------- |
| TypeScript               | PASS                                                                                  |
| ESLint                   | PASS, zero warning                                                                    |
| Prettier                 | PASS                                                                                  |
| Contrasto token          | PASS                                                                                  |
| Sicurezza configurazione | PASS                                                                                  |
| Brand                    | PASS                                                                                  |
| Identità dev             | PASS                                                                                  |
| Database drift           | PASS                                                                                  |
| Upgrade database         | PASS, tutti e tre gli script, incluse verifiche 0007                                  |
| Unitari/integrazione     | PASS, 1.291: 632 shared + 59 schemas + 172 web + 428 API                              |
| Build                    | PASS, Vite e Worker dry-run                                                           |
| Playwright E2E           | PASS del job: 236 passed, 1 flaky passato al retry, 1 skipped preesistente (18,4 min) |
| Playwright preview       | PASS, 14/14, nessuno skip (27,8 s)                                                    |

Totale: **13/13 gate**, raggruppati in **2/2 check/job GitHub Actions**. Le otto categorie richieste sono coperte; le due suite Playwright sono step distinti nello stesso job. L'upload degli artifact è saltato per la condizione `if: failure()`, non è un test omesso. Un verde del job non implica assenza di flaky: M3S-15 è ricomparso al primo tentativo e passato al retry già configurato; i log contengono la failure dell'annuncio di movimento da tastiera. Nessuna nuova esclusione, retry, timeout o variazione di workflow introdotta. Il trace del tentativo non è stato pubblicato dal workflow; la causa puntuale resta non dimostrata.

Controllo locale aggiuntivo della review: **18/18** regressioni ricerca/Glass passate; manifest B verificato su 367 file senza drift, formattazione e diff puliti. I risultati locali precedenti conservano il proprio perimetro A/B; quelli remoti provengono dall'esecuzione GitHub e non sono una ripetizione della dichiarazione locale. Nessuna correzione applicativa aggiuntiva necessaria per ottenere i due job verdi. Il consolidamento di questi risultati modifica solo documenti e richiede la CI sulla nuova HEAD: consultare i [check correnti della PR](https://github.com/lonelyfrank/jobward/pull/9/checks) prima del merge.
