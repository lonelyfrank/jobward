# Analytics e supporto alle decisioni

**Stato:** canonico · **Verificato su:** `c007e53`. Obiettivo: [PRODUCT-VISION §8](../product/PRODUCT-VISION.md#8-analytics).

## Ambito

Metriche del percorso, insights, dashboard, suggerimenti contestuali deterministici.

## Stato attuale

- **Overview** (ANA-01; `apps/web/src/routes/overview.tsx`, `apps/api/src/services/overview.ts`): 5 contatori (opportunità, candidature inviate, colloqui, attività aperte, bacheche), checklist iniziale, schede e bacheche recenti, prossime scadenze. «Candidature inviate» = data di candidatura **o** fase che la implica; mai dedotte dal nome della colonna. La risposta non è validata dallo schema `overviewResponse`.
- **Presentazione dei contatori Overview:** senza sfondo, bordo o riquadro dell’icona; icona e numero affiancati a 1,75 rem, nome del campo subito sotto e sottotitolo conservato. Padding uniforme e griglia compatta da due a cinque colonne, con larghezza massima dedicata. Le sezioni recenti e le scadenze sono trasparenti: divisore verticale continuo tra i due elenchi su desktop, titoli esterni alle aree di scorrimento e scadenze separate più in basso. Da 1024 px e 640 px di altezza il contenuto occupa lo spazio disponibile senza scorrere tutta la Home; su telefono, finestre basse e onboarding resta il flusso naturale con elenchi ad altezza limitata.
- **Insights** (ANA-02, v1): pagina `/insights` (`apps/web/src/routes/insights.tsx`) su `GET /insights`, calcolo puro in `packages/shared/src/insights.ts`: totali, funnel per passo con tassi, distribuzione degli stati, tempi di risposta (mediana, campione, in attesa, senza data), candidature per settimana, esiti, fonti, modalità.
- **Indicatori Insights:** le prime sei metriche usano lo stile compatto e trasparente dell’Overview: icona e valore affiancati da 1,75 rem, titolo e sottotitolo sotto; griglia responsive da due a tre a sei colonne.
- **Cockpit Insights:** carosello circolare (a fine corsa le frecce ripartono da capo) di sei card uniformi (funnel, settimane, esiti, modalità/benefit, provenienza, tempi di risposta), due visibili su desktop e una su telefono/tablet. Frecce e indicatori centrati sotto il carosello, scorrimento touch; titoli fissi e contenuti lunghi scorrevoli. Da 1024 × 768 px la pagina occupa il viewport; finestre più piccole mantengono lo scorrimento naturale. I tempi di risposta sono l'ultima card (mediana, campione, in attesa, senza data d'invio in griglia 2×2); il piè di pagina con l'esportazione resta in fondo. La torta si adatta allo spazio della card, con legenda affiancata quando la larghezza lo consente; include tutte le fonti e la categoria mancante sul totale delle opportunità attive; benefit = descrizione compilata, senza interpretare il testo libero.
- **Suggerimenti** deterministici solo per le attività (S1–S3).

## Regole vincolanti

- Metriche esatte distinte da stime e da dati incompleti; dati `backfill` marcati.
- Formule esplicite; nessuna finestra universale di 14 giorni; il silenzio non è un rifiuto (D12, condizionata).
- Una sola specifica delle metriche condivisa tra M4-C1 e SW.18 (SW.0c).
- Nessuno scoring AI senza nuova decisione ([scope policy](../roadmap/scope-policy.md)).

## Gap e voci di roadmap

| Gap                                   | Voce |
| ------------------------------------- | ---- |
| Specifica unica e Insights di base    | E-01 |
| Funnel, tempi di risposta, evoluzione | E-02 |
| Confronti retributivi e geografici    | E-03 |
| Suggerimenti contestuali estesi       | E-04 |
| Dashboard personalizzabili            | D-10 |

## Dettaglio storico

[ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md) · [piano M4, handoff a M4-C1](../roadmap/m4-private-release-plan.md#handoff-preciso-a-m4-c1).
