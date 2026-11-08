# M3 — quality gate

Ambiente: Fedora Linux, Node 22.23.1, pnpm 12.15.0, Chromium Playwright 1.64.1; stack Worker/workerd e D1 esclusivamente locali. Worktree `/tmp/jobward-m3-stabilization-refactor`, branch `fix/m3-stabilization-refactor`, base `fa20c06f8cee5148f39bba685c39dca55b48bd6e` con correzioni consolidate nel commit `e5bba44` (manifest B invariato).

Evidenze grezze locali in `/tmp/jobward-m3-evidence`, fuori dalla repository. **Accettazione corrente della revisione verificata:** [run 42513587371](https://github.com/lonelyfrank/jobward/actions/runs/42513587371) della PR #10, HEAD `3baeabf`, main `8be8bd2`, completato con successo: 2/2 job, 13/13 gate, 1.291 test, E2E 237 passed + 1 skip preesistente, zero flaky/retry, preview 14/14. I run precedenti restano evidenze storiche distinte. Ogni commit successivo, incluso il consolidamento documentale, deve superare la CI della propria HEAD; esiti aggiornati nella PR.

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

Controllo locale aggiuntivo della review: **18/18** regressioni ricerca/Glass passate; manifest B verificato su 367 file senza drift, formattazione e diff puliti. I risultati locali precedenti conservano il proprio perimetro A/B; quelli remoti provengono dall'esecuzione GitHub e non sono una ripetizione della dichiarazione locale. Nessuna correzione applicativa aggiuntiva necessaria per ottenere i due job verdi. Il consolidamento di questi risultati modifica solo documenti e richiede la CI sulla nuova HEAD: consultare i [check correnti della PR di completamento](https://github.com/lonelyfrank/jobward/pull/10/checks) prima del merge.

## Nuova base main durante la validazione

Main è avanzato esternamente a `ebb9c66` mentre la PR era in validazione. Il branch è stato aggiornato con merge di main senza conflitti; il diff M3 conserva i 34 file revisionati. I nove file applicativi diversi dal manifest B provengono esclusivamente dal commit main, non da altre correzioni M3. La CI verde precedente su `7ff0ab0` resta distinta dalla prova richiesta sulla nuova combinazione. Controlli locali e run conclusivo della HEAD aggiornata sono riportati nella PR; nessun risultato del run precedente viene attribuito automaticamente alla nuova base.

Verifica locale dopo integrazione di `ebb9c66` nel commit `43bf119`: **TypeScript PASS, ESLint PASS, 172/172 test frontend PASS** (19 file). Il confronto Git conferma che i nove file acquisiti coincidono esattamente col commit esterno main. Manifest C: 368 file, SHA-256 `e0a3df8902a86d890802f182f50010d0da1c44230d44f30efdcac109e802c39c`, conservato in `/tmp/jobward-m3-evidence/closure-source-main-ebb9c66.sha256`; include il nuovo BoardScrollbar proveniente da main. Contratti/backend/database e correzioni M3 restano invariati. Il commit documentale successivo non modifica questi sorgenti.

## Regressioni dei test introdotte dalla nuova base

Il run intermedio [42509110535](https://github.com/lonelyfrank/jobward/actions/runs/42509110535) ha concluso **failure**: quality verde, E2E 225 passed / 5 failed / 2 flaky / 1 skipped / 5 did not run; preview saltata dopo il fallimento E2E. Cinque failure deterministiche: aspettative obsolete 60 px per la sidebar ora a 52 px su main. L'onboarding fallisce soltanto nel retry del gruppo seriale dopo la failure sidebar, perché la prima esecuzione ha già creato il workspace; la sua prima esecuzione e la riproduzione locale passano. Il flaky tastiera/zoom resta M3S-15. Log e artifact 13629811670 scaricati ed esaminati, inclusi i trace onboarding/tastiera; nessun fallimento viene omesso dal report.

Riproduzione mirata sulla base aggiornata: **1 passed, 5 failed**, tutte `60px` contro `52px`. Dopo il solo allineamento delle aspettative in app.spec.ts, sidebar.spec.ts e kanban-zoom.spec.ts: **6 passed, 0 failed, 0 retry**, 41,7 s. Conservate le verifiche di scala (13 rem = 58,5 px a font-size 18 px), target 44 px, persistenza, accessibilità e fit. Log: `/tmp/jobward-m3-evidence/closure-sidebar-{red-local-bind,green}.log`. Due tentativi precedenti non hanno eseguito test per il loopback IPv6 assente: config locale temporaneo esterno alla repo, bind Wrangler 127.0.0.1 e DNS IPv4 del processo; nessuna modifica a config tracciate, timeout o asserzioni.

Manifest D dopo la correzione dei soli test: **368 file**, SHA-256 `d152deb42d1bbdbf6bde4de9f21e71b5264529513af3852cdc9333ef59506c79`, file `/tmp/jobward-m3-evidence/closure-source-sidebar-fix.sha256`. I risultati A/B/C e i run precedenti restano riferiti alle rispettive revisioni; l'accettazione conclusiva richiede la CI completa di questa nuova HEAD, riportata nel riepilogo PR.

## Baseline integrata esternamente e PR #10

La PR #9 è stata mergiata esternamente su main `8be8bd2` alle 18:55:28 UTC, sulla HEAD `1576257`, durante la CI e prima del fix sidebar `ebe02f3`. Nessun merge è stato eseguito dall'agente. La PR #10 mantiene lo stesso branch autorizzato e completa le sole correzioni/evidenze rimaste fuori. La base main viene integrata nel branch; manifest D invariato nei sorgenti. La CI da completare è quella della HEAD della PR #10; la baseline main attuale non soddisfa ancora il gate finale e M3 resta non CLOSED.

## Accettazione remota della PR #10 sulla nuova base integrata

[Run 42513587371](https://github.com/lonelyfrank/jobward/actions/runs/42513587371), HEAD `3baeabfb65245bd9b04c0843ccd168883e108fc8`, base main `8be8bd2a2d77b77ba74ad394dfba6be495072217`, tentativo workflow 1: **completed / success**.

| Gate remoto              | Esito effettivo                                                    |
| ------------------------ | ------------------------------------------------------------------ |
| TypeScript               | PASS                                                               |
| ESLint                   | PASS, zero warning                                                 |
| Prettier                 | PASS                                                               |
| Contrasto                | PASS                                                               |
| Configurazione sicurezza | PASS                                                               |
| Brand                    | PASS                                                               |
| Identità dev             | PASS                                                               |
| Database drift           | PASS                                                               |
| Upgrade database         | PASS, tre script, 0000–0007 locali                                 |
| Unitari/integrazione     | PASS: 632 shared + 59 schemas + 172 web + 428 API = 1.291          |
| Build                    | PASS, Vite e Worker dry-run                                        |
| Playwright E2E           | 237 passed, 1 skipped preesistente, 0 failed/flaky/retry, 13,0 min |
| Playwright preview       | 14/14 passed, 0 skipped, 22,2 s                                    |

**13/13 gate in 2/2 job conclusi con successo.** Quality job 128831734093; browser job 128833824231. Nessun gate richiesto omesso o in esecuzione sulla revisione indicata. Upload artifact saltato dalla condizione del workflow, non un test mancante. Log scaricati e letti: `closure-ci-42513587371-{quality,browser}.log`, fuori dal repository.

Il precedente run 42511488244 sulla HEAD 1576257, senza M3S-17, è fallito con le stesse cinque aspettative sidebar: 226 passed / 5 failed / 1 flaky onboarding nel retry seriale / 1 skipped / 5 did not run; quality verde, preview non eseguita. Il confronto dei run conferma il passaggio delle regressioni dopo il fix, senza cambiarne i timeout o la configurazione CI. M3S-15 è passato al primo tentativo nell'accettazione PR #10, senza essere dichiarato definitivamente risolto.

Manifest D (368 file, `d152deb42d1bbdbf6bde4de9f21e71b5264529513af3852cdc9333ef59506c79`) ricontrollato senza drift. Il consolidamento documentale successivo non modifica sorgenti/test/configurazioni: richiede comunque tutti i check sulla nuova HEAD. La verifica conclusiva di quella HEAD viene riportata nel riepilogo PR, evitando un ciclo di commit che registrano se stessi. Nessuna attestazione CLOSED prima del merge e della verifica della nuova main.
