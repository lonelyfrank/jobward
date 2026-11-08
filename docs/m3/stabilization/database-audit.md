# M3 — database e migrazioni

Perimetro: `0000_init.sql`–`0007_board_background_images.sql`, D1 locale temporaneo. Nessuna migrazione storica modificata, nessuna nuova migrazione, nessun accesso a database remoto o dati personali.

| Migrazione | Responsabilità                      | Verifica                                                                                                                                                                                       |
| ---------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0000       | Schema iniziale                     | Installazione da zero nei test API e negli stack Playwright.                                                                                                                                   |
| 0001       | Integrità tenant e chiavi composite | Suite tenant-integrity e fixture upgrade con due workspace.                                                                                                                                    |
| 0002       | Trigger activity_events             | Trigger insert/update preservati dopo upgrade e ricostruzioni successive.                                                                                                                      |
| 0003       | salary_basis e indici M2            | 601 schede legacy, 60 archiviate, dettagli ed eventi preservati; nuovi vincoli attivi.                                                                                                         |
| 0004       | Colloqui                            | Vincoli sequenza, stato/date e isolamento; cascata soltanto nelle fixture temporanee.                                                                                                          |
| 0005       | Note/documenti/deduplica            | Snapshot di tutte le colonne preesistenti, inventario FK/indici/trigger, rollback durante/dopo copia e API reale su database aggiornato.                                                       |
| 0006       | Tasks additiva                      | Nessun rebuild tasks; conservazione righe legacy e due_at, date valide/null-safe, vincoli, indici, isolamento, rollback su riga incompatibile.                                                 |
| 0007       | boards.background_image nullable    | Upgrade include 0007; regressione aggiunta per tutte le colonne storiche delle board, default NULL, persistenza dello sfondo al secondo passaggio del runner e isolamento fra board/workspace. |

## Evidenze e interpretazione

`pnpm db:upgrade-test` esegue tre script indipendenti. La prima esecuzione ha concluso positivamente upgrade M1→0007, M2.5→0005 e 0005 popolato→0006. L'ultimo non prova da solo 0007: quella migrazione è coperta dal primo e dall'installazione vuota delle suite API/E2E. I risultati finali dopo l'estensione del test sono nel [quality gate](quality-gate.md).

`db:check` genera su una copia temporanea dei metadati Drizzle e rifiuta drift; non applica schema. `foreign_key_check` riguarda soltanto le fixture locali. D1 rifiuta `PRAGMA integrity_check` con SQLITE_AUTH anche in locale: il tentativo aggiuntivo è stato registrato e lo script usa il controllo FK supportato, insieme ai confronti di dati/schema e ai test dei vincoli. Non si dichiara superato integrity_check. Il runner di migrazioni deve essere riapplicabile senza ripetere gli ALTER storici: è il registro delle migrazioni a garantirlo, non l'idempotenza dell'SQL grezzo.

L'errore storico `.some` di `test-migration-m3c2.mjs` mascherava un'incompatibilità fra API corrente e schema della fixture: la prova live si fermava a 0005, ma la timeline M3 Tasks legge i campi introdotti da 0006. Il diff d4e7ae8 mostra la correzione già presente nella baseline: le prove SQL continuano a isolare 0005; soltanto la copia usata dall'API riceve anche le migrazioni successive. Inoltre la risposta viene verificata come HTTP 200 con entries Array, riportando HTTP e corpo in caso di errore. Non era cambiato il contratto entries e nessuna migrazione è stata alterata per aggirare il test.

## Limiti

Il database reale può contenere righe legacy diverse dalle fixture. Nessuna attestazione di upgrade remoto viene fatta. Prima di M4-C4: backup e inventario read-only autorizzati, prova su copia isolata, poi applicazione remota soltanto con autorizzazione esplicita. Il rollback delle migrazioni ricostruttive è verificato nei casi simulati, non rappresenta un ripristino di produzione già eseguito.
