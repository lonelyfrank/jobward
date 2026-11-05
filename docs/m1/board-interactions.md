# M1 — Interazioni della bacheca

Cosa fa l'interfaccia, come si comporta e quali garanzie dà. Principio: **ogni azione si può fare senza trascinare**;
il trascinamento è una scorciatoia, non l'unico percorso.

## Galleria (`/boards`)

| Azione      | Come                                                                                                                                          | Persistenza / garanzie                                                        |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Creare      | "Nuova bacheca": nome (obbligatorio), descrizione, colore, **template**                                                                       | Bacheca + colonne in un'unica operazione atomica; si apre la bacheca creata   |
| Template    | Job Search Standard (6 colonne con fase) · Minimal (3) · Personalizzata (0). **Letti da `@meet-roulette/shared`**, non scritti nei componenti | Un test confronta le colonne create con quelle del template                   |
| Modificare  | Menu "⋯" → Modifica…: nome, descrizione, colore                                                                                               | `PATCH`                                                                       |
| Preferita   | Stella (pulsante a due stati con `aria-pressed`)                                                                                              | Le preferite compaiono per prime, in una sezione "Preferite"                  |
| Ordinare    | Menu → Sposta su / Sposta giù (all'interno del gruppo preferite / altre)                                                                      | Aggiornamento ottimistico con rollback e avviso                               |
| Eliminare   | Menu → Elimina… → **dialogo di conferma** (focus su "Annulla")                                                                                | Dice cosa si perde (colonne, schede anche archiviate) e che non è annullabile |
| Stato vuoto | Invito a creare la prima bacheca + template disponibili                                                                                       | Nessun dato fittizio                                                          |

## Bacheca (`/boards/:id`)

- **Intestazione**: nome, descrizione, preferita, "Archiviate (n)", menu bacheca (modifica, elimina con conferma).
- **Colonne**: una per fase, scorrimento orizzontale (a telefono ~85 % della larghezza, con aggancio), conteggio delle schede attive,
  colore (token), fase semantica come etichetta. Menu colonna: Modifica… (nome, colore, fase) · Sposta a sinistra/destra · Elimina….
- **Eliminazione colonna**: vuota → conferma semplice. Con schede → il dialogo spiega "Non verrà eliminata nessuna scheda" e chiede
  **dove spostarle** (anche le archiviate). Senza altre colonne → "Crea prima un'altra colonna". Mai eliminazione silenziosa.
- **Creazione rapida**: "Aggiungi scheda" in fondo a ogni colonna → solo il titolo. **Invio** aggiunge e lascia il campo pronto per la
  successiva; **Esc** chiude e riporta il focus sul pulsante. Titolo vuoto → errore annunciato, nessuna richiesta. Anche dal pulsante
  "Nuova scheda" della barra superiore (bacheca + colonna + titolo).
- **Scheda**: titolo (link al dettaglio), azienda, badge di priorità (testo, non solo colore), badge "Annuncio" se c'è l'URL.
- **Archiviate**: elenco con "Ripristina"; l'archiviazione offre "Annulla" nell'avviso. Nulla viene eliminato definitivamente.

## Spostare le schede

| Modo                      | Come                                                                                                                                      |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Mouse**                 | Si trascina da qualunque punto della scheda (dopo 6 px di movimento: un clic semplice apre il dettaglio)                                  |
| **Touch**                 | **Pressione prolungata** (~220 ms) poi trascinamento; lo scorrimento della bacheca resta libero; un tocco breve apre il dettaglio         |
| **Tastiera**              | Maniglia ⠿ sulla scheda (pulsante): **Spazio/Invio** per prendere, **frecce** per scegliere, Spazio/Invio per rilasciare, **Esc** annulla |
| **Menu**                  | "⋯" → Sposta su · Sposta giù · **Sposta in «colonna»** (in fondo alla colonna scelta)                                                     |
| **Pannello di dettaglio** | Selettore "Colonna" (in fondo alla colonna scelta)                                                                                        |

Le **colonne** si riordinano con la maniglia ⠿ dell'intestazione (mouse, touch, tastiera) o dal menu (a sinistra/destra).
Rilasciare **sotto l'ultima scheda** di una colonna significa "in fondo". Rilasciare fuori da ogni bersaglio equivale ad annullare.

### Aggiornamento ottimistico e rollback

1. Al rilascio, la nuova posizione è applicata subito allo stato locale (con la stessa funzione del server).
2. La richiesta parte in **coda seriale** per bacheca (le mosse arrivano al server nell'ordine in cui sono state fatte).
3. **Errore** → si ripristina lo stato precedente e compare un avviso persistente: "…La scheda è tornata nella posizione originale."
   Un 409 mostra il messaggio del server ("La scheda è stata spostata o archiviata nel frattempo…").
4. A coda vuota si **riallinea** al server (le mutazioni successive non vengono sovrascritte da riletture intermedie).

Il caricamento è visibile con scheletri; il salvataggio non blocca l'interfaccia.

## Pannello di dettaglio (`/boards/:id/cards/:cardId`)

- Sotto-rotta della bacheca: **indirizzo condivisibile**, "indietro" chiude il pannello, la bacheca resta visibile e viva dietro (≥ md).
- **Desktop**: pannello laterale (30 rem). **Telefono**: a schermo intero.
- Modifica: titolo, colonna, priorità, azienda, indirizzo dell'annuncio (http/https), note. "Salva" è attivo solo se c'è una modifica; si inviano
  **solo i campi cambiati**; "Annulla modifiche" ripristina. Errori di campo annunciati, messaggio del server in caso di rifiuto.
- **Cronologia** (ultimi 50 eventi): creazione, spostamenti ("Spostata da “Salvate” a “Inviate”"), cambi di priorità, archiviazione/ripristino; date nel fuso del workspace.
- **Archivia** (con "Annulla") / **Ripristina**. Una scheda archiviata si apre in sola lettura con il pulsante Ripristina.
- **Focus**: all'apertura va nel pannello (Radix); alla chiusura (Esc, Chiudi, indietro) torna **alla scheda** nella bacheca.

## Semantica delle candidature (cosa M1 NON fa)

Sono quattro concetti distinti: **colonna** (posizione scelta dall'utente), **fase** (`stage`), **esito** (`outcome`), **priorità**.

- La **categoria** di una colonna è un'**etichetta informativa** (si vede nell'intestazione). Spostare una scheda in una colonna con categoria
  **non** modifica `stage`, **non** modifica `outcome`, **non** emette `stage_changed`. L'unico effetto è `card_moved` nella cronologia.
- `application_details` in M1 contiene solo **azienda** e **URL dell'annuncio**; `stage`/`outcome` restano `NULL`. Per questo i contatori
  "Candidature inviate" e "Colloqui" dell'Overview non possono ancora muoversi: dichiarano "dalla prossima milestone (M2)".
- Un campo di M2 inviato a `POST /cards` (`salaryMin`, `stage`, …) è rifiutato con `400`: non viene ignorato in silenzio.
- Proposta per M2 (da decidere, non implementata): suggerire — mai applicare — il cambio di fase quando una scheda entra in una colonna con
  categoria, con conferma esplicita e `stage_changed` registrato.
