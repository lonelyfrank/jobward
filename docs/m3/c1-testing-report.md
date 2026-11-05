# M3-C1 — Testing report

**Data:** 2026-11-05 · **Branch:** `m3-application-workflow` · **Baseline:** `0000550`

## Ambiente e risultati

Node 22.23.1, pnpm 12.15.0, Vitest 4.1.12, Playwright Chromium. Le suite Worker/browser sono state eseguite localmente con permessi di processo e rete loopback necessari; nessuna risorsa remota è stata creata o migrata. I dati di E2E e anteprima sono nei rispettivi stati di test dedicati, separati dal database dev persistente.

| Controllo                                                 | Risultato effettivo                                                                                                       |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --lockfile-only --ignore-scripts --offline` | Passato; lockfile rigenerato da pnpm, sole rinomine di dipendenze workspace                                               |
| `pnpm install --frozen-lockfile --offline`                | Passato, anche dopo le modifiche finali; nessuna nuova dipendenza                                                         |
| `pnpm check` finale                                       | **Exit 0**; typecheck, lint zero warning, format, contrasto, configurazione, branding, identità, migrazioni, test e build |
| Shared                                                    | **597/597**, 7 file                                                                                                       |
| Schemas                                                   | **43/43**, 1 file                                                                                                         |
| Web                                                       | **109/109**, 11 file                                                                                                      |
| API/integrazione Workers                                  | **306/306**, 20 file                                                                                                      |
| Totale unitari/integrazione                               | **1.055/1.055** in 39 file, contro 472 alla baseline                                                                      |
| Procedura identità SQLite                                 | **5/5**, inclusi schema reale M2.5, dry-run, apply temporaneo, collisione e sorgente assente                              |
| Build frontend                                            | Passata; PNG originali inclusi come asset con hash                                                                        |
| Build Worker                                              | Passata con `wrangler deploy --dry-run`; nessun deploy                                                                    |
| E2E completi finali                                       | **118/118**, exit 0, 8,7 minuti                                                                                           |
| Anteprima finale                                          | **11/11**, exit 0, 26,4 secondi (ripetizione dopo la targa; primo giro 32,3 s)                                            |
| Ricerca isolata dopo primo fallimento E2E                 | **16/16** in 1,2 minuti                                                                                                   |
| Migrazioni storiche e snapshot                            | Tutti gli 11 file corrispondono agli hash SHA-256 iniziali                                                                |
| Database dev esistente                                    | La SELECT via Wrangler dopo il rename ritrova l'email originale; nessun reset o cambio identità applicato                 |

## Copertura C1

- **112 combinazioni** fase/esito/archivio, con `null`, precedenza archivio a timestamp `0`, esiti conclusivi e fasi legacy. `closed` senza esito ha fallback neutro e diagnostica.
- **400 combinazioni** fra dieci stati sorgente, dieci destinazioni e quattro tipi di transizione. Verificati salti in avanti, chiusure, assunzione da Offerta, riapertura, correzione, blocco archiviate e controllo ottimistico.
- Round-trip dei nove stati non archiviati verso `stage/outcome`, senza nuova colonna persistente. Correzione esplicita di stato legacy e normalizzazione dell'esito nullo con evento identificabile.
- Riepilogo colloqui riusato senza query: appuntamenti futuri/scaduti, annullati, completati senza feedback, da programmare e nessun round. Input congelati o confrontati prima/dopo.
- Compatibilità con tutti i 17 tipi di evento persistenti, riapertura solo nel dominio, collegamenti a entità, tie-break per ID/source, dedupe di lettura, conflitti di identità e chiavi di intento stabili e senza collisioni da separatori.
- Whitelist dei metadati: testi privati e oggetti inattesi scartati; testo delle note confinato alle voci manuali, senza copia negli eventi.
- Azioni nei dieci contesti, priorità, assenza di duplicati e nessuna mutazione degli input. I moduli compilano nel pacchetto shared senza tipi browser o Cloudflare.
- Tre regressioni web sulle preferenze browser precedenti: copia conservativa, precedenza delle nuove chiavi e barra laterale.
- Un nuovo E2E del marchio verifica caricamento asset, proporzione, temi, nome accessibile, axe, simbolo compatto, mobile senza overflow e favicon originale. Catture effettuate dopo la fine delle animazioni.

## Tentativi precedenti e correzioni

1. Il primo controllo completo si è fermato a Prettier in quattro file: il nome più corto degli import cambiava il wrapping. Correzione di sola formattazione, poi nuovo controllo completo.
2. `check:brand` ha individuato un URL legacy nella fixture di autenticazione pubblica: sostituito con il nome nuovo. Le aspettative fail-closed sono invariate.
3. Il primo giro E2E: **105 passati, 1 fallito, 12 non eseguiti**, in 7,4 minuti. Il test ricerca n. 4 attendeva due risultati dopo “Indietro” e ne mostrava zero. Il giro si sovrapponeva alle modifiche dei moduli condivisi; questa è una possibile interferenza, **non una causa dimostrata**. La suite ricerca sul codice stabile passa 16/16; il giro completo ripetuto senza ulteriori modifiche applicative passa **118/118**.
4. Le prime catture del simbolo compatto/drawer erano durante l'animazione. Il test ora attende le animazioni finite, senza aggiungere attese arbitrarie.

## Verifica finale del contrasto del marchio

Dopo il giro completo, una misura sui colori rappresentativi del PNG ha rilevato un rapporto di circa **2,48:1** tra il viola più saturo e la sidebar scura. Il simbolo compatto è stato quindi presentato su una targa bianca, conservando tutti i pixel originali. Il wordmark scuro era già su fondo bianco.

Campioni rappresentativi: testo `(11,15,42)` sulla sidebar chiara **17,40:1**, testo sulla targa bianca **18,66:1**; il simbolo più saturo e quello lavanda sulla nuova targa bianca hanno rapporto circa **7,5:1** e **3,1:1**. Sono misure di campioni, non una dichiarazione di contrasto minimo su ogni pixel del gradiente. Il controllo WCAG dei token UI e le analisi axe rimangono verdi.

L'unica modifica visiva successiva al giro completo è la targa del simbolo. Verifiche supplementari: **1/1 E2E marchio** (22,4 s), **11/11 anteprima** (26,4 s) con nuova build, typecheck completo e lint dei file toccati verdi. Il giro E2E completo precedente resta 118/118; non viene descritto come rieseguito dopo questa sola modifica di presentazione. Log misure: `/tmp/jobward-c1-logo-contrast.log`.

## Log locali

- `/tmp/jobward-c1-lockfile.log`, `/tmp/jobward-c1-install-final.log`.
- `/tmp/jobward-c1-check.log` (primo controllo, fallito solo a format) e `/tmp/jobward-c1-check-final.log` (exit 0).
- `/tmp/jobward-c1-domain-tests.log`, `/tmp/jobward-c1-pipeline-tests.log`, `/tmp/jobward-c1-schemas-tests.log`.
- `/tmp/jobward-c1-identity-tests.log`, `/tmp/jobward-c1-local-db-check.log`.
- `/tmp/jobward-c1-e2e.log` (primo giro), `/tmp/jobward-c1-search-retest.log`, `/tmp/jobward-c1-e2e-final.log`.
- `/tmp/jobward-c1-preview.log`, `/tmp/jobward-c1-preview-final.log`, `/tmp/jobward-c1-brand-final.log`, `/tmp/jobward-c1-typecheck-last.log`, `/tmp/jobward-c1-brand-lint-last.log` e `/tmp/jobward-c1-format-final.log`.
- Le catture del marchio sono negli artifact ignorati `apps/web/test-results/brand-*/brand-{light,dark,collapsed,mobile}.png`.

Le durate e i conteggi dei browser finali sono confermati dai log e dall'exit 0 dei relativi processi. Nessuna nuova verifica GitHub Actions è stata avviata; le configurazioni CI sono aggiornate e verificate localmente. Firefox, WebKit e lettore di schermo reale non sono stati eseguiti.

## Fuori perimetro

Nessun test della futura `0005` o delle garanzie backend D5 è dichiarato passato: l'upgrade eseguito resta M1 → M2.5, quello previsto per C2 sarà M2.5 popolato → `0005`. Le chiavi di dedupe prodotte dal dominio sono intenti, non una prova di atomicità o concorrenza del backend futuro.
