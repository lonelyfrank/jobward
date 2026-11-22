# Jobward — Core del prodotto

**Stato:** canonico · **Origine:** JW-CORE-01 (2026-11-21), indicazione del proprietario del prodotto · **Proprietario del documento:** proprietario del prodotto.

Questo documento definisce **che cosa è Jobward** e quali principi non cambiano al variare delle milestone. Non descrive lo stato del codice ([stato corrente](../status/CURRENT-STATE.md)) né approva funzionalità ([scope policy](../roadmap/scope-policy.md), [roadmap funzionale](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md)).

## 1. Definizione ufficiale

**Nome:** Jobward · **Categoria:** Smart Career Workspace

> Jobward è una piattaforma intelligente per organizzare, gestire e comprendere il proprio percorso professionale, trasformando opportunità lavorative, candidature, attività e informazioni in un unico ambiente interconnesso.

In una frase per l'utente: **il tuo spazio personale per la ricerca del lavoro, dove ogni opportunità, candidatura, colloquio e attività resta collegata al resto.**

## 2. Il problema

Chi cerca lavoro gestisce opportunità, candidature, contatti, scadenze e comunicazioni attraverso strumenti scollegati: portali di annunci, fogli di calcolo, appunti, email, app di task management. Le conseguenze sono note:

- le offerte interessanti si disperdono tra link, email, note e screenshot;
- dopo qualche settimana non è più chiaro a chi si è scritto, quando e con quale risposta;
- gli strumenti generici non distinguono la _posizione_ di un elemento in una bacheca dall'_esito_ di una candidatura, e rendono inaffidabile ogni statistica;
- un follow-up dimenticato costa un'opportunità;
- nessuno strumento aiuta a **interpretare** il proprio percorso per decidere meglio.

Jobward centralizza e mette in relazione queste informazioni e aiuta l'utente non solo a organizzarle, ma a usarle per prendere decisioni.

## 3. Per chi

Chiunque cerchi lavoro o voglia governare la propria carriera, **in qualsiasi settore**: nessuna logica di business dipende da un settore; le esigenze specialistiche si esprimono con campi personalizzati configurabili. Profili tipici in [PERSONAS](PERSONAS.md).

Jobward è uno strumento **per il candidato**, gratuito ([scope policy](../roadmap/scope-policy.md)). L'eventuale uso accompagnato (career advisor, mentor, academy) è un'evoluzione separata e subordinata al prodotto personale (Stream G della [roadmap](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md)).

## 4. Principi fondamentali

Ogni principio ha un significato operativo e un modo per verificarne il rispetto. Le regole di interfaccia derivate sono in [PRODUCT-PRINCIPLES](PRODUCT-PRINCIPLES.md).

### 4.1 Career-centric

Il centro del prodotto è il percorso professionale dell'utente, non la bacheca né una particolare interfaccia.

- _In pratica:_ la navigazione, i dati e le metriche ruotano attorno a opportunità, candidature e decisioni; la bacheca è uno strumento, non il contenitore primario.
- _Verifica:_ una funzione che ha senso solo «dentro una bacheca» deve giustificare perché non vale per l'intero percorso.

### 4.2 Opportunity-first

Un'opportunità esiste indipendentemente dalle candidature: può essere scoperta, salvata, valutata, confrontata e solo poi trasformata in candidatura.

- _In pratica:_ registrare un'offerta non obbliga a candidarsi, né a scegliere una bacheca o una colonna.
- _Verifica:_ si può salvare un'opportunità con il minimo indispensabile e ritrovarla senza averle assegnato una fase di candidatura.

### 4.3 Application-centric workflow

Quando una candidatura esiste, Jobward ne gestisce ciclo di vita, eventi, transizioni e avanzamento. Una stessa opportunità può ricevere più candidature nel tempo.

- _In pratica:_ stati canonici, transizioni validate, storico degli eventi, colloqui e follow-up appartengono alla candidatura.
- _Verifica:_ ogni cambio di stato è esplicito, validato dal dominio e ricostruibile dallo storico.

### 4.4 Data-driven workspace

I dati sono la fonte canonica. Bacheche, tabelle, mappe, timeline e dashboard sono **rappresentazioni** delle stesse informazioni, non archivi separati.

- _In pratica:_ nessuna vista possiede una copia autonoma dei dati; filtri, ordinamenti e raggruppamenti sono definiti una sola volta e condivisi.
- _Verifica:_ modificare un dato in una vista lo aggiorna in tutte le altre; nessuna statistica deriva dal nome di una colonna.

### 4.5 Progressive disclosure

L'utente non è obbligato a compilare tutto subito: i dati si acquisiscono e si arricchiscono nel tempo, in base alla fase del percorso.

- _In pratica:_ creazione rapida con pochissimi campi obbligatori, arricchimento successivo, dati mancanti dichiarati come tali.
- _Verifica:_ nessun campo diventa obbligatorio se l'informazione potrebbe non essere disponibile; «non specificato» non viene mai presentato come un valore.

### 4.6 Intelligent organization

L'applicazione riduce il lavoro manuale con filtri, viste generate, automazioni controllabili e suggerimenti contestuali. **L'intelligenza del prodotto non dipende da LLM**: è prima di tutto deterministica, spiegabile e verificabile.

