# Milestone

| Milestone                                             | Obiettivo                                                                                      | Stato                                                                                                 |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| **M0** Foundation & Initial Workspace                 | Fondamenta solide e primo ambiente navigabile                                                  | ✅ Completata (vedi [consegna](m0-delivery.md))                                                       |
| **M0.H** Hardening & merge readiness                  | Verifica di M0, audit di sicurezza/DB/frontend, correzioni, readiness Cloudflare               | ✅ Pronta per revisione (vedi [consegna](../m0h/delivery.md)) — **non** "production ready"            |
| **M1** Boards & Cards                                 | Il nucleo operativo: bacheche, colonne, schede, Kanban                                         | ✅ Integrata (PR #3; vedi [consegna](../m1/delivery.md))                                              |
| **M2** Job Information & Customization                | Dati professionali, campi personalizzati, etichette, filtri, ricerca, tabella                  | ✅ Pronta per revisione (vedi [consegna](../m2/delivery.md))                                          |
| **M2.5** Smart Application Modal & Interview Tracking | Modale ampia della candidatura, colloqui a round, riepilogo e card Kanban intelligenti         | ✅ Pronta per revisione (vedi [consegna](../m25/delivery.md)) — **dopo** l'integrazione di M2 / PR #4 |
| **M3** Application Workflow                           | Pipeline, colloqui, note, documenti, cronologia; attività e scadenze nei checkpoint successivi | ⏳                                                                                                    |
| **M4** Insights & Private Release                     | Statistiche, export, sicurezza, accessibilità, responsive, deploy privato                      | ⏳                                                                                                    |
| **M5** Public Readiness                               | Registrazione pubblica, multiutente, quote, GDPR, backup, monitoraggio, costi                  | 🔮 Futuro, fuori incarico                                                                             |

## M1 — Boards & Cards (piano originale; esito in [docs/m1](../m1/delivery.md))

**Obiettivo**: poter creare una bacheca da un template, aggiungere schede e spostarle, con persistenza.

### Prerequisiti già pronti da M0

- Schema DB completo (boards, board_columns, cards, activity_events…) e migrazioni `0000` + `0001`. **Dopo M0.H il database garantisce l'isolamento tra workspace** con FK composite e trigger: ogni `INSERT` di M1 deve valorizzare `workspace_id` in modo coerente (ADR-0007).
- Schemi Zod `createBoardInput`, `createColumnInput`, `createCardInput` e vocabolari.
- Template di bacheca come dati (`BOARD_TEMPLATES`) e già mostrati nella schermata Bacheche.
- Pattern di API, errori, ownership (`requireMembership`), test su D1, shell e componenti UI.
- Test che **enumera automaticamente le rotte** di `/api/v1`: una rotta aggiunta in M1 è verificata come protetta senza scrivere altro.
- Suite di **anteprima** (`pnpm test:preview`) sulla build di produzione: i nuovi flussi con modali vanno aggiunti lì per vedere la CSP reale.
- Modelli di test E2E per tastiera/focus (drawer, menu) e matrice responsive.

### Passi proposti (in ordine, ciascuno verificabile)

| #   | Task                                                                                                                 | Criteri di accettazione                                                                      |
| --- | -------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 1   | **API bacheche**: `GET/POST /boards`, `PATCH/DELETE /boards/:id` (preferita, ordine)                                 | 404 su workspace altrui; eliminazione con conferma lato UI; test ownership                   |
| 2   | **Creazione da template** (`POST /boards` con `templateId`)                                                          | Colonne create nello stesso `batch()` della bacheca (atomico); template `custom` → 0 colonne |
| 3   | **API colonne**: CRUD + riordino. DELETE rifiuta con 409 se contiene schede                                          | Messaggio chiaro; test RESTRICT + regola di servizio                                         |
| 4   | **API schede**: `POST /cards` (solo titolo), `GET` per bacheca, `PATCH`, archivia/ripristina                         | Creazione col solo titolo; evento `card_created` registrato                                  |
| 5   | **Spostamento**: `POST /cards/:id/move` con posizioni a gap (ADR-0004)                                               | Unit test dell'algoritmo (inserimento, ribilanciamento); batch atomico; evento `card_moved`  |
| 6   | **UI Bacheche**: elenco, creazione (con template), rinomina, preferita, elimina con conferma                         | E2E: crea → refresh → persiste                                                               |
| 7   | **UI Kanban**: colonne dinamiche, creazione rapida di schede, conteggi                                               | Test componenti + E2E                                                                        |
| 8   | **Drag & drop** (`@dnd-kit`) con aggiornamento ottimistico e rollback; **alternativa da tastiera/menu "Sposta in…"** | E2E: sposta, refresh, persiste; errore simulato → ripristino                                 |
| 9   | **Pannello di dettaglio** (desktop laterale / mobile schermo intero): Overview e History                             | Si apre senza perdere il contesto; focus gestito                                             |
| 10  | **Onboarding completo**: scelta template + prima opportunità                                                         | E2E del flusso completo della specifica                                                      |
| 11  | Overview: i contatori e "bacheche recenti" si popolano; rimuovere i badge M1                                         | Test aggiornati                                                                              |

### Decisioni prese in M1

- **Caricamento**: tutte le schede attive di una bacheca insieme; tetti atomici 100 bacheche / 30 colonne / 2000 schede (ADR-0008).
- **Colori**: elenco chiuso di 8 token (`slate … orange`), con contrasto ≥ 3:1 verificato; le icone delle bacheche non sono esposte in M1.
- **Fase semantica**: la categoria di una colonna è **solo un'etichetta**; spostare una scheda non cambia `stage` né `outcome` (conservativo). Il cambio proposto, con conferma, è rinviato a M2.
- **Passo 10 (onboarding con scelta template + prima opportunità)**: realizzato come checklist reale dell'Overview + creazione da template, non come procedura guidata separata.

### Rischi

- Spostamenti concorrenti e ribilanciamento delle posizioni su D1 senza transazioni interattive → algoritmo e test mirati (passo 5).
- Accessibilità del drag & drop → l'alternativa da tastiera è un requisito, non un extra.

## M2 — Job Information & Customization (esito in [docs/m2](../m2/delivery.md))

Realizzati: dati professionali completi, fase ed esito indipendenti dalla colonna, statistiche semantiche, campi personalizzati per bacheca (8 tipi, politica conservativa), etichette, ricerca e filtri sul server, vista Tabella (con elenco compatto a telefono), preferenze di colonne locali, Card Detail 2.0.

Decisioni: [ADR-0009](../architecture/decisions/0009-application-lifecycle-and-statistics.md), [ADR-0010](../architecture/decisions/0010-custom-fields-conservative-model.md), [ADR-0011](../architecture/decisions/0011-search-and-table-state.md).

### Rinviato (nessuna funzione finta)

Filtri e colonne per campi personalizzati · modifica inline in tabella · FTS5 · conversione guidata del tipo di un campo · token di versione per le modifiche · Firefox/WebKit nella suite E2E · attività, follow-up, scadenze (M3) · esportazione e deploy privato (M4).

## M2.5 — Smart Application Modal & Interview Tracking (esito in [docs/m25](../m25/delivery.md))

Realizzati: modale centrale ampia (schermo intero a telefono) con schede Panoramica/Colloqui/Dettagli/Cronologia, riepilogo con prossimo colloquio e prossima azione derivata, tracciamento dei colloqui (più round, programmazione e riprogrammazione, completamento, feedback, fase successiva, annullamento), cronologia senza testi riservati, guardia delle modifiche non salvate, card Kanban a due densità.

Decisioni: [ADR-0012](../architecture/decisions/0012-interview-tracking-and-workspace-modal.md). Migrazione additiva `0004` (con ricostruzione controllata di `activity_events`).

### Rinviato (nessuna funzione finta)

Attività e «attività aperte» (M3: non esiste ancora un modo di crearle) · inviti, email, calendari, notifiche (fuori incarico) · eliminazione e riordino manuale dei round · rubrica degli intervistatori · Firefox/WebKit e screen reader reali.

## Stato M3 aggiornato — 2026-11-07

M3-C1 (dominio) e M3-C2 (API/persistenza) integrati in main `8071759b6d`, PR #7 e CI verde.
M3-C3 (sei schede, pipeline, note, documenti come riferimenti, timeline) implementato nel branch
`m3-c3-application-workflow-ui`, quality gate locale superato (1.179 unit/integration, 176 E2E e 13 preview). [Consegna](../m3/c3-delivery.md) ·
[test](../m3/c3-testing-report.md). Attività/scadenze e checkpoint successivi restano fuori perimetro.
Nessun push, PR o deploy C3.
