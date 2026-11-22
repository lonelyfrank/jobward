# ADR-0004 — Convenzioni dati: ID, tempo, tenancy, posizioni

**Stato:** Accettato · **Data:** 2026-11-04

## Decisioni

1. **ID**: UUID testuale generato dall'app. Non rivela volumi, non richiede coordinamento, è opaco per il client. (Non ordinabile cronologicamente: si usa `created_at`.)
2. **Tempo**: timestamp come interi **ms UTC** generati dal server. **Date di calendario** (pubblicazione/candidatura) come `YYYY-MM-DD` senza fuso. **Scadenze** come istante assoluto, mostrate nel fuso del workspace (`workspaces.timezone`, IANA validato). Formattazione solo nel frontend, con `Intl`.
3. **Tenancy**: `workspace_id` su **ogni** tabella di dominio; ogni query filtra per tenant. `requireMembership` è il punto unico di verifica; workspace altrui e inesistente danno la stessa risposta (404).
4. **Integrità nel DB**: CHECK per i vocabolari, RESTRICT per le colonne non vuote, CASCADE per i dati dipendenti, SET NULL per la cronologia.
5. **Posizioni Kanban** (per M1): interi con gap (1024), inserimento nel punto medio, ribilanciamento locale quando il gap si esaurisce; spostamento come `batch()` transazionale di D1 con condizioni nel SQL (D1 non ha transazioni interattive).
6. **Eliminazione**: schede **archiviate** (`archived_at`), non cancellate; colonne con schede non eliminabili (RESTRICT + regola di servizio con messaggio chiaro).
7. **Valori JSON** (campi personalizzati): validati con Zod prima della scrittura, serializzati con `JSON.stringify` per preservare numeri, booleani e array; round-trip testato.

## Alternative scartate

- **Posizioni frazionarie (REAL)**: perdono precisione dopo molti inserimenti nello stesso punto.
- **Indice implicito (0..n) con rinumerazione**: ogni spostamento riscrive tutta la colonna.
- **Fuso orario per utente invece che per workspace**: complica i dati condivisi in futuro; rinviato.

## Conseguenze

Query semplici e verificabili per ownership; esportazione e cancellazione per workspace immediate (M4/M5).
Le posizioni con gap richiedono una routine di ribilanciamento, da coprire con test in M1.
