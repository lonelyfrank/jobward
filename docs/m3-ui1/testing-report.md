# M3.UI.1 — Report di verifica

Data: 5 novembre 2026. Ambiente: Node 22.23.1, pnpm 12.15.0, Vitest 4.1.12, Playwright Chromium locale; Worker/SQLite D1 locali con migrazioni reali. Nessuna CI remota o verifica di Cloudflare Access reale.

## Baseline

[Audit](audit.md): typecheck/lint superati; Prettier rilevava una tabella già non formattata in `docs/m3/c1-issue-register.md`, corretta senza cambiarne i contenuti. 597 shared, 43 schemas, 306 API, 120 web superati. I test Glass locali iniziali sono stati rimossi da un’operazione esterna, confermata dall’utente: nella base finale non sono previsti.

## Controlli finali

| Controllo                                  | Risultato                                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| TypeScript strict su tutti i package       | Superato                                                                                                 |
| ESLint type-aware/hooks/a11y, zero warning | Superato                                                                                                 |
| Prettier                                   | Superato                                                                                                 |
| Contrasto dei token light/dark             | Superato                                                                                                 |
| Configurazione Cloudflare e branding       | Superati                                                                                                 |
| Identità locale conservativa               | 5 test superati                                                                                          |
| Coerenza schema/migrazioni                 | Superata, nessuna migrazione creata                                                                      |
| Upgrade DB da M1 attraverso M2.5           | Superato: 601 schede, 60 archiviate, dettagli/storico e vincoli preservati                               |
| Shared                                     | 597 test superati                                                                                        |
| Schemas                                    | 43 test superati                                                                                         |
| Web                                        | 114 test superati, 12 file                                                                               |
| API                                        | 310 test superati, 21 file; anche 4/4 mirati dopo correzione limite D1                                   |
| Build frontend + packaging Worker dry-run  | Superati; nessun deploy                                                                                  |
| Anteprima della build con CSP reale        | 12/12 superati                                                                                           |
| E2E direttamente coinvolti                 | 62 scenari distinti verificati nei giri finali: 38 bacheche/brand/Kanban/sidebar + 24 app/ricerca/azioni |
| Catture visive                             | 1/1 prima e 1/1 dopo: 60 + 64 screenshot                                                                 |

`pnpm check` conclusivo è passato con exit code 0. Il conteggio finale unit/integration è 1064 test (oltre ai 5 test di identità del gate). La registrazione esplicita dei matcher DOM in `src/test/setup.ts` assicura che `toBeInTheDocument`, `toHaveClass` e gli altri matcher siano aggiunti all’istanza del runner, anche con la risoluzione workspace/Vite. Non modifica codice di produzione o dipendenze.

## Copertura

- Componente: apertura dal pulsante, focus iniziale, Esc e ritorno al trigger, Ctrl+K, focus confinato, frecce/Invio e apertura Colloqui, categorie, stato iniziale/vuoto/errore, debounce, cancellazione alla chiusura, risultati precedenti nascosti e menu senza azioni fittizie.
- API: cross-board, campi professionali, nome e descrizione bacheca, fase tecnica/italiana, schede archiviate, colloqui con/senza data, tipi in italiano, date ISO/gg/mm/aaaa, maiuscole/accenti/NFD, parole AND, query a sei parole, caratteri jolly letterali, limiti, query invalide e isolamento fra workspace. L’enumerazione delle rotte nei test di sicurezza include la nuova rotta autenticata.
- Browser: nessuna navbar nelle cinque viste; Search in ogni header; Ctrl/Cmd+K; focus trap/ritorno; chiusura overlay; query obsolete annullate; apertura della risorsa originale e scheda Colloqui; creazione di schede/bacheche/colonne; modifica, preferiti, archivio/ripristino; drag-and-drop mouse/tastiera/touch e rollback; ricerca locale e filtri; tema, account e sidebar compressa/drawer.
- Axe WCAG A/AA, nomi accessibili, focus visibile, touch target, overflow e collisioni dropdown. Nuova ricerca/menu provati in light/dark su 1920×1080, 1366×768, 768×1024, 390×844 e 320×568. I controlli responsive ereditati coprono anche 1024/1360 px.
- Produzione locale: tutti i 12 scenari di anteprima verificano header, CSP, fallback SPA, API, navigazione, menu, drawer, Kanban, dati professionali, colloqui e nuova ricerca; nessuna violazione CSP o errore applicativo raccolto.

