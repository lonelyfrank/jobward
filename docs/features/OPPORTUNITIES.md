# Opportunità

**Stato:** canonico · **Verificato su:** `c007e53`. Obiettivo: [PRODUCT-VISION §3 Opportunity Center](../product/PRODUCT-VISION.md#3-opportunity-center) e [§5 Wizard](../product/PRODUCT-VISION.md#5-progressive-wizard).

## Ambito

Raccolta, arricchimento, ricerca, valutazione e confronto delle opportunità professionali, indipendentemente dalle candidature.

## Stato attuale

- Un'opportunità è una **scheda** (`cards`) con dettagli facoltativi 1:1 (`application_details`); appartiene sempre a una bacheca e a una colonna (OPP-01, [DATA-MODEL](../architecture/DATA-MODEL.md)).
- Creazione col solo titolo: rapida per colonna (`apps/web/src/features/kanban/quick-create.tsx`) o globale (`global-create.tsx`); `POST /cards`.
- Dati professionali (OPP-02): azienda (testo), posizione, sede con coordinate facoltative, modalità, contratto, RAL min/max con valuta, periodicità e lordo/netto (`NULL` = non specificato), fonte, URL, date di pubblicazione e candidatura.
- Campi personalizzati per bacheca, 8 tipi (OPP-03, [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md)); etichette di workspace (OPP-04).
- Tabella trasversale `/opportunities` (OPP-05): ricerca testuale insensibile agli accenti, filtri (priorità, fase, esito, modalità, contratto, etichette, colonna, date, RAL, archiviazione), ordinamento, paginazione, stato nell'URL; `GET /opportunities`.
- Ricerca globale Ctrl/Cmd+K (OPP-06).
- Archiviazione recuperabile; nessuna eliminazione definitiva.

## Personalizzazione della vista (2026-11-22)

Filtri, riepilogo delle selezioni e colonne sono nella sidebar «Personalizza vista», con categorie richiudibili e checkbox. Da 1024 px affianca i risultati, mantiene distanza dalla navigazione principale anche compressa e limita l'altezza allo spazio disponibile; sotto questa larghezza il pannello è richiudibile sopra i risultati. La tabella scorre orizzontalmente nel proprio contenitore. Restano disponibili Tutte/Inbox/Candidature e le viste salvate. Cambiare bacheca azzera la colonna selezionata; filtri e cronologia restano nell'URL e le colonne nel dispositivo.

Implementazione: `apps/web/src/features/opportunities/{view-sidebar,sidebar-section,filters-panel,opportunities-view}.tsx`.

## Regole vincolanti

- Solo il titolo è obbligatorio; ogni altro dato può mancare e si mostra come mancante.
- RAL: importi interi nella valuta, valuta ISO 4217 obbligatoria se c'è un importo, nessuna conversione.
- Ricerca: sottostringa letterale con `instr`, mai pattern `LIKE` (limite D1) — [BACKEND](../architecture/BACKEND.md#logica-di-dominio-rilevante).
- Neutralità di settore: niente campi specifici di un settore nel modello; si usano i campi personalizzati.

## Gap e voci di roadmap

| Gap                                                                  | Voce       |
| -------------------------------------------------------------------- | ---------- |
| Opportunità senza bacheca, Inbox, più candidature                    | A-01, B-01 |
| Ruolo normalizzato e ambito, benefit, requisiti, seniority, scadenza | B-02       |
| Filtri sul motore condiviso; campi personalizzati filtrabili         | B-03, D-03 |
| Wizard progressivo                                                   | B-04       |
| Aziende come entità, duplicati                                       | B-05       |
| Import da URL/testo (richiede decisione)                             | B-06       |
| Valutazione personale, matrice comparativa                           | B-07       |
| Distanze nella matrice comparativa (la Mappa D-07 è fatta)           | E-03       |

## Vista Mappa (D-07, 2026-11-23)

Il selettore **Tabella · Mappa** (`layout=map` nell'indirizzo, quindi anche nelle viste salvate) mostra le opportunità **con gli stessi filtri, la stessa ricerca e lo stesso ambito** della tabella (`GET /opportunities/map`, [ADR-0019](../architecture/decisions/0019-opportunity-map.md)). Le regole:

- **Coordinate** della sede nei Dettagli dell'opportunità (sezione Opportunità): si incollano («45.4642, 9.19», «45,4642; 9,19») o si ricavano da un link di Google Maps o OpenStreetMap, sempre in coppia. Il testo «Sede» non viene mai interpretato: un'opportunità senza coordinate compare nell'elenco «Senza coordinate», con il collegamento ai Dettagli.
- **Posizioni personali** nel Profilo («Le tue posizioni»): casa (al massimo una) e altri luoghi, per esempio una città in cui valuti di trasferirti. Appartengono all'utente: il profilo demo ha le sue.
- **Mappa** dell'Europa in Web Mercator: confini Natural Earth incorporati sempre disponibili e, sopra, lo **stradario OpenStreetMap** (interruttore «Stradario» nei controlli, acceso per impostazione; spento non parte nessuna richiesta esterna). Con lo stradario si arriva a scala di quartiere. Si sposta trascinando o con le frecce, si ingrandisce con i pulsanti, con + e − o con Ctrl/⌘ + rotellina. I segnaposto sono pulsanti; i punti troppo vicini diventano un gruppo con il loro numero, che si ingrandisce al clic. Selezionare un'opportunità traccia le linee verso le posizioni, con la distanza.
- **Disposizione:** da 640 px di larghezza disponibile mappa e pannello sono affiancati e alti quanto lo spazio visibile, quindi la pagina non scorre e scorre solo il pannello. Più stretti, sono impilati. Il selettore Tabella · Mappa sta sulla riga di Tutte/Inbox/Candidature. In vista Mappa la colonna di sinistra diventa **Ricerca e filtri**: contiene la ricerca, non ha le colonne della tabella e da 1024 px si richiude con un'animazione in un pulsante rotondo (alto come il selettore Tutte/Inbox/Candidature) con il numero dei filtri attivi, lasciando lo spazio alla mappa. La scelta aperto/chiuso resta su questo dispositivo (`localStorage`). Non compaiono la spiegazione dell'Inbox, quella della ricerca e la riga dei conteggi, che restano solo per i lettori di schermo.
- **Pannello:** l'opportunità selezionata in cima, con la distanza da ogni posizione. Scheda **Distanze**: per ogni posizione media, mediana, più vicina e più lontana **in linea d'aria** (non è un tempo di viaggio). Scheda **Elenco**: opportunità ordinate per distanza da una posizione a scelta, con le altre distanze sotto, e in fondo quelle **senza coordinate**.
- **Città:** campo «Città» nei Dettagli (suggerisce le città già scritte) e filtro «Città» nella colonna dei filtri, primo e già aperto in vista Mappa: più città insieme e «Non indicata». Vale anche per la Tabella, come ogni filtro.
- **Scheda al passaggio del mouse** su un segnaposto: azienda in testa, sotto le offerte (per azienda se sono più d'una, con fase), poi sede e distanze dalle posizioni.
- **Senza scroll:** a ogni dimensione, dal telefono a 1920×1080, Tabella e Mappa stanno nella schermata. La tabella scorre al suo interno con l'intestazione ferma, e sotto i 1024 px ricerca e filtri della Mappa si aprono in un pannello sovrapposto dal pulsante rotondo; se non hai mai scelto, sotto i 1280 px il pannello della Mappa parte chiuso.
- Oltre 1.000 opportunità filtrate la mappa mostra le prime e lo dichiara.

Implementazione: `apps/web/src/features/opportunities/map/` (vista, mappa, modello puro, proiezione, `europe-map.json` generato da `apps/web/scripts/build-europe-map.mjs`), `apps/web/src/features/places/`, `apps/api/src/services/{opportunities,places}.ts`; calcoli in `packages/shared/src/geo.ts`.

## Dettaglio storico

Interazioni (M1), ricerca e filtri, tabella, campi personalizzati, etichette (M2) e ricerca su D1 (M4.0.1) sono nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); le decisioni valide sono in [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md), [ADR-0011](../architecture/decisions/0011-search-and-table-state.md) e [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md).
