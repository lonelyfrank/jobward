# Usare Jobward

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01). Le etichette tra virgolette sono quelle mostrate dall'interfaccia. Introduzione e installazione: [README](README.md). Le schermate mostrano il profilo **Dati demo** (aziende e persone inventate); si rigenerano con `pnpm docs:screenshots`.

![Overview: contatori di opportunità, candidature, colloqui, attività e bacheche; opportunità recenti e prossime scadenze](images/overview.jpg)

_Overview: il punto della ricerca a colpo d'occhio._

## 1. Salvare un'opportunità

Un'opportunità è un'offerta che ti interessa. Salvarla **non** significa candidarsi.

1. Apri **Azioni della vista** (⋯) in alto e scegli **Nuova opportunità**.
2. La finestra ha quattro passi: **Annuncio · Dettagli · Valutazione · Candidatura**. È obbligatorio solo il **Titolo**; il resto puoi aggiungerlo dopo.
3. Se Jobward trova un'opportunità simile già salvata, te lo segnala («Forse l'hai già salvata:») senza bloccarti.
4. In **Bacheca** puoi scegliere una bacheca oppure **Nessuna bacheca (Inbox)**.
5. All'ultimo passo, «Ti sei già candidato?» ti permette di registrare subito una candidatura già inviata.
6. **Salva opportunità**.

Dentro una bacheca puoi anche usare **Aggiungi scheda** in fondo a una colonna per un inserimento rapido.

I dettagli che puoi registrare: azienda, ruolo, luogo, modalità di lavoro, contratto, retribuzione (con periodo e lordo/netto), fonte e link, data di pubblicazione, livello di esperienza, scadenza, requisiti, benefit, interesse personale da 1 a 5, campi personalizzati della bacheca ed etichette. Ciò che non inserisci resta «non specificato», mai un valore inventato.

## 2. Candidarsi e seguire la candidatura

1. Apri l'opportunità (clic sulla scheda o sulla riga della tabella): si apre il dettaglio con quattro schede, **Panoramica, Colloqui, Storico, Dettagli**. Lo **Storico** riunisce **Tutto** (la cronologia), **Note** e **Documenti**. Accanto (sul telefono in cima alla Panoramica) c'è sempre lo **stato della candidatura**: le tappe, **Avanza nel processo**, **Registra un esito** e **Correggi stato** (ogni passaggio chiede conferma), i **Prossimi passi** e l'**Organizzazione** (colonna, priorità, etichette).
   - **Un solo «Salva»:** colonna, priorità, etichette, i campi di **Dettagli** (che si aprono in lettura: premi **Modifica**) e i campi personalizzati restano in bozza anche se cambi scheda; la barra in basso dice quante modifiche ci sono e le salva tutte insieme (oppure **Annulla**). Note, documenti, colloqui e candidature hanno invece il proprio pulsante, perché sono elementi a sé.
2. Premi **Candidati**. Jobward crea la candidatura n. 1 e conserva una **fotografia** dei dati dell'annuncio in quel momento.
3. Se una candidatura si è chiusa (per esempio con un rifiuto), puoi ricandidarti con **Nuova candidatura**: la precedente resta nello storico.

![Dettaglio di una candidatura con offerta ricevuta: stato, prossimo colloquio, sede a Milano, retribuzione e attività in scadenza](images/application-detail.jpg)

_Il dettaglio di un'opportunità, scheda Panoramica._

Lo stato della candidatura cambia **solo** con un'azione esplicita: nella **Pipeline** trascini la scheda o usi **Sposta in…**, e Jobward chiede sempre conferma; chiudendo una candidatura ti chiede «Come si è chiusa?» (assunzione, rifiuto, ritiro, nessuna risposta). Spostare una scheda in una bacheca personale **non** cambia lo stato della candidatura.

![Pipeline: le candidature divise per fase, da inviata a offerta](images/pipeline.jpg)

_La Pipeline: una colonna per ogni fase della candidatura._

## 3. Colloqui, note e documenti

