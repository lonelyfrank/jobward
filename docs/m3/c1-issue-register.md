# M3-C1 — Registro problemi e limitazioni

**Data:** 2026-11-05 · Nessun P0/P1 noto emerso nelle verifiche completate, inclusi 118 E2E e 11 test di anteprima.

| ID    | Priorità | Stato                       | Problema / decisione                                                                                                                                                                                                                               |
| ----- | -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1-01 | P2       | Gestito                     | `stage=closed` con esito `pending/null`: il dominio non attribuisce una conclusione; fallback `saved`, diagnostica e correzione esplicita. Dati persistenti invariati                                                                              |
| C1-02 | P2       | Rinviato all'infrastruttura | Etichette D1 e identità dev popolata conservano il nome storico. Rinominare soltanto i nomi configurati non migra le risorse o l'utente. Procedura locale in ADR-0014, non applicata ai dati reali                                                 |
| C1-03 | P3       | Da monitorare               | Primo E2E ricerca/Indietro fallito, non riprodotto nel giro ricerca isolato 16/16. Possibile interferenza da HMR durante modifiche, causa non conclusiva. Giro completo finale **118/118**; resta il monitoraggio della flakiness                  |
| C1-04 | P3       | Aperto                      | `jobward-white.png` pesa circa 1,06 MB; favicon SVG incorpora il ritaglio dei soli pixel blu del marchio (circa 17 kB). Scelta conservativa per usare i pixel forniti senza inventare asset; eventuale ottimizzazione/riduzione grafica è separata |
| C1-05 | P3       | Compatibilità intenzionale  | Vecchie chiavi browser leggibili per conservare le preferenze; nuova scrittura su `jobward-*`. Le chiavi precedenti non vengono eliminate                                                                                                          |
| C1-06 | P3       | Limite ereditato            | Verifiche browser solo Chromium, nessun lettore di schermo reale o nuova esecuzione CI remota. Messaggio React Router `HydrateFallback` preesistente nei log dev, senza errore console applicativo rilevato dall'anteprima                         |
| C1-07 | P3       | Risolto                     | Quattro import rinominati richiedevano wrapping Prettier; correzione di sola formattazione                                                                                                                                                         |
| C1-08 | P3       | Risolto                     | URL legacy rimasto in una fixture di autenticazione, rilevato dal nuovo guard branding e sostituito; scenario fail-closed preservato                                                                                                               |
| C1-09 | P3       | Risolto                     | Prime catture brand durante animazione: attesa esplicita delle animazioni finite prima dello screenshot                                                                                                                                            |
| C1-10 | P3       | Risolto                     | Viola saturo del simbolo su sidebar scura: misura circa 2,48:1. Aggiunta targa chiara al simbolo compatto, conservando i pixel originali; test marchio e anteprima ricontrollati                                                                   |

## Problemi M3 ereditati

| ID                                                                    | Stato dopo C1                                                                                                                                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M3-01 — Riapertura senza traccia nel backend corrente                 | **Aperto fino a C2.** Il dominio prepara `application_reopened`, ma SQL, API e CHECK persistente non sono stati modificati                                                         |
| M3-02 — Retry di creazione colloquio duplicabile nel backend corrente | **Aperto fino a C2.** ID operazione e dedupe sono intenti puri; mancano ancora validazione/persistenza del fingerprint, gestione concorrente e scrittura atomica                   |
| M3-03 — Regole colloqui mescolate al SQL                              | **Parzialmente ridotto:** riepilogo puro riusabile in shared e coerenza separata; le transizioni organizzative dei colloqui nei servizi esistenti restano fuori da questo refactor |
| M3-04 — Marchio ereditato                                             | **Risolto in C1:** PNG forniti integrati e favicon originale; rendering verificato con test e catture, originali integri                                                           |
| M3-05 — Wrangler preesistente                                         | Nessun processo preesistente terminato. Suite su porte 5199/8799 e 8797, inspector dedicati 9241/9242 configurabili via ambiente                                                   |

## Rischi e prerequisiti C2

- Nuovi nomi Worker nel repository non implicano risorse remote già rinominate. Un deploy futuro richiede un piano esplicito su Access, domini, segreti e traffico. D1 resta legato a ID e binding esistenti; nessun database vuoto sostitutivo.
- `0005` richiede conservazione riga per riga e verifica completa di chiavi esterne, indici, vincoli e trigger su database M2.5 popolato. Le migrazioni storiche sono intatte.
- La collocazione del fingerprint originale delle creazioni va decisa prima di finalizzare lo schema C2. Deve consentire replay dopo modifica della risorsa e impedire ricreazioni tardive dopo eliminazione, senza copiare testi privati nella cronologia.
- L'adattatore C2 deve verificare payload, workspace, stato atteso e concorrenza nella stessa operazione transazionale degli eventi. Una decisione pura del motore non sostituisce il controllo SQL atomico.
- Gli eventi timeline con identità uguale e payload diverso vengono rifiutati dal dominio; il futuro adattatore deve gestire esplicitamente questa condizione. Il cursore deve rispettare il tie-break `source` oltre a data e ID.

Nessuna di queste attività infrastrutturali o funzionali successive è stata avviata in C1.
