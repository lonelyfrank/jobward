# M2 — Architettura e piano

> Documento scritto **prima** dell'implementazione e aggiornato a fine milestone: ciò che segue descrive
> le decisioni prese e come sono state realizzate. Lo stato reale di ogni funzione è in [delivery.md](delivery.md).

## 1. Punto di partenza (verificato)

| Verifica                       | Esito                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `main`                         | `35b7614` — PR #1 (M0.H), #2 (correzione E2E / H-23) e #3 (M1) **integrate**                                                                     |
| CI di `main`                   | 🔴 **rossa** sul merge di #3: l'E2E ha un'unica violazione axe `color-contrast` su `/opportunities (light)` e un primo test "flaky" (vedi M2-00) |
| Branch di sviluppo             | `m2-information-customization`, creato da `origin/main`                                                                                          |
| Baseline pulita (`pnpm check`) | ✅ typecheck, lint, format, contrasto, config, `db:check`, 287 test, build                                                                       |
| Bundle iniziale                | JS principale 452,19 kB (gzip 138,49) · `vendor-react` 312,86 kB (gzip 98,42) · CSS 35,33 kB (gzip 7,75)                                         |

Come prescritto, il difetto della CI è stato diagnosticato e corretto **prima** di introdurre funzioni nuove.

## 2. Principio: niente di nuovo dove non serve

Lo schema di M0 prevedeva già `application_details`, `custom_field_definitions`, `custom_field_values`, `labels`, `card_labels`
con chiavi composite per il tenant e trigger. M2 li **usa**. Unica migrazione (`0003`), additiva:

| Modifica                                                                      | Motivo                                                                                                         |
| ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `application_details.salary_basis` (`gross` \| `net`, NULL = non specificato) | Lordo/netto non era registrabile: l'interfaccia non può dichiarare un importo né lordo né netto senza saperlo  |
| indice univoco `custom_field_definitions(board_id, lower(name))`              | Due campi con lo stesso nome nella stessa bacheca sono ambigui; la tabella è vuota (nessun endpoint la scrive) |
| indice `cards(workspace_id, updated_at)`                                      | Ordinamento predefinito della ricerca ("ultima modifica")                                                      |

Nessuna tabella ricostruita, nessun dato toccato. Test di migrazione su database M1 popolato (vedi `testing-report.md`).

## 3. Decisioni

### D-1 · Un solo modello di scheda, piatto

`Card` espone **tutti** i dati professionali come campi piatti (nessun annidamento) più `labelIds`. L'attributo `application_details.position`
(titolo della posizione) si chiama **`jobTitle`** nell'API, per non confonderlo con `cards.position` (ordine nella colonna).
`applicationDetailsInput` esisteva ma non era usato: è stato aggiornato (nome del campo, `salaryBasis`, `strict`) e **sostituisce** `cardDetailsInput`
(che ora è un alias dello stesso schema: i payload M1 `{company, sourceUrl}` restano validi).
Il Kanban riceve la scheda completa (stesso tipo): niente seconda forma da tenere allineata. Il costo (campi `null` ripetuti) è misurato in `testing-report.md`.

### D-2 · Patch: assente ≠ `null`