- **Colloqui:** nella scheda Colloqui usa **Aggiungi colloquio**; ogni round si può **Programmare** o **Riprogrammare** (con fuso orario), completare con un esito e **Aggiungi feedback**, oppure annullare.
- **Note:** testo libero legato all'opportunità.
- **Documenti:** riferimenti (titolo, link, nota) a CV, lettere o portfolio; i file non vengono caricati.
- **Timeline:** la cronologia di eventi, note e attività dell'opportunità.

## 4. Organizzare con le bacheche

- In **Bacheche** crea una bacheca con **Nuova bacheca**, partendo da un modello.
- In una bacheca passi da **Kanban** a **Tabella**. Le schede si spostano con mouse, touch o tastiera.
- Il menu della bacheca offre **Aggiungi colonna**, **Modifica bacheca…** (nome, colore, sfondo), **Campi personalizzati…** ed **Elimina bacheca…**.
- **Archivia** toglie una scheda dalla bacheca senza eliminarla.
- Eliminare una bacheca **non elimina le opportunità**: restano in Opportunità, senza bacheca, con tutto il loro storico.

![Bacheca Kanban «Ricerca 2026» con le colonne Salvate, Da candidarsi e Inviate](images/board.jpg)

_Una bacheca in vista Kanban, con lo sfondo scelto._

## 5. Trovare e filtrare: Opportunità, viste salvate, ricerca

- **Opportunità** mostra tutto in tabella, con le schede **Tutte**, **Inbox** (opportunità senza candidatura) e **Candidature**. Usa «Cerca nelle opportunità», **Filtri** e **Colonne**; filtri e ordinamento restano nell'indirizzo della pagina.
- **Viste salvate:** con **Salva vista** conservi la combinazione corrente di filtri; ogni vista si può aggiornare («Aggiorna con i filtri attuali»), rinominare o eliminare. Le viste salvate esistono solo in Opportunità.
- **Cerca in Jobward** (Ctrl/Cmd+K) cerca tra opportunità, bacheche e colloqui.
- **Aziende** elenca le aziende in schede: cerca per nome e ordina (Nome A → Z, Z → A, Più recenti, Meno recenti). Le schede per pagina sono quante ne stanno nella finestra; se sono di più, la paginazione centrata sotto porta alle altre. Il dettaglio mostra «Informazioni» e «Opportunità e candidature».

![Opportunità in tabella con filtri a sinistra, viste salvate «Da remoto» e «Candidature attive» e ricerca](images/opportunities.jpg)

_Opportunità: filtri, viste salvate e tabella._

### Mappa: quanto distano le opportunità

1. In **Profilo → Le tue posizioni** scegli **Aggiungi una posizione**: dai un nome (per esempio «Casa»), scegli il **Tipo** (**Casa** oppure **Altra posizione**, utile per una città in cui valuti di trasferirti) e incolla le **Coordinate**. Vanno bene «45.4642, 9.19», «45,4642; 9,19» o il link di Google Maps o OpenStreetMap che le contiene. Jobward le legge da solo, senza collegarsi a nessun servizio. La casa è una sola: sceglierne un'altra rende la precedente «Altra posizione».
2. Nel dettaglio di un'opportunità, scheda **Dettagli → Modifica → Luogo**, compila **Città** (Jobward suggerisce quelle che hai già scritto) e **Coordinate** (quelle della sede) come sopra. Jobward non ricava mai città o coordinate dal testo della Sede.
3. In **Opportunità** scegli **Mappa** (accanto a **Tabella**). La mappa mostra le opportunità che rispettano **i filtri e la ricerca attivi**: per vedere solo certe aziende basta filtrare. Ricerca e filtri sono nel pannello **Ricerca e filtri** a sinistra: dopo averli regolati chiudilo con «Chiudi ricerca e filtri» per allargare la mappa, e riaprilo con il pulsante rotondo del filtro, che mostra quanti filtri sono attivi.
4. Accanto alla mappa, il pannello mostra **Distanze**: per ogni posizione la media, la mediana, la più vicina e la più lontana. **Elenco** riporta le opportunità dalla più vicina; con **Ordina per distanza da** scegli la posizione di riferimento. In fondo all'elenco ci sono le opportunità **senza coordinate**, con **Aggiungi le coordinate**. Mappa e pannello stanno nello schermo; scorre solo il pannello.

