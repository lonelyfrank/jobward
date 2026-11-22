# Opportunità

**Stato:** canonico · **Verificato su:** `c007e53`. Obiettivo: [PRODUCT-VISION §3 Opportunity Center](../product/PRODUCT-VISION.md#3-opportunity-center) e [§5 Wizard](../product/PRODUCT-VISION.md#5-progressive-wizard).

## Ambito

Raccolta, arricchimento, ricerca, valutazione e confronto delle opportunità professionali, indipendentemente dalle candidature.

## Stato attuale

- Un'opportunità è una **scheda** (`cards`) con dettagli facoltativi 1:1 (`application_details`); appartiene sempre a una bacheca e a una colonna (OPP-01, [DATA-MODEL](../architecture/DATA-MODEL.md)).
- Creazione col solo titolo: rapida per colonna (`apps/web/src/features/kanban/quick-create.tsx`) o globale (`global-create.tsx`); `POST /cards`.
- Dati professionali (OPP-02): azienda (testo), posizione, sede, modalità, contratto, RAL min/max con valuta, periodicità e lordo/netto (`NULL` = non specificato), fonte, URL, date di pubblicazione e candidatura.
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
| Geografia e distanza                                                 | D-07, E-03 |

## Dettaglio storico

Interazioni (M1), ricerca e filtri, tabella, campi personalizzati, etichette (M2) e ricerca su D1 (M4.0.1) sono nell'archivio storico non pubblicato ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)); le decisioni valide sono in [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md), [ADR-0011](../architecture/decisions/0011-search-and-table-state.md) e [ADR-0017](../architecture/decisions/0017-local-v1-baseline.md).