`PATCH /cards/:id` accetta solo i campi da cambiare. **Assente** = invariato; **`null`** = azzera (dove il campo è facoltativo). Le regole che coinvolgono più campi
(intervallo retributivo, valuta obbligatoria se c'è un importo) sono verificate dal servizio sullo stato **risultante** (valori nel database + patch), non sul solo payload.
Il database mantiene il `CHECK` sull'intervallo come ultima difesa.

### D-3 · Colonna, fase ed esito sono tre cose diverse

- Trascinare una scheda **non modifica mai** fase né esito (il server non lo fa, nemmeno se la colonna ha una categoria).
- La categoria della colonna diventa un **suggerimento esplicito e indipendente**: dopo uno spostamento _tra colonne_ completato, se la colonna di arrivo ha una categoria diversa dalla
  fase della scheda, compare una notifica con l'azione «Imposta fase …». Nessuna conferma modale, nessun suggerimento se la categoria coincide già o la colonna non ne ha una. È una
  semplice `PATCH { stage }` successiva: non interferisce con la coda ottimistica degli spostamenti.
- Fase ed esito si cambiano a mano nel pannello (e, in sola lettura, compaiono nel Kanban e nella tabella).
- Eventi in cronologia: `stage_changed`, `application_submitted` (la prima volta che si registra la data di candidatura), `application_closed` (esito diverso da "in attesa").

### D-4 · Definizioni delle statistiche (Overview)

Solo schede **non archiviate**, ciascuna contata una volta (una sola riga per scheda, nessun join moltiplicante).

| Contatore           | Definizione                                                                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidature inviate | `data candidatura` registrata **oppure** fase ∈ {Inviata, In contatto, Colloquio, Offerta}. "Conclusa" da sola non basta: si può chiudere una scheda senza aver mai inviato nulla |
| In colloquio        | fase = Colloquio **e** esito assente o "in attesa" (un colloquio con esito "rifiutata" è concluso)                                                                                |
| Mancanti            | nessuna data e nessuna fase ⇒ la scheda non è contata come inviata. Nessuna deduzione dal nome della colonna                                                                      |

### D-5 · Campi personalizzati: conservativi

- Il **tipo non cambia** dopo la creazione (la PATCH non lo accetta): evita conversioni con perdita di dati.
- Ogni modifica di configurazione (opzioni rimosse, `min`/`max`, lunghezza) viene accettata **solo se tutti i valori già salvati restano validi**: altrimenti 409 con il numero di schede coinvolte.
  È un controllo generico (rivalida i valori con `valueSchemaFor`), non una regola per tipo.
- **Disattivare** nasconde il campo e i valori restano; **riattivare** li ripresenta. Un campo inattivo rifiuta nuove scritture.
- L'eliminazione definitiva è un'azione separata: senza valori è diretta, con valori richiede `deleteValues: true` (l'interfaccia mostra il numero di schede e chiede conferma esplicita).
- Le opzioni hanno ID stabile (generato dal server alla creazione, mai dall'etichetta): rinominare non rompe i valori.
- Valori `null` (campo svuotato) sono **persistiti** come JSON `null`; l'assenza di riga significa "mai compilato".

### D-6 · Etichette

Colori solo dalla palette di token (`colorToken`). Creazione rapida dal selettore della scheda; gestione completa (rinomina, colore, eliminazione) in Impostazioni.
Eliminare un'etichetta rimuove solo l'assegnazione dalle schede (mai le schede): se è in uso serve `force: true` e l'interfaccia mostra quante schede coinvolge.

### D-7 · Ricerca e filtri

- **Server-side**, una sola rotta `GET /opportunities` per la schermata Opportunità e per la vista Tabella di una bacheca (stesso contratto, `boardId` in più).
- Ambito **sempre visibile**: «Tutte le bacheche» oppure «Bacheca: X» come filtro rimovibile.
- Ricerca testuale: ogni parola deve comparire (AND) in almeno uno tra titolo, azienda, posizione, descrizione, sede, fonte (`LIKE … ESCAPE`, caratteri speciali neutralizzati, parametri legati).
  **Limite noto:** `LIKE` di SQLite ignora le maiuscole solo per ASCII (`è`/`È` sono diverse).
- **FTS5 non introdotto**: richiederebbe tabella virtuale, trigger di sincronizzazione e una migrazione di ricostruzione; per workspace con ≤ 100 bacheche × 2.000 schede la scansione filtrata per
  `workspace_id` è accettabile (misura in `search-and-filtering.md`). Si riconsidera se la misura lo giustifica.
- Semantica: **AND tra gruppi, OR tra i valori dello stesso gruppo** (etichette comprese: "una qualsiasi delle selezionate").
- Ordinamento: insieme **chiuso** di chiavi mappate su espressioni SQL costanti; NULL sempre in fondo; spareggio per `id`. Priorità, fase ed esito si ordinano per rango semantico, non alfabetico.
- Paginazione a offset con totale (dimensione pagina 25, massimo 50). Cursor non necessario a questa scala; l'ordinamento deterministico evita duplicati tra pagine in assenza di scritture.
- Nessun filtro sui campi personalizzati in M2 (l'architettura lo consente: vedi `search-and-filtering.md` §limiti).

### D-8 · Tabella

Componente `<table>` semantico con ordinamento/paginazione **sul server** (la libreria TanStack Table non è stata aggiunta: con ordinamento e paginazione remoti avrebbe fornito
solo la visibilità delle colonne, che si risolve con meno di 40 righe). Stato in URL (ricerca, filtri, ordinamento, pagina); colonne visibili in `localStorage` (preferenza locale al dispositivo).
Sotto `md` la stessa risposta è mostrata come **elenco compatto di schede**, non come tabella. Nessuna modifica inline: ogni modifica passa dal pannello (decisione di accessibilità e correttezza).

### D-9 · Concorrenza

Nessun token di versione in M2. Motivazione: il pannello invia **solo i campi modificati** (patch per campo), perciò due dispositivi che modificano campi diversi non si sovrascrivono; solo la
modifica dello _stesso_ campo è "l'ultima vince", accettabile per un uso personale. Le scritture che dipendono da altro stato (campo personalizzato disattivato nel frattempo, opzione rimossa,
scheda archiviata) sono condizionate nel SQL o rivalidate dal server e danno 409. Se arriveranno collaboratori (workspace condivisi) si introdurrà `If-Match` su `updatedAt`.

### D-10 · Prestazioni

Kanban, Tabella/Opportunità, gestione etichette e configuratore dei campi sono caricati a richiesta (`lazy` di React Router / `React.lazy`). La homepage non carica nessuno dei moduli M2 (iniziale: 713 kB / 220 kB gzip contro 766 / 237 della baseline). Confronto completo in `testing-report.md`. Effetto collaterale corretto: la configurazione `jitless` di Zod vive ora nel package degli schemi (M2-08).

## 4. Piano e checkpoint (tutti completati: esito in [delivery.md](delivery.md))

| Checkpoint | Contenuto                                                                               | Gate                                                       |
| ---------- | --------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| M2-00      | Correzione CI di `main` (test) + questa documentazione                                  | `pnpm check`                                               |
| M2.1       | Contratti, migrazione 0003, servizi/API, pannello 2.0 (dettagli, fase, esito), Overview | unit + integrazione + E2E dettagli, nessuna regressione M1 |
| M2.2       | Campi personalizzati (definizioni, configuratore, valori), etichette                    | validazione tipi, integrità, isolamento (matrice), E2E     |
| M2.3       | `GET /opportunities`, filtri, tabella, preferenze, responsive                           | ricerca/filtri corretti, navigazione, prestazioni, E2E     |
| M2.4       | Coerenza Kanban/Tabella, accessibilità, bundle, documentazione, gate completo           | `pnpm check` + E2E + anteprima di produzione               |
