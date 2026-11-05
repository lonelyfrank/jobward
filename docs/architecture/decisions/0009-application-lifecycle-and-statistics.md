# ADR-0009 — Ciclo della candidatura: colonna ≠ fase ≠ esito, patch per campo, statistiche

**Stato:** Accettato · **Data:** 2026-11-05 · **Integra:** ADR-0004, ADR-0008

## Contesto

M1 salvava solo azienda e URL e dichiarava la categoria di una colonna «solo un'etichetta». M2 deve registrare tutti i dati professionali, permettere di impostare fase ed esito, e produrre statistiche attendibili, senza che lo spostamento di una scheda modifichi dati in silenzio.

## Decisioni

1. **Colonna, fase ed esito sono indipendenti.** Il server non scrive mai `stage`/`outcome` in `move`. La categoria della colonna genera, dopo lo spostamento concluso, un **suggerimento esplicito** (azione «Imposta fase»), non una conferma modale e non un effetto collaterale (docs/m2/application-lifecycle.md).
2. **Un solo modello di scheda, piatto.** `Card` espone tutti i campi professionali e `labelIds`; `application_details.position` si chiama `jobTitle` nell'API (evita l'omonimia con `cards.position`). `applicationDetailsInput` (già presente e inutilizzato) sostituisce `cardDetailsInput`, che resta come alias: i payload M1 restano validi.
3. **Patch per campo:** assente = invariato, `null` = azzera. Le regole su più campi (intervallo retributivo, valuta obbligatoria con un importo) si valutano sullo **stato risultante** nel servizio; il `CHECK` del database resta l'ultima difesa (→ 409).
4. **Lordo/netto:** colonna additiva `salary_basis` (`NULL` = non specificato). Migrazione `0003` scritta a mano come `ALTER TABLE … ADD COLUMN … CHECK`, perché `drizzle-kit generate` produce una ricostruzione della tabella con `PRAGMA foreign_keys`, non affidabile su D1 e distruttiva per i dati di M1. Provata su un database M1 popolato (`pnpm db:upgrade-test`, ora nel gate).
5. **Statistiche:** «inviata» = data di candidatura **o** fase che la implica; «in colloquio» = fase Colloquio **e** esito assente o «in attesa»; mai dedotte dal nome della colonna; solo schede non archiviate; una riga per scheda.
6. **Concorrenza:** nessun token di versione. Il pannello invia i soli campi modificati, quindi modifiche concorrenti a campi diversi non si sovrascrivono; la stessa modifica concorrente è «l'ultima vince». Le scritture che dipendono da altro stato (scheda archiviata, definizione di un campo cambiata) sono condizionate nel SQL → 409. Da rivalutare (`If-Match` su `updatedAt`) con workspace condivisi.

## Alternative scartate

- **Cambiare la fase al trascinamento** (anche con conferma): modifica dati come effetto collaterale, interferisce con la coda ottimistica e produce conferme ripetitive.
- **Annidare i dettagli** in `card.details`: due forme da tenere allineate tra Kanban, tabella e pannello.
- **Importi in centesimi:** complica l'inserimento per un guadagno nullo (nessuna conversione, nessun calcolo).
- **Token di versione ora:** complessità senza collaborazione tra utenti.

## Conseguenze

`GET /boards/:id` restituisce schede più larghe (campi `null` ripetuti): trascurabile dopo gzip (misura in docs/m2/testing-report.md). Il pannello è un'unica scheda di salvataggio esplicito.
