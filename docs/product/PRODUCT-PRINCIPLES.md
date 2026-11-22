# Principi di prodotto e interazione

**Stato:** canonico · **Origine:** JW-CORE-01. Traduce i principi del [Core](CORE.md) in **regole di interfaccia e di comportamento** verificabili. Il design visivo (token, componenti, contrasto) è di proprietà del [design system](../ux/design-system.md); questo documento non lo ripete.

## Regole

| #     | Regola                                                                                                                           | Principio Core                 | Come si verifica                                              |
| ----- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- |
| PP-01 | Si crea qualunque elemento con il minimo indispensabile (oggi: il solo titolo).                                                  | Progressive disclosure         | Test di creazione con payload minimo (API + E2E).             |
| PP-02 | Un dato assente si mostra come assente («non specificato»), mai come zero, «lordo» o un valore di default.                       | Progressive disclosure, onestà | Test di presentazione dei valori nulli.                       |
| PP-03 | Spostare un elemento in una bacheca personalizzata non cambia stato né esito; al massimo propone un suggerimento non modale.     | User control                   | Test che lo spostamento emetta solo `card_moved`.             |
| PP-04 | Le azioni che cambiano lo stato di una candidatura sono esplicite, con conferma quando non sono un semplice avanzamento.         | Application-centric, control   | Test della pipeline (conferma, idempotenza).                  |
| PP-05 | Ogni suggerimento mostra la sua regola e si può ignorare senza effetti collaterali.                                              | Intelligent organization       | Test delle regole di suggerimento.                            |
| PP-06 | Nessuna funzione finta: ciò che non esiste è dichiarato («In arrivo») e disabilitato, mai simulato.                              | Onestà dei dati                | Revisione UI; nessun dato dimostrativo.                       |
| PP-07 | Le viste leggono la stessa fonte; un filtro ha lo stesso significato in Kanban, Tabella e Insights.                              | Data-driven                    | Test di conformità del motore di query (SW.3).                |
| PP-08 | Ogni interazione con il mouse ha un'alternativa da tastiera (trascinamento incluso) e funziona al tocco.                         | Accessibilità                  | E2E tastiera, axe, matrice responsive 320–1360 px.            |
| PP-09 | Lo stato navigabile (filtri, ordinamento, pagina, scheda aperta) vive nell'URL; le preferenze locali in `localStorage` protetto. | Data-driven                    | Test dello stato URL della Tabella.                           |
| PP-10 | Gli errori mostrano un messaggio comprensibile e un'azione; le operazioni ottimistiche si annullano in caso di errore.           | User control                   | Test di rollback del Kanban.                                  |
| PP-11 | Le azioni distruttive chiedono conferma e, dove possibile, offrono «Annulla» (es. archiviazione).                                | User control                   | E2E di archiviazione e ripristino.                            |
| PP-12 | I testi riservati (note, feedback) non compaiono nella cronologia né nei log.                                                    | Privacy by design              | Test sui metadati degli eventi e sul logging.                 |
| PP-13 | La complessità si scopre progressivamente: sezioni e campi avanzati compaiono quando servono.                                    | Semplicità                     | Revisione UX per persona P-03/P-04 ([PERSONAS](PERSONAS.md)). |
| PP-14 | Nessuna dipendenza obbligatoria da servizi esterni o LLM per le funzioni di base.                                                | Extensibility                  | Le funzioni di base passano gli E2E senza rete esterna.       |

## Sezioni e responsabilità

L'elenco delle sezioni del prodotto finito è in [PRODUCT-VISION §9](PRODUCT-VISION.md#9-ux-e-interfaccia); quelle esistenti oggi in [FRONTEND](../architecture/FRONTEND.md#mappa-delle-rotte).

## Quando le regole entrano in conflitto

Prevale, nell'ordine: privacy e sicurezza → integrità dei dati (stato canonico, onestà) → accessibilità → semplicità → personalizzazione.