Sotto le tue opportunità c'è lo **stradario OpenStreetMap**, che mostra vie e città fino a scala di quartiere. Per disegnarlo il browser chiede a openstreetmap.org le immagini della zona che stai guardando. Se preferisci di no, spegni **Stradario OpenStreetMap** (icona dei livelli tra i controlli): restano i confini, senza nessuna richiesta esterna, e la scelta resta su questo dispositivo. Sulla mappa: trascina per spostarti; usa **+** e **−**, oppure Ctrl (⌘ su Mac) con la rotellina, per lo zoom; **Inquadra tutti i punti** torna alla vista completa. Un numero indica più opportunità vicine: cliccalo per ingrandire. Cliccando un'opportunità compaiono le linee verso le tue posizioni, con la distanza. Le distanze sono **in linea d'aria**, non tempi di viaggio.

## 6. Attività e scadenze

- In **Attività** scrivi in «Aggiungi un'attività…»; le viste sono Tutte, Da fare, Completate, In ritardo, Senza scadenza, Annullate. In alto i numeri di Da fare, Oggi e In ritardo (un clic filtra). Sotto, un selettore mostra una sezione per volta (In ritardo, Oggi, Prossime, Senza scadenza, Completate, ciascuna con il numero di attività): le righe della sezione scelta scorrono nello spazio disponibile e la pagina non scorre.
- Un'attività può essere legata a un'opportunità o generale; la scadenza è una data.
- Le attività non si eliminano: si **completano** o si **annullano**, e si possono riaprire.
- Nel dettaglio di un'opportunità Jobward può **suggerire** un follow-up in base a regole dichiarate; il suggerimento non viene mai applicato da solo.

![Pagina Attività con le attività da fare e le loro scadenze](images/tasks.jpg)

_La pagina Attività._

## 7. Calendario e Insights

- **Calendario:** griglia mensile (agenda sul telefono). Il mese, con **Mese precedente** e **Mese successivo**, è al centro sopra il calendario; **Oggi** a sinistra, la legenda Colloquio / Attività / Scadenza a destra.
- **Insights:** indicatori (opportunità, Inbox, candidature, colloqui, offerte, risposta mediana), funnel delle candidature, stato attuale, tempi di risposta, candidature per settimana, esiti, fonti e modalità di lavoro. I dati mancanti sono dichiarati; nessun numero è stimato senza dirlo.

![Calendario mensile con colloqui, attività e scadenze](images/calendar.jpg)

_Il Calendario del mese._

![Insights: indicatori, funnel delle candidature e candidature per settimana](images/insights.jpg)

_Insights: numeri calcolati dai dati, con i limiti dichiarati._

## 8. Impostazioni ed esportazione

In **Impostazioni** trovi: **Etichette** (creazione e gestione), **Aspetto** (Chiaro, Scuro, Come il sistema), le informazioni di workspace e account (sola lettura) e **I tuoi dati** con **Esporta tutti i dati (JSON)**, che scarica `jobward-export-AAAA-MM-GG.json`. Il file non include ancora aziende, viste salvate e posizioni personali (le coordinate delle opportunità sì).

**Dati demo** (solo nell'app locale): il selettore «I miei dati / Dati demo» passa a un insieme di esempio, utile per una presentazione. È un profilo separato: ciò che fai nella demo non tocca i tuoi dati, e viceversa. Il nome nel menu account diventa «frank» e il workspace «Ricerca lavoro», così sai sempre dove sei. Le aziende italiane della demo hanno sede in quartieri diversi di Milano, con le coordinate già inserite, e il Profilo demo ha «Casa» a Milano e «Torino (trasferimento)»: apri **Opportunità → Mappa** per confrontare le distanze. **Rigenera dati demo** riporta la demo allo stato iniziale con date aggiornate a oggi. L'esportazione esporta i dati del profilo attivo.

![Impostazioni, sezione Dati demo con il selettore «I miei dati / Dati demo» e il pulsante Rigenera dati demo](images/settings-demo.jpg)

_Impostazioni → Dati demo._
