# ADR-0018 — Repository di lancio: nessuna storia pubblicata, documentazione storica fuori da `main`

**Stato:** Accettato · **Data:** 2026-11-22 · **Decisore:** proprietario del prodotto («non pubblichiamo la storia; non salviamo il vecchio main») · **Supera:** la regola «un documento superato non si elimina né si sposta» di [MEMORY-SYSTEM](../../agents/MEMORY-SYSTEM.md) per i report delle milestone.

## Contesto

`jobward-v1` diventa la versione di lancio e sostituisce il contenuto di `main` nella repository GitHub, che è **pubblica**. Due problemi:

1. La storia git contiene dati personali del proprietario (titoli e aziende di candidature reali inserite per provare l'app).
2. Circa l'85% dei byte di `docs/` era storico: report delle milestone M0.H–M4 (`docs/m0h` … `docs/m4`, con ~11 MB di screenshot) e report di audit SW.10 (`docs/roadmap/sw10-*.md`). Ogni ricerca testuale restituiva quei file, costosi in token e spesso in conflitto con il codice attuale (descrivono rami, migrazioni e strumenti che non esistono più).

## Decisione

1. **`main` riparte da un unico commit radice** con il contenuto di `jobward-v1`: nessuna storia precedente viene pubblicata e il vecchio `main` non viene archiviato con tag o rami remoti. L'esecuzione (commit, push forzato, eliminazione dei rami remoti) richiede comunque l'autorizzazione esplicita del proprietario per ciascuna azione.
2. **Rimossi da `main`:** `docs/m0h`, `docs/m1`, `docs/m2`, `docs/m25`, `docs/m3`, `docs/m3-ui1`, `docs/m3-ui2`, `docs/m4`, `docs/roadmap/sw10-*.md`, `docs/roadmap/m0-delivery.md`.
3. **Archivio:** quei documenti restano soltanto nella storia git **locale** del proprietario (ramo `jobward-v1` fino al commit precedente al lancio), non pubblicata. Si consultano con `git log --all -- 'docs/m3/*'` e `git show <commit>:docs/m3/plan.md`. [history/README](../../history/README.md) elenca che cosa conteneva l'archivio.
4. **Fonti dopo il lancio:** il codice, poi i documenti canonici (`docs/product`, `docs/architecture`, `docs/features`, `docs/development`, `docs/status`, `docs/user`, `docs/ux`). Commenti nel codice e documenti rimandano solo a file presenti nella repository.
5. **Limiti verificati da `pnpm check:docs`** (parte di `pnpm check`): dimensione dei file di bootstrap, collegamenti relativi validi, nessun riferimento alle cartelle archiviate, peso delle immagini della documentazione.
6. **Dopo il lancio:** il worktree di lavoro estrae `main` con upstream `origin/main`, e i push partono da lì. `jobward-v1` resta un ramo **solo locale** con la storia (contiene dati personali) e non va mai pushato, nemmeno con `git push --all`. I commit pubblici usano l'indirizzo noreply di GitHub come email dell'autore.

## Alternative scartate

- **Pubblicare la storia o un tag `archive/pre-v1`:** espone i dati personali presenti nei commit passati.
- **Riscrivere la storia togliendo solo i dati personali:** costoso e fragile (i dati compaiono in commit, documenti e messaggi); il valore della storia per i lettori futuri è basso rispetto ai documenti canonici.
- **Spostare i report in `docs/history/`:** non riduce né il rumore nelle ricerche né il peso della repository.

## Conseguenze

- Positive: repository leggera, ricerche pulite, nessun dato personale pubblicato; le regole valide sono nei documenti canonici e nel codice.
- Negative: le motivazioni di dettaglio delle decisioni passate (piani, registri dei problemi, report di test) non sono più consultabili da chi clona la repository. Le decisioni che contano restano negli [ADR](README.md). Chi ha bisogno del dettaglio storico deve chiederlo al proprietario.
- Gli SHA di commit citati nei documenti («Verificato su: `b34c032`») non esistono nella repository pubblica: restano validi solo nella copia locale. Dopo il lancio i documenti citano il primo commit pubblico o una data.
- I collegamenti alle cartelle archiviate sono stati sostituiti da testo o da rimandi ai documenti canonici. `pnpm check:docs` impedisce che ricompaiano.