- _In pratica:_ suggerimenti con regole dichiarate («nessun follow-up da 10 giorni»), mai deduzioni opache presentate come fatti.
- _Verifica:_ ogni suggerimento mostra la regola che lo genera e può essere ignorato senza effetti collaterali.

### 4.7 User control

Automazioni e integrazioni non modificano silenziosamente dati importanti, candidature o stati senza regole esplicite accettate dall'utente.

- _In pratica:_ un'azione che cambia lo stato di una candidatura è sempre esplicita; spostare un elemento in una bacheca personalizzata non cambia lo stato canonico.
- _Verifica:_ ogni modifica automatica è tracciata con la sua origine e reversibile o confermata.

### 4.8 Extensibility

Jobward deve poter evolvere verso integrazioni esterne, assistenti AI e uso collaborativo **senza compromettere le fondamenta**: dominio esplicito, contratti versionati, permessi e audit.

- _In pratica:_ nuove capacità si aggiungono attraverso contratti documentati e permessi, non accedendo direttamente al database.
- _Verifica:_ un'estensione si può disattivare senza perdita o corruzione dei dati del prodotto personale.

## 5. Vincoli permanenti

Valgono per ogni milestone e prevalgono sulle singole funzionalità (ereditati dalla [visione originaria](vision.md) e dalle ADR):

| Vincolo                      | Significato                                                                                                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Privacy by design**        | La ricerca di lavoro è sensibile: isolamento per workspace verificato dal server e dal database, nessun dato reale come seed, progettazione orientata al GDPR.                                                |
| **Semplicità**               | Comprensibile anche a chi non ha mai usato Trello, Jira o Notion; la complessità si scopre progressivamente.                                                                                                  |
| **Struttura senza rigidità** | La personalizzazione non compromette la qualità dei dati: posizione in bacheca, fase ed esito restano concetti separati ([ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md)). |
| **Neutralità di settore**    | Nessuna logica dipende da un settore professionale.                                                                                                                                                           |
| **Accessibilità**            | WCAG 2.2 AA come obiettivo; ogni interazione ha un'alternativa da tastiera.                                                                                                                                   |
| **Onestà dei dati**          | Nessuna funzione finta, nessun dato dimostrativo, metriche esatte distinte da stime e dati incompleti.                                                                                                        |

## 6. Non-obiettivi

Jobward **non** è e non deve diventare:

- una copia di Trello o un generico task manager scollegato dal percorso professionale;
- un aggregatore o portale di annunci privo della gestione delle candidature, né un marketplace di annunci per datori di lavoro;
- un ATS o uno strumento per recruiter e aziende;
- un social network professionale;
- un sistema che invia candidature per conto dell'utente;
- una piattaforma che dipende obbligatoriamente da servizi AI;
- un sistema in cui ogni visualizzazione possiede una copia autonoma dei dati.

## 7. Rapporto con la scope policy

Il Core definisce l'**identità**; la [scope policy](../roadmap/scope-policy.md) (vincolante dal 2026-11-07) definisce che cosa può entrare nella roadmap di implementazione. In particolare:

- «Piattaforma intelligente» **non** autorizza funzioni AI/LLM: restano fuori dalla roadmap corrente finché il proprietario non prende una nuova decisione esplicita.
- Integrazioni, notifiche, import assistito e uso collaborativo sono descritti nella [visione](PRODUCT-VISION.md) e nella [roadmap funzionale](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) come **capacità future**; la loro presenza in quei documenti non implica approvazione né assegnazione a una milestone.
- Nessun agente amplia il perimetro di una milestone in base a questo documento.

## 8. Test di coerenza per una nuova funzionalità

Prima di proporre una funzione, rispondere per iscritto:

1. Quale passo del percorso professionale migliora ([USER-JOURNEYS](USER-JOURNEYS.md))?
2. Su quale entità canonica agisce ([DOMAIN-GLOSSARY](DOMAIN-GLOSSARY.md))? Crea una copia dei dati?
3. Separa posizione in bacheca, stato della candidatura ed esito?
4. Funziona con dati incompleti?
5. Modifica qualcosa senza un'azione esplicita dell'utente?
6. Dipende da un servizio esterno o da un LLM? Che cosa succede se non è disponibile?
7. È nella roadmap approvata o richiede una decisione ([scope policy](../roadmap/scope-policy.md))?

## 9. Visione e stato attuale

Il Core non cambia con le milestone; ciò che cambia sta altrove, con un solo proprietario per argomento:

- **Il prodotto finito** e i percorsi dell'utente: [PRODUCT-VISION](PRODUCT-VISION.md), [USER-JOURNEYS](USER-JOURNEYS.md).
- **Che cosa esiste oggi**, con evidenze nel codice: [FEATURE-MATRIX](../status/FEATURE-MATRIX.md); in sintesi: [CURRENT-STATE](../status/CURRENT-STATE.md).
- **La distanza** tra le due cose: [GAP-ANALYSIS](../status/GAP-ANALYSIS.md); come colmarla: [MASTER-FUNCTIONAL-ROADMAP](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md).
- **Come si usa** oggi: [guida utente](../user/README.md).