## Esecuzioni e correzioni

Il primo giro esteso Playwright ha eseguito 135 casi: 107 passati, 6 falliti, 21 non eseguiti per dipendenze seriali e 1 visuale opt-in saltato. Non è dichiarato superato. Le correzioni hanno riguardato tooltip che intercettava Actions, aspettative di test sul vecchio spazio Kanban e sull’ordine dei controlli account/sidebar, selettori ambigui fra opportunità e colloqui, attesa della chiusura asincrona della scheda e precisione numerica dei 44 px durante l’animazione. Un caso di creazione è stato disturbato da HMR durante la formattazione: ricontrollato con sorgenti stabili.

Nel giro successivo sono passati 38 casi di bacheche/brand/Kanban/sidebar. Il giro conclusivo `app.spec.ts workspace-actions.spec.ts` è passato **24/24**. La ricerca reale cross-board è stata ulteriormente ricontrollata dopo la correzione SQL. I restanti 72 scenari delle altre suite erano passati nel primo giro; non vengono presentati come una nuova esecuzione completa finale. Nessun test non eseguito è contato come superato.

Un test aggiuntivo al limite di sei parole ha trovato `D1_ERROR: Expression tree is too large (maximum depth 100)`. Risolto materializzando una sola volta i documenti normalizzati prima dei confronti. Regressione verificata tramite servizio e HTTP, sia per opportunità sia per colloqui. Un tentativo sandbox di `db:check` aveva prodotto una segnalazione generica di divergenza: fuori sandbox il controllo è passato; schema e migrazioni sono invariati.

## Confronto visivo

[Galleria prima/dopo](screenshots.md). Stesso dataset e font, sei viste (galleria e Kanban contati separatamente), due temi, cinque viewport. Ispezionati layout, allineamento, titolo/comandi, target mobile, tabella e contrasto. Su Overview desktop il titolo e le statistiche salgono di 86 px; nessun offset residuo. Screenshot extra con ricerca popolata e dropdown a fine animazione nei due temi.

## Limiti e raccomandazioni

- Nessun P0/P1 noto nei flussi verificati; non sono stati eseguiti Firefox/WebKit, screen reader reali, tastiera virtuale su dispositivo fisico o CI remota. Viewport piccoli e dimensioni dinamiche CSS sono coperti dal browser locale, senza dichiarare una prova su hardware reale.
- Accenti latini comuni esplicitamente normalizzati; non è una normalizzazione universale di ogni alfabeto. Date colloquio cercate e mostrate nella proiezione in UTC (ISO e gg/mm/aaaa); formati locali aggiuntivi sono futuri.
- Nessun carico sintetico al tetto di 200.000 schede. Le letture restano limitate in risposta e isolate al workspace; misurare dataset reali prima di valutare FTS e indici, che richiederebbero una milestone con migrazioni.
- Jello Glass Subtle rimane un’integrazione futura, con punto di adattamento documentato nella variante `search` del Dialog. Attività escluse perché non implementate; nessuna funzionalità M4 introdotta.
- Warning dev `HydrateFallback` preesistente; nessun nuovo errore applicativo significativo nei controlli browser conclusivi.

## Riproduzione

```bash
pnpm check
pnpm --filter @jobward/web exec playwright test app.spec.ts boards.spec.ts brand.spec.ts kanban.spec.ts sidebar.spec.ts workspace-actions.spec.ts
pnpm test:preview
WORKSPACE_VISUAL_EXTRAS=1 WORKSPACE_VISUAL_DIR="$PWD/docs/m3-ui1/after" \
  pnpm --filter @jobward/web exec playwright test workspace-visual
```

I test Workers, Drizzle e browser richiedono permesso di aprire processi/porte locali: gli errori di sandbox non sono test passati né regressioni di dati. La baseline visiva M3 è stata catturata da una copia temporanea con font/dependency resolution coerenti, senza cambiare branch o ripristinare il checkout di lavoro.
