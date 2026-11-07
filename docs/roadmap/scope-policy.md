# Perimetro del prodotto e politica della roadmap

**Stato:** vincolante · **Data:** 2026-11-07 · **Origine:** indicazione esplicita del proprietario del prodotto.

## Visione

Jobward è uno strumento gratuito per persone che cercano lavoro, progettato per organizzare opportunità, candidature, colloqui, attività e decisioni professionali.

## Fuori dalla roadmap attuale

Le seguenti aree non fanno parte delle milestone correnti e **non devono essere implementate senza una nuova decisione esplicita**:

- funzionalità basate su intelligenza artificiale, inclusi LLM, scoring AI e generazione automatica;
- dashboard e account dedicati ad aziende e recruiter;
- sistemi ATS per la gestione dei candidati da parte delle aziende;
- marketplace per la pubblicazione di annunci da parte dei datori di lavoro.

Queste aree possono essere ridiscusse in futuro, ma non sono pianificate.

## Candidate per sviluppi futuri (backlog di valutazione)

Acquisizione assistita delle offerte, integrazioni email e calendari, notifiche, analisi deterministica del CV, confronto economico delle offerte e strumenti avanzati per i candidati.

**La presenza nel backlog non implica approvazione né assegnazione a una milestone.**

## Roadmap corrente

| Milestone | Perimetro                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------- |
| **M3**    | completamento del workflow delle candidature, attività, follow-up, scadenze e verifiche             |
| **M4**    | insights, esportazione e prima release privata                                                      |
| **M5**    | preparazione alla disponibilità pubblica: multiutenza, sicurezza, privacy e sostenibilità operativa |

## Principio vincolante

**Nessun agente di codice deve ampliare automaticamente il perimetro di una milestone introducendo funzionalità future.**
Le nuove funzionalità richiedono una decisione esplicita prima di entrare nella roadmap di implementazione.

## Applicazione (note di coerenza)

- Il pacchetto [Attività e follow-up](../m3/tasks-index.md) è coerente: suggerimenti **deterministici** e mai automatici, nessuna AI, nessuna notifica, nessuna integrazione email/calendario, nessuno scheduler (tutti dichiarati fuori perimetro).
- Notifiche e integrazioni email/calendari sono **candidate**, non pianificate: eventuali promemoria futuri per le attività richiederebbero una decisione esplicita.
- Questo documento **non modifica** il contenuto delle milestone già consegnate né approva alcuna voce del backlog.
