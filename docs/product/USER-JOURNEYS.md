# User journeys

> **Avviso (PID-01, 2026-11-22):** la colonna/i riferimenti «oggi in `main`» descrivono `c007e53`, prima della linea locale v1. In `jobward-v1` esistono già, fra l'altro: candidature 1:N con snapshot, Inbox, Opportunity Center con viste salvate, bacheca canonica Pipeline, inserimento guidato, aziende e duplicati, Calendario, Insights, esportazione JSON. Per lo stato reale prevale [FEATURE-MATRIX](../status/FEATURE-MATRIX.md); questo documento va riallineato alla prossima revisione di prodotto.

**Stato:** canonico (prodotto ideale) · **Origine:** JW-CORE-01. Descrive i percorsi dell'utente nel **prodotto finito**; per ogni passo indica la copertura attuale verificata nel codice di `main` (`c007e53`). Le evidenze sono in [FEATURE-MATRIX](../status/FEATURE-MATRIX.md). Le [user stories](user-stories.md) storiche (US-01…US-11) restano valide come requisiti di base.

Legenda copertura: ✅ esiste in `main` · 🟡 parziale · ⬜ non esiste.

## J-01 — Dalla scoperta all'esito (percorso principale)

| #   | Passo                     | Comportamento nel prodotto ideale                                                                | Copertura oggi                                                                                |
| --- | ------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| 1   | Scoprire un'opportunità   | Fuori da Jobward (portali, passaparola, email).                                                  | — (fuori perimetro: niente scraping né aggregazione)                                          |
| 2   | Importarla o inserirla    | Inserimento manuale rapido; import strutturato da URL/testo con conferma (futuro).               | 🟡 inserimento manuale con il solo titolo; nessun import                                      |
| 3   | Salvarla senza candidarsi | L'opportunità esiste da sola, senza bacheca né candidatura.                                      | 🟡 si salva con fase `saved`, ma una scheda appartiene sempre a una bacheca e a una colonna   |
| 4   | Arricchirla               | Wizard progressivo: azienda, ruolo, sede, modalità, contratto, RAL, requisiti, fonte, scadenza.  | ✅ dati professionali e campi personalizzati in modale; 🟡 nessun wizard progressivo dedicato |
| 5   | Valutarla e confrontarla  | Valutazione personale, confronto affiancato, distanza dalla posizione scelta.                    | ⬜ nessuna valutazione strutturata, matrice o geografia                                       |
| 6   | Decidere di candidarsi    | Azione esplicita «Candidati» che crea una candidatura collegata all'opportunità.                 | 🟡 si imposta fase/data di candidatura sulla scheda (candidatura e opportunità coincidono)    |
| 7   | Registrare l'invio        | Data, canale, documenti inviati (snapshot).                                                      | 🟡 data di candidatura e riferimenti documentali; nessuno snapshot all'invio                  |
| 8   | Gestire la selezione      | Stati canonici, transizioni validate, storico.                                                   | ✅ pipeline con transizioni validate e timeline                                               |
| 9   | Colloqui e follow-up      | Colloqui a round, attività con scadenza, suggerimenti deterministici.                            | ✅ colloqui, attività, follow-up, scadenze, suggerimenti                                      |
| 10  | Registrare l'esito        | Esito esplicito (offerta, accettata, rifiutata, ritirata, nessuna risposta) distinto dalla fase. | ✅ esito distinto da fase e colonna                                                           |
| 11  | Analizzare il percorso    | Funnel, tempi di risposta, conversioni, confronti, con dati incompleti dichiarati.               | 🟡 Overview con contatori di base; insights M4-C1 non implementati                            |

## J-02 — Riprendere il lavoro (sessione quotidiana)

1. Apro Jobward e vedo cosa richiede attenzione oggi: scadenze, follow-up suggeriti, colloqui imminenti. — 🟡 Overview e pagina Attività esistono; nessuna notifica (fuori perimetro).
2. Filtro le candidature attive e aggiorno lo stato di quelle con novità. — ✅ filtri, ricerca, Kanban/Tabella.
3. Registro un contatto o una risposta ricevuta. — 🟡 note e timeline; nessuna entità Contatto.

## J-03 — Più candidature alla stessa azienda nel tempo

1. Ritrovo un'azienda o un'opportunità già vista. — 🟡 ricerca globale; nessuna entità Azienda.
2. Mi ricandido a distanza di mesi conservando lo storico della prima candidatura. — ⬜ oggi una scheda ha un solo ciclo di vita; previsto da Smart Workspace (Opportunity 1:N Application, [ADR-0016](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md#riferimenti-smart-workspace)).

## J-04 — Organizzazione personale alternativa

1. Creo una bacheca personalizzata («Da approfondire nel weekend») senza alterare lo stato delle candidature. — 🟡 bacheche e colonne libere esistono; ma ogni scheda vive in una sola bacheca e la bacheca coincide con il contenitore.
2. Guardo gli stessi dati come tabella, timeline, calendario o mappa. — 🟡 Kanban e Tabella; ⬜ calendario, mappa, matrice; timeline solo per singola scheda e per le attività.

## J-05 — Portabilità e uscita

1. Esporto tutti i miei dati in un formato documentato. — ⬜ previsto da M4-C2.
2. Cancello account e dati. — ⬜ progettato per M5 ([database](../architecture/database.md)).

## J-06 — Accompagnamento (futuro, non approvato)

Un career advisor, con il consenso del candidato, vede i progressi e lascia feedback. — ⬜ Stream G, richiede decisione esplicita.
