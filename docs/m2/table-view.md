# M2 — Vista Tabella

Alternativa al Kanban per **confrontare** molte opportunità. Stessi dati, stesso backend: il pannello e le modifiche sono gli stessi; cambiare qualcosa in una vista lo rende visibile nell'altra (le cache si invalidano insieme, test E2E n. 7–8).

## Dove

- `/opportunities` — tutte le bacheche (colonna «Bacheca» inclusa).
- `/boards/:id/table` — una bacheca; l'interruttore **Kanban | Tabella** è nell'intestazione della bacheca.
- Il dettaglio si apre sotto la stessa rotta (`…/cards/:cardId`) e **conserva ricerca e filtri**; chiudendo si torna alla stessa vista, con il focus sul link da cui si è partiti.

## Colonne

Registro unico in `table-state.ts` (`TABLE_COLUMNS`): Opportunità (fissa), Azienda, Bacheca, Colonna, Priorità, Località, Modalità, Contratto, Retribuzione, Fase, Esito, Etichette, Candidatura, Ultima modifica. Visibili in partenza: Opportunità, Azienda, Bacheca, Colonna, Priorità, Fase, Esito, Candidatura, Ultima modifica. I **campi personalizzati** potranno aggiungersi allo stesso registro (non in M2).
Valori assenti: «—» decorativo + «Non indicato» per gli screen reader; la retribuzione dice «lordo/netto» solo se registrato.

## Preferenze

| Preferenza                            | Dove vive                                                                                           |
| ------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Colonne visibili                      | **locale al dispositivo** (`localStorage`, `mr.table.columns.v1`; contenuto corrotto → predefiniti) |
| Ricerca, filtri, ordinamento, pagina  | **nell'indirizzo** (condivisibili; non nel server)                                                  |
| Nulla di ciò viene salvato sul server | nessuna sincronizzazione tra dispositivi in M2                                                      |

«Ripristina colonne predefinite» è nel pannello **Colonne**.

## Interazioni

- **Ordinamento**: pulsante nell'intestazione con `aria-sort`, testo per screen reader («ordinata in ordine crescente. Attiva per invertire») e `caption` che riassume l'ordine.
- **Tastiera**: tutto raggiungibile con Tab (intestazioni ordinabili, link del titolo, filtri, paginazione); l'area che scorre è focalizzabile per scorrerla con le frecce (WCAG 2.1.1). Nessuna navigazione a frecce tra celle (non necessaria: la tabella non è una griglia modificabile).
- **Nessuna modifica inline** (scelta): la correttezza e l'accessibilità di un editing tabellare non valgono il rischio; ogni modifica passa dal pannello, che valida tutto.
- **Paginazione**: Precedente / Successiva / «Pagina X di Y»; contatore dei risultati annunciato (`role="status"`).
- **Stati**: caricamento (scheletro), errore con «Riprova», vuoto assoluto, nessun risultato con «Cancella filtri», pagina inesistente.
- Nessuna libreria di tabelle aggiunta: con ordinamento e paginazione sul server TanStack Table avrebbe fornito solo la visibilità delle colonne.

## Responsive

| Larghezza                                                     | Comportamento                                                                                                                                                                  |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ≥ 1024 px                                                     | tabella completa, colonne configurabili                                                                                                                                        |
| 768–1023 px                                                   | tabella con **scorrimento orizzontale confinato** nel suo contenitore (la pagina non scorre di lato)                                                                           |
| < 768 px                                                      | **elenco compatto di schede** (titolo, azienda · sede, bacheca · colonna, priorità, fase, esito, candidatura, etichette) al posto della tabella; il pulsante «Colonne» non c'è |
| Target di tocco ≥ 44 px a telefono (stessi componenti di M1). |
