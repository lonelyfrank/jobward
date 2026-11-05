# M2.5 — Registro dei problemi

Classificazione: **P0** sicurezza critica / perdita di dati / app inutilizzabile · **P1** errori gravi su dati, API, autorizzazioni, flussi fondamentali · **P2** funzionali non bloccanti, UX, prestazioni · **P3** minori.

| ID     | Gravità | Titolo                                                                                                                                                           | Stato                                           |
| ------ | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| M25-01 | P2      | Pannelli inattivi delle schede ancora nell'albero di accessibilità (`forceMount` di Radix)                                                                       | Corretto                                        |
| M25-02 | P2      | `drizzle-kit` genera la ricostruzione di `activity_events` con `PRAGMA` e **senza ricreare i trigger di isolamento**                                             | Prevenuto (migrazione scritta a mano e provata) |
| M25-03 | P3      | Pulsante «+ Colloquio» dell'intestazione largo 38 px a telefono (< 44 px)                                                                                        | Corretto                                        |
| M25-05 | P3      | Test E2E dei dettagli passavano solo per effetto di M25-01 (schede inattive visibili); anteprima: richiesta annullata di proposito segnalata come errore di rete | Corretto (test)                                 |
| M25-04 | P3      | L'aggiornamento rapido della fase avrebbe reso «sporco» il modulo (bozza non allineata alla scheda salvata)                                                      | Corretto (prima del rilascio)                   |

Nessun P0/P1. Nessun problema aperto.

## M25-01 · Pannelli inattivi visibili agli screen reader (P2)

- **Evidenza.** Il primo E2E dei colloqui falliva con «`Aggiungi colloquio` risolto in 2 elementi»: il riepilogo della scheda _Panoramica_ (nascosta) era ancora trovato da `getByRole`. Ispezione del DOM: i quattro `tabpanel` avevano `hidden=false`, `display:block`.
- **Causa.** Radix `Tabs.Content` con `forceMount` (necessario per non perdere le bozze del modulo) **non** applica `hidden`.
- **Impatto.** Con un lettore di schermo la modale sarebbe stata letta con tutte e quattro le schede insieme, e il focus avrebbe potuto raggiungere controlli di schede non selezionate. Nessuna perdita di dati.
- **Correzione.** `TabsContent` aggiunge `data-[state=inactive]:hidden` (display:none): il pannello resta montato ma esce dalla vista e dall'albero di accessibilità.
- **Regressione.** Tutti gli E2E di `interviews.spec.ts` (usano query per ruolo che falliscono con pannelli visibili) e la verifica axe delle schede.

## M25-02 · Ricostruzione di `activity_events` senza trigger (P2, prevenuto)

- **Evidenza.** `pnpm db:generate` per i nuovi tipi di evento ha prodotto `CREATE __new_activity_events … DROP TABLE activity_events … RENAME` con `PRAGMA foreign_keys=OFF/ON`, **senza** i trigger `activity_events_tenant_insert/update`, che il `DROP` elimina.
- **Rischio.** Dopo la migrazione un evento avrebbe potuto puntare a una scheda di un altro workspace: regressione silenziosa di ADR-0007.
- **Correzione.** `0004` scritta a mano: copia con guardia sui conteggi prima del `DROP`, nessun `PRAGMA`, ricreazione dei due trigger e dei due indici.
- **Test.** `pnpm db:upgrade-test` (cronologia reale di due workspace): righe identiche, trigger presenti, evento cross-workspace **ancora rifiutato**.

## M25-03 · Area di tocco dell'intestazione (P3)

- **Evidenza.** Il controllo delle aree di tocco a 390 px (`smallTouchTargets`) segnalava «BUTTON "Colloquio" 38x44».
- **Correzione.** `min-w-11` sotto `sm`. **Regressione:** lo stesso controllo, esteso a Panoramica e Colloqui nell'E2E n. 15.

## M25-04 · Modulo «sporco» dopo l'aggiornamento rapido della fase (P3)

- **Evidenza (in progetto).** La bozza del modulo nasce dalla scheda alla sua apertura: aggiornare la fase dal riepilogo avrebbe fatto differire la bozza dal valore salvato → «Modifiche non salvate» senza che l'utente avesse scritto nulla (e la guardia di uscita avrebbe chiesto conferma).
- **Correzione.** I campi non toccati seguono il valore salvato; quelli in modifica non sono sovrascritti. **Test:** E2E n. 8 (la bozza «Azienda» resta, la fase segue, «Annulla modifiche» ripristina).

## M25-05 · Test che dipendevano da un difetto (P3, solo test)

- **Evidenza.** Dopo M25-01 il gate completo ha mostrato 1 E2E rosso (`details` n. 4: «Minima» non visibile) più 5 non eseguiti (serial); in locale, prima della correzione, passavano 8/9 perché i campi di «Dettagli» erano visibili anche con un'altra scheda selezionata.
- **Correzione.** I test aprono la scheda «Dettagli»/«Panoramica» prima di toccare i suoi campi (quello a 390 px ora controlla axe e aree di tocco su **entrambe** le schede).
- **Anteprima (locator).** Con la modale a schede il pulsante «Salva» compare due volte (intestazione e piè di pagina, il secondo `type=submit form="card-form"`) e «Fase»/etichette stanno in Panoramica: i test M1 e M2 della preview usano `exact: true` + `.last()` e aprono la scheda giusta.
- **Anteprima.** `requestfailed` segnalava `ERR_ABORTED` di `/api/v1/opportunities`: è l'annullamento intenzionale (`AbortSignal`) di una ricerca superata, introdotto in M2. Il controllo ignora **solo** `ERR_ABORTED`; ogni altro `requestfailed`, errore di console, `pageerror` o violazione CSP resta un fallimento.

## Note di processo (non difetti del prodotto)

- Un `pkill -f` con il pattern nella stessa riga di comando ha terminato la mia stessa shell: i server di sviluppo sono stati fermati per PID.
- `getByText`/`getByLabel` di Playwright cercano per sottostringa anche negli elementi nascosti: 3 collisioni nei test («Colloquio programmato.» in «Nessun colloquio programmato.»; etichette contenenti «fase») risolte con `exact` e con un'etichetta accessibile più specifica per l'aggiornamento rapido.
