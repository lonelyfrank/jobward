# Attività e follow-up — Specifica UX (mobile-first)

**Stato:** proposta, **nessuna modifica alla UI** · **Baseline:** `5a0d056eda`.
Indice: [tasks-index.md](tasks-index.md) · Funzione: [tasks-product-spec.md](tasks-product-spec.md).

## 1. Principi

- **Un'unica interfaccia che si adatta**, non tre: lo stesso albero di componenti (pagina → riepilogo → filtri → elenco → riga → dialog) con layout CSS responsive. Nessuna tabella desktop ridotta artificialmente.
- **Design system esistente**: palette Jobward/indaco (ADR-0015), temi chiaro e scuro, tipografia e spaziature attuali, `Dialog` (varianti `center` e `workspace`), `Button`, `Badge`, `Field`, `EmptyState`, `WorkspacePageHeader`, icone `lucide-react`.
- **Nessuna estensione del Glass Subtle** (restyle riservato al Kanban, M3-UI2).
- **Mai solo colore**: ogni stato temporale ha testo + icona.
- **Target di tocco ≥ 44 px** sotto `md`, come nel resto dell'app.

## 2. Anatomia della pagina `/tasks`

```
┌ Header ─────────────────────────────────────────────────────────┐
│ Attività                                   [+ Nuova attività]   │
│ Riepilogo:  Da fare 12 · Oggi 3 · In ritardo 2                  │
│ Filtri:     Tutte | Da fare | Completate | In ritardo |         │
│             Senza scadenza | Annullate                          │
├ Creazione rapida ───────────────────────────────────────────────┤
│ [ Aggiungi un'attività…                                  ⏎ ]    │
├ Elenco (ordinato) ──────────────────────────────────────────────┤
│ ○  Richiama HR — ACME · Infermiere        ⚠ Scaduta da 2 giorni │
│ ○  Aggiorna il CV                          ● Oggi        Alta   │
│ ○  Follow-up: Beta                         Domani               │
│ ○  Preparare portfolio                     12 nov               │
│ ○  Studiare il settore                     Senza scadenza       │
│ [ Carica altre ]                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 2.1 Riepilogo

Tre indicatori reali dal riepilogo API (`counts.open`, `counts.today`, `counts.overdue`); a zero mostrano «0» (mai nascosti, mai inventati). Sono **pulsanti-filtro** (portano alla vista corrispondente), con nome accessibile completo («In ritardo: 2»). Il numero delle completate non è un indicatore: è nel filtro.

### 2.2 Filtri

Gruppo di scelte **mutuamente esclusive** (`role="radiogroup"` o pulsanti `aria-pressed`, come «Densità delle schede»); a 320 px la riga **scorre dentro se stessa** (la pagina non scorre in orizzontale). Il filtro attivo è nell'URL (`?vista=da-fare`), così refresh e indietro/avanti funzionano.
L'elenco annuncia il risultato con `role="status"` («12 attività»), come la ricerca delle Opportunità.

### 2.3 Creazione rapida

Un campo, solo titolo, invio per salvare: usa **la stessa mutazione** del modulo completo (stessa validazione, stesso ID stabile, stessa gestione degli errori); non esiste una seconda logica. Dopo il salvataggio il campo si svuota e riceve di nuovo il focus; la riga nuova è annunciata. Per scadenza, candidatura e dettagli: «Nuova attività».

### 2.4 Riga di attività

| Elemento              | Specifica                                                                                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Azione principale     | Pulsante **«Segna come completata: {titolo}»** (cerchio 44 px a telefono, 32 px da `md`), `aria-pressed` per le completate; **non è un checkbox nascosto** |
| Titolo                | Apre il modulo di modifica (è un pulsante con testo, non solo la riga cliccabile); le completate con testo barrato **e** etichetta «Completata il 5 nov»   |
| Scadenza              | Testo + icona: «Scaduta da 2 giorni» (icona avviso, tono di avviso), «Oggi», «Domani», «Tra 3 giorni», «12 nov», «Senza scadenza»; mai solo rosso          |
| Candidatura collegata | Chip con azienda · ruolo, **link** alla card (`/boards/:boardId/cards/:cardId`); per card archiviata chip con «Archiviata» e riga in sola lettura          |
| Tipo                  | «Follow-up» / «Preparazione» come `Badge` testuale; `general` non mostra nulla                                                                             |
| Priorità              | `Badge` solo se diversa da `none`                                                                                                                          |
| Menu «Altre azioni»   | Modifica · Riapri (completate/annullate) · Annulla. Trigger 44 px, `aria-label` con il titolo                                                              |

**Layout della riga:** a telefono due righe (titolo + azioni sopra; scadenza, chip, badge sotto, con a capo); da `md` una riga a griglia (`azione | titolo+descrizione | candidatura | scadenza | priorità | menu`) con colonne a larghezza stabile. Stessi dati, stessi componenti, solo CSS.

### 2.5 Ordinamento e raggruppamento visivo

Ordine fornito dal server (v. contratti §3.1). In «Tutte» e «Da fare» compaiono **intestazioni di sezione leggere** derivate dalla classificazione (`In ritardo`, `Oggi`, `Prossime`, `Senza scadenza`), con `<h2>` visibili: orientano e permettono la navigazione per intestazioni con screen reader. Le sezioni vuote non si mostrano.

### 2.6 Stati della pagina

| Stato               | Presentazione                                                                                           |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| Caricamento         | scheletri della riga (`Skeleton`), `aria-busy`; nessun contatore finto                                  |
| Vuoto assoluto      | `EmptyState` «Nessuna attività, per ora» + «Nuova attività»                                             |
| Vuoto contestuale   | testi del [prodotto §9](tasks-product-spec.md): nessuna in ritardo, nessun risultato con i filtri, ecc. |
| Errore di rete      | messaggio non tecnico + «Riprova»; i dati già caricati restano visibili                                 |
| Errore di scrittura | `notify('error', …)` e riga invariata; 409 «Modificata altrove» con «Aggiorna»                          |
| Fine elenco         | pulsante «Carica altre» finché `nextCursor`; annuncia il numero totale caricato                         |

## 3. Responsive (matrice di verifica)

| Larghezza | Layout                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 320 px    | colonna unica; riepilogo in 3 celle compatte (numero sopra, etichetta sotto); filtri scorrevoli; riga a due livelli; dialog che scorre internamente (o a schermo intero, v. §4); niente overflow orizzontale della pagina |
| 390 px    | come 320, con più respiro; verifica del drawer di navigazione                                                                                                                                                             |
| 768 px    | riepilogo come tre schede affiancate; riga ancora a due livelli ma con chip e scadenza sulla stessa linea                                                                                                                 |
| 1024 px   | riga a griglia a una linea; filtri senza scorrimento; larghezza contenuto limitata (leggibilità), nessun pannello laterale                                                                                                |
| 1366 px   | come 1024, più densità (descrizione anteposta in grigio a una riga)                                                                                                                                                       |
| 1920 px   | contenuto centrato con larghezza massima (come le altre pagine): l'elenco **non** si allarga a tutto schermo                                                                                                              |

**Pannello di dettaglio laterale**: valutato e **non adottato** in T2. La modifica avviene nel `Dialog` (già coerente col resto dell'app). Un master-detail da `xl` richiederebbe un secondo percorso di navigazione e di focus; si riconsidera solo se l'uso reale lo giustifica.

## 4. Modulo di creazione e modifica

`Dialog` centrale (variante `center`) su desktop; a telefono deve scorrere internamente e restare utilizzabile a 320 px: se la variante `center` non lo garantisce, si usa la variante `workspace` (schermo intero a telefono, già usata dalla modale della candidatura). **Scelta da verificare in T2 con la matrice responsive**, non assunta qui. Un solo componente per creare e modificare.

| Campo          | Controllo                                                                                      | Regole                                                                                                |
| -------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Titolo *       | `Input`, `aria-required`, max 200                                                              | errore in linea «Inserisci il titolo» al salvataggio/blur                                             |
| Scadenza       | `<input type="date">` nativo + pulsanti rapidi «Oggi» «Domani» «Fra una settimana» + «Rimuovi» | nessuna ora; valore `YYYY-MM-DD`                                                                      |
| Candidatura    | combobox di ricerca (da `GET /opportunities?q=`), «Nessuna» valida                             | ricerca nel workspace; le archiviate non selezionabili; collegamento mostrato come chip con «Rimuovi» |
| Descrizione    | `Textarea`, max 2.000, contatore                                                               | facoltativa                                                                                           |
| Tipo, Priorità | in una sezione **«Altre opzioni»** (disclosure), segmented / select                            | default `general` / `none`; compare aperta se il valore non è il predefinito                          |

**Comportamento**

- **Salvataggio esplicito** («Crea attività» / «Salva modifiche»); `Invio` nel titolo salva; nessun salvataggio automatico.
- **Creazione:** `useCreationOperation` (ID all'apertura, payload immutabile alla prima richiesta, blocco dei campi dopo risposta incerta, retry con lo stesso ID, nessun retry automatico).
- **Modifica:** invia `expectedUpdatedAt`; su 409 mostra «L'attività è stata modificata altrove» con «Aggiorna» (ricarica e conserva il testo digitato se possibile).
- **Protezione delle modifiche non salvate:** `ConfirmDialog` («Hai modifiche non salvate») su Esc, chiusura, back, refresh (`beforeunload`) — stesso meccanismo di note e documenti.
- **Errori API:** 400 → messaggi per campo da `issues`; 404 → «La candidatura non esiste più»; 409 → messaggio del server; rete → blocco e retry.
- **Focus:** all'apertura sul Titolo; alla chiusura torna al controllo che l'ha aperto (pulsante, riga o menu); dopo la creazione dal pulsante, sulla nuova riga; focus trap del `Dialog` Radix.
- **Tastiera:** `Tab` ordinato; `Esc` chiude (con conferma se sporco); combobox con frecce/Invio/Esc; scorciatoie rapide per la data raggiungibili da tastiera.

## 5. Integrazione con la candidatura (T3)

- **Panoramica:** sezione «Attività» con le **aperte** (massimo 3 più imminenti + «Vedi tutte (N)»), «Aggiungi attività» (card precompilata), completamento diretto. Accanto a «Prossimo colloquio» il riquadro **non** sostituisce la «Prossima azione» dei colloqui.
- **Suggerimento contestuale:** una riga discreta sotto «Prossima azione» («Vuoi pianificare un follow-up? **Pianifica** · Non ora»). Mai modale, mai sul Kanban. Il pulsante apre il modulo **precompilato** (non crea nulla).
- **Timeline:** voci «Attività creata/completata/annullata» con icona e testo; link alla task.
- **Card archiviata:** la sezione è in sola lettura con avviso, come note e colloqui.
- **Chiusura della candidatura:** la conferma mostra «Hai N attività aperte collegate» con link; nessuna azione automatica.
- **Overview:** «Attività aperte» e «Prossime scadenze» diventano link alla pagina; le scadenze mostrano la data di calendario.

## 6. Accessibilità (criteri verificabili)

| Area                     | Criterio                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Struttura                | un solo `h1` «Attività»; sezioni con `h2`; elenco come `<ul>` con nome accessibile                                                                            |
| Nomi accessibili         | ogni pulsante di riga include il titolo («Segna come completata: Richiama HR», «Altre azioni per: Richiama HR»); link alla candidatura con nome azienda/ruolo |
| Stati                    | completata = `aria-pressed="true"` + testo; scadenza = testo (non solo colore); priorità = testo                                                              |
| Annunci                  | `role="status"` per conteggi e per esiti («Attività completata», «Attività riaperta»), senza spostare il focus                                                |
| Focus dopo completamento | in «Da fare» la riga scompare: il focus passa alla riga successiva, o all'intestazione dell'elenco se è l'ultima; mai perso sul `body`                        |
| Tastiera                 | tutto raggiungibile; nessuna trappola; ordine visivo = ordine DOM                                                                                             |
| Contrasto                | token esistenti; `check:contrast` esteso ai token nuovi di avviso/scadenza (≥ 4,5:1 per il testo, ≥ 3:1 per le icone)                                         |
| Touch target             | ≥ 44×44 px sotto `md`; verificato dal test sui target già presente                                                                                            |
| Movimento                | nessuna animazione essenziale; `prefers-reduced-motion` rispettato (nessuna transizione di scomparsa obbligatoria)                                            |
| Lingua e date            | `lang="it"`; date con `<time datetime>` e testo esteso nel fuso del workspace; «Oggi/Domani» mai senza data accessibile                                       |
| Strumenti                | `axe` sulla pagina (vuota, con dati, mobile/desktop, entrambi i temi) e sul dialog                                                                            |

Limite dichiarato come per C3: prove automatiche Chromium; tastiera virtuale, screen reader reali, Firefox/WebKit **non** verificati.

## 7. Terminologia

| Concetto tecnico              | Testo                                               |
| ----------------------------- | --------------------------------------------------- |
| `open` / `done` / `cancelled` | «Da fare» / «Completata» / «Annullata»              |
| `overdue`                     | «Scaduta da N giorni» (1 giorno: «Scaduta ieri»)    |
| `today` / `soon`              | «Oggi» / «Domani», «Tra N giorni»                   |
| `none`                        | «Senza scadenza»                                    |
| `follow_up` / `preparation`   | «Follow-up» / «Preparazione»                        |
| `priority`                    | «Priorità: bassa/media/alta/urgente» (come le card) |

Nessun timestamp tecnico, nessun ISO a vista.
