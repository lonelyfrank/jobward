# Personas

**Stato:** canonico · **Origine:** JW-CORE-01 · Profili di riferimento per decisioni di prodotto e UX. Non sono ricerche utente validate: sono ipotesi di lavoro derivate dalla [visione originaria](vision.md) (neutralità di settore) e dal [Core](CORE.md). Vanno aggiornate quando esisteranno dati reali (beta privata M4-C5).

## Personas primarie (prodotto personale)

| ID   | Persona                            | Contesto                                                                                | Bisogni principali                                                                           | Rischi da evitare                                            |
| ---- | ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| P-01 | **Candidato attivo**               | Cerca lavoro a tempo pieno, 20–80 opportunità in poche settimane.                       | Non perdere offerte, sapere a chi ha scritto e quando, non dimenticare i follow-up.          | Moduli lunghi; statistiche falsate dal nome delle colonne.   |
| P-02 | **Professionista in transizione**  | Occupato, valuta poche opportunità selezionate con calma.                               | Salvare e confrontare offerte senza candidarsi; ragionare su RAL, sede, modalità.            | Essere spinto a «candidarsi» per poter salvare un'offerta.   |
| P-03 | **Neolaureato / primo impiego**    | Molte candidature simili, poca esperienza del processo di selezione.                    | Una guida chiara alle fasi, promemoria deterministici, panoramica comprensibile.             | Gergo da recruiter; troppe opzioni visibili subito.          |
| P-04 | **Lavoratore non digitale-nativo** | Settori sanitario, logistica, ristorazione, artigianato; usa soprattutto lo smartphone. | Inserimento rapido da telefono, interfaccia semplice, testi chiari.                          | Interazioni solo mouse; funzioni pensate solo per l'IT.      |
| P-05 | **Candidato strategico**           | Gestisce la carriera nel lungo periodo, rientra nel mercato più volte.                  | Storico riutilizzabile, più candidature alla stessa azienda nel tempo, analisi del percorso. | Perdita dello storico; duplicati tra candidature successive. |

Proprietario del prodotto come utente: oggi Jobward è uno **strumento privato a utente singolo** (accesso Cloudflare Access per il proprietario, [authentication](../architecture/authentication.md)); le personas guidano il disegno verso la disponibilità pubblica (M5).

## Personas secondarie (evoluzione futura, non approvata)

Riguardano lo Stream G della [roadmap funzionale](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) e richiedono una decisione esplicita del proprietario ([scope policy](../roadmap/scope-policy.md)).

| ID   | Persona                     | Bisogno                                                      | Vincolo                                                                    |
| ---- | --------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| S-01 | **Career advisor / mentor** | Seguire i progressi di persone accompagnate e dare feedback. | Accesso solo su consenso esplicito del candidato, revocabile.              |
| S-02 | **Academy / bootcamp**      | Monitorare l'inserimento lavorativo di una coorte.           | Dati aggregati o condivisi volontariamente; mai funzioni da recruiter/ATS. |

Le personas secondarie **non** includono recruiter, aziende o datori di lavoro: sono fuori dal perimetro ([CORE §6](CORE.md#6-non-obiettivi)).
