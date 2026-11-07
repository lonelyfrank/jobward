# M3-C3 — Verifica remota e chiusura

**Data:** 2026-11-07 · **Branch:** `m3-c3-closure-tasks-design` (da `origin/main`) · **Baseline:** `origin/main` = `5a0d056eda`.
I report [consegna](c3-delivery.md), [verifiche](c3-testing-report.md) e [registro](c3-issue-register.md) restano **documenti storici**: descrivono il lavoro come era al momento della consegna
(quando il push non era ancora avvenuto). Questo documento registra **ciò che è accaduto dopo** e **non** modifica gli esiti ottenuti allora.

## 1. Stato Git iniziale (verificato)

| Controllo                    | Esito                                                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `git fetch --all --prune`    | eseguito                                                                                                                                                             |
| Checkout iniziale            | `m3-c3-application-workflow-ui` @ `5a0d056`, **0 avanti / 0 indietro** rispetto a `origin/main`; working tree **pulito**                                             |
| HEAD di `origin/main`        | `5a0d056eda` = baseline indicata. **Nessun commit successivo**                                                                                                       |
| Pull request                 | 7 in totale, tutte integrate (l'ultima: #7, C2). **Nessuna PR per C3**                                                                                               |
| Come C3 è arrivata in `main` | **push diretto** del 2026-11-07 04:35 (+01:00): non esiste un ramo remoto C3 né una PR, e `main` non è protetta. Contraddice i documenti C3 («nessun push»): vedi §6 |

## 2. Quality gate remoto — run [42334739111](https://github.com/lonelyfrank/jobward/actions/runs/42334739111) (push su `main`, 18 min)

| Job / passo                     | Esito                                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| Typecheck · Lint · Test · Build | **verde** (4 min 47 s)                                                                    |
| E2E — `pnpm test:e2e`           | **verde**: 176 passati, 1 saltato (il collector visuale opzionale preesistente), 11,8 min |
| E2E — `pnpm test:preview`       | **rosso**: 8 passati, **1 fallito**, 1 «flaky», **3 non eseguiti** (13 test)              |
| Artefatti                       | `playwright-reports` (5 MB, non scaduto): scaricato e analizzato                          |

Esito complessivo: **CI rossa su `main`**. Il job E2E è marcato rosso a causa del solo passo preview.

## 3. Causa reale

Il test fallito è `e2e-preview/preview.spec.ts:302` («M2.5: modale ampia, schede, colloqui…»): _Test timeout of 30000ms exceeded_.
Il «flaky» (`:137`, onboarding) è una **conseguenza**, non una causa.

**Evidenze (dalla trace e dallo screencast dell'artefatto):**

1. L'azione `Click` su `dialog › button "Aggiungi colloquio"` **non termina mai**: 60 cicli «waiting for element to be visible, enabled and stable → _element is not visible_ → retrying», per ~30 s.
2. Il pulsante risolto ha classi `border-border-strong bg-surface … h-10 px-4`: è la variante **secondaria `sm`** del riepilogo della **Panoramica**; il pulsante della scheda Colloqui è primario e di taglia piena.
3. Il fotogramma dello screencast, **62 ms dopo l'inizio del clic**, mostra la scheda Colloqui già resa con il suo pulsante visibile.
4. `toHaveURL(/#colloqui$/)` passa in **8 ms**: l'URL cambia in modo sincrono (guardia C3-05) **prima** che la scheda risulti selezionata e il pannello attivo.
5. Localmente lo stesso test dura ~1,9 s e passa: dipende dalla velocità del runner.

**Meccanismo.** Dopo il clic sulla scheda, il test attende solo l'URL. Se la Panoramica è ancora il pannello visibile, `getByRole` trova **un solo** pulsante «Aggiungi colloquio» (quello della Panoramica);
un attimo dopo la Panoramica viene nascosta, ma l'elemento resta collegato al DOM e Playwright continua a interrogare **quello stesso elemento** invece di risolvere di nuovo il locator.
Poi il gruppo `serial` fallito viene rieseguito da capo su un database che conserva il workspace già creato: da qui il secondo fallimento («Crea il tuo spazio di lavoro» non trovato) e i 3 test non eseguiti
(stesso meccanismo della causa 2 in [ci-stabilization.md](ci-stabilization.md)).

**Natura: difetto di sincronizzazione del test, non del prodotto.** Un pannello inattivo che resta montato e nascosto è il comportamento voluto (D2/C3); non è esposto agli screen reader.
Lo stesso schema di attesa («attendi la selezione ARIA, non solo l'URL») era già stato applicato ai test unitari di C3 ([rapporto](c3-testing-report.md)) ma non alla suite preview.

## 4. Correzione (commit `f359630`)

Nei quattro punti di `preview.spec.ts` in cui si cambiava scheda con un clic diretto si usa l'helper già esistente `openTab()` (attende `aria-selected="true"`).
**Nessuna modifica al prodotto, nessun timeout aumentato, nessun test disabilitato.**

**Prova rosso → verde** (build di produzione + CSP reale, throttling CPU via CDP, solo nel test 302, riga temporanea poi rimossa):

| Throttling CPU | Spec originale (`5a0d056`)                           | Spec corretta                                                                                              |
| -------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| 6× (4 giri)    | **fallita 4/4**: test 302 in timeout, 3 non eseguiti | **passata 4/4** (13/13)                                                                                    |
| 10× (1 giro)   | passata                                              | passata                                                                                                    |
| 25× (1 giro)   | —                                                    | fallita per il timeout globale di 30 s (tutto 25 volte più lento): **non discrimina, esclusa dalla prova** |
| nessuno        | 13/13                                                | 13/13                                                                                                      |

Il guasto riprodotto ha la **stessa firma** della CI (test 302 in timeout, 3 non eseguiti). A 10× l'originale passa: la race dipende dal timing, per questo la prova è probabilistica.
Il throttling è una **simulazione** del runner lento, non la riproduzione dell'ambiente di CI.

## 5. Quality gate locale dopo la correzione

Eseguito sul working tree del branch `m3-c3-closure-tasks-design` (commit `f359630` + documentazione). Tutti i comandi con exit 0.

| Comando                                                                                                                 | Esito                                                                           |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `pnpm check` (typecheck, lint, format:check, contrast, config, brand, identity, db:check, db:upgrade-test, test, build) | **verde**, exit 0                                                               |
| — `pnpm test`                                                                                                           | shared 599, schemas 49, web 142, API 389 = **1.179 passati**                    |
| — `db:upgrade-test`                                                                                                     | 0002 → 0005 e M2.5 → 0005: OK                                                   |
| `pnpm test:e2e`                                                                                                         | **176 passati, 1 saltato** (collector opzionale preesistente), 13,2 min, exit 0 |
| `pnpm test:preview`                                                                                                     | **13/13 passati**, exit 0                                                       |
| GitHub Actions sul commit corretto                                                                                      | **non eseguito** (nessun push autorizzato)                                      |

Questi risultati locali non sostituiscono la CI remota: in locale anche la spec originale passava 13/13, quindi la sola esecuzione locale non avrebbe rivelato il difetto.

## 6. Discrepanze documentali corrette

| Documento storico                                                       | Cosa diceva                                         | Realtà verificata                                                      | Dove è corretto                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| c3-delivery, c3-testing-report, c3-issue-register (C3-01), plan, README | «CI remota C3 non eseguita; nessun push, PR, merge» | C3 è in `main` (`5a0d056`, push diretto); CI **eseguita e rossa** (§2) | note di aggiornamento in testa + [registro](c3-issue-register.md), README, [milestone](../roadmap/milestones.md) |
| c3-delivery («Baseline verificata `8071759`»)                           | base del lavoro C3                                  | corretta come **base di sviluppo**; la baseline attuale è `5a0d056`    | invariato (è storia); baseline corrente qui sopra                                                                |

I numeri di test della consegna (1.179 unit/integrazione, 176 E2E, 13 preview) **non sono riscritti**: sono quelli ottenuti localmente allora; la CI conferma 176 E2E, e il preview 13 era passato in locale.

## 7. Problemi

| ID    | Priorità | Stato                                            | Descrizione                                                                                                                                     |
| ----- | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| C3-01 | P2       | **Eseguita: rossa** (era «da eseguire»)          | CI remota di C3 su `main`: rossa per C3-07. Vedi [registro](c3-issue-register.md)                                                               |
| C3-07 | **P1**   | **Corretto in locale; conferma remota pendente** | Race di sincronizzazione nel preview 302 (§3–§4). P1 perché tiene **rossa `main`**; non è una regressione di prodotto                           |
| C3-08 | P3       | Aperto                                           | `main` non è protetta e C3 vi è entrata senza PR né CI preventiva (è così che un rosso è arrivato in `main`). Decisione di processo dell'utente |

## 8. Esito della Parte A

| Criterio di uscita                        | Esito                                                                             |
| ----------------------------------------- | --------------------------------------------------------------------------------- |
| Baseline identificata                     | ✅ `5a0d056eda`                                                                   |
| Esito remoto verificato e documentato     | ✅ rosso, causa individuata                                                       |
| Nessuna regressione P0/P1 nota            | ⚠️ **C3-07 (P1) corretto in locale; non verificato in CI** (push non autorizzato) |
| Documentazione coerente con il repository | ✅ (questo documento, README, roadmap, registro, note storiche)                   |
| Modifiche con test pertinenti superati    | ✅ vedi §4 e §5                                                                   |

**M3-C3 NON è dichiarato definitivamente chiuso.** La correzione è locale e provata, ma la **CI remota del commit corretto non è stata eseguita**: non va considerata superata.
Per chiudere: push autorizzato → run di GitHub Actions verde sul commit `f359630` (o successivo).
La Parte B (progettazione di Attività e follow-up) procede **come analisi separata** e **non** afferma la chiusura di C3: [tasks-index.md](tasks-index.md).
