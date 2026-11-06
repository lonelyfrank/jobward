# Stabilizzazione CI dopo la PR #6 (baseline `ab73c1a`)

**Data:** 2026-11-06 · **Branch:** `fix/m3-e2e-stabilization` · **Base:** `origin/main` = `ab73c1a`

## Stato iniziale

`main` (merge della PR #6) aveva la CI rossa: job «Typecheck · Lint · Test · Build» verde, job «E2E (Playwright)» rosso
(run 42120937033: 138 passati, 2 falliti, 1 flaky, 12 non eseguiti). Anche la run della PR #6 era rossa.

## Cause individuate

| #   | Sintomo in CI                                                               | Natura                        | Causa reale                                                                                                                                                                                                                                                                                 |
| --- | --------------------------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `hardening.spec` 390 px: «Apri bacheca →» 96×20 px                          | **Bug applicativo**           | Il link della card bacheca (`aria-hidden`, `tabIndex=-1`, ma cliccabile al tocco) era alto ~20 px. Compare solo se esistono bacheche: isolato passava (pagina vuota), in suite no. Rimosso l'effetto d'ordine seminando una bacheca nel test.                                               |
| 1b  | (emerso riproducendo l'1 in isolamento)                                     | **Bug applicativo**           | Dashboard senza opportunità: il link «Aggiungi la prima opportunità» era 200×20 px. In suite era nascosto dai dati di altri spec.                                                                                                                                                           |
| 2   | `search.spec` retry: `post /labels → 409`, «12 did not run»                 | **Fixture**                   | Un gruppo `serial` che fallisce viene rieseguito da capo, `beforeAll` incluso, su un DB che conserva i dati del primo tentativo: la creazione dell'etichetta «Interessante» dava 409. Non è un difetto dell'API. Il 409 ha nascosto la causa vera (3) e moltiplicato i test «non eseguiti». |
| 3   | `search.spec` test 4: dopo `goBack()` «0 risultati» invece di «2 risultati» | **Sincronizzazione del test** | La vista mostra subito lo stato scelto (ottimistico) e la voce di cronologia nasce quando l'URL è aggiornato. Il test premeva «Indietro» ~200 ms dopo il clic, prima del commit dell'URL (trace CI: nessuna richiesta dopo il `goBack`, vista rimasta su `stage=saved`).                    |

## Interventi

- `board-card.tsx`, `overview.tsx`: area di tocco ≥ 44 px **solo sotto `md`** (`max-md:` con margine negativo: nessun cambio desktop né di layout visibile).
- `e2e/helpers.ts`: `findBoard()`; `label()` idempotente (riusa l'etichetta su 409).
- `e2e/search.spec.ts`: `beforeAll` riusa i dati già presenti; il test 4 attende l'URL (`stage=saved`) prima di `goBack()` e poi la sua scomparsa.
- `e2e/hardening.spec.ts`: il test dei 44 px semina una bacheca, così non dipende dai dati lasciati da altri file.

## Verifica

| Controllo                                                        | Esito                                                     |
| ---------------------------------------------------------------- | --------------------------------------------------------- |
| typecheck / lint / format:check                                  | verdi                                                     |
| `check:contrast`, `check:config`, `check:brand`, `test:identity` | verdi                                                     |
| `db:check`, `db:upgrade-test`                                    | verdi                                                     |
| `pnpm test`                                                      | shared 597, schemas 43, web 128, api 310 — tutti passati  |
| `pnpm build`                                                     | verde                                                     |
| `pnpm test:e2e` (CI=true, suite completa)                        | **153 passati, 1 skipped, 0 falliti, 0 flaky** (10,6 min) |
| `pnpm test:preview`                                              | **12 passati**                                            |
| Test 44 px senza la correzione dell'app                          | rosso (riprodotto), verde con la correzione               |
| Test 4 con l'attesa dell'URL, `--repeat-each=8`, CPU satura      | 8/8                                                       |

## Limiti dichiarati

- La causa 3 è dedotta dalla trace e dai tempi; il fallimento **senza** la correzione **non** è stato riprodotto in locale (il tentativo con una variante temporanea del file è stato bloccato da un controllo di sicurezza e non è stato aggirato). La correzione è verificata come stabile, non provata come unica causa.
- Il ramo `409 → riuso` di `label()` non è esercitato dai test (il riuso della bacheca lo precede): è una difesa a costo ridotto.
- Il flake locale di `pnpm test` (pacchetto web, `app.test.tsx`: «Unable to find role=heading») era reale ed è stato **diagnosticato dopo**: sotto CPU satura `findBy*` (1 s) non basta per le rotte caricate in modo pigro (riprodotto: 1–2 test su 2 di 3 esecuzioni). Corretto con `asyncUtilTimeout: 5000` e `testTimeout: 20000` (solo tetti massimi); con la stessa CPU satura 4/4 verdi. Non toccava la CI remota (lì passava), ma poteva comparire.
- La verifica sulla CI remota è **pendente** fino al push del branch e all'esecuzione di GitHub Actions.
- Osservazione non toccata: `wrangler` mostra ancora `database_name` `meet-roulette` (etichetta D1 persistente conservata per scelta di ADR-0014).
