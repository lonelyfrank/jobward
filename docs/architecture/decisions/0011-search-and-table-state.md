# ADR-0011 — Ricerca server-side, SQL `LIKE` e stato della tabella nell'indirizzo

**Stato:** Accettato · **Data:** 2026-11-05 · **Integra:** ADR-0008

## Contesto

M2 deve permettere di trovare e confrontare opportunità tra bacheche senza caricarle tutte nel browser, e di avere una vista tabellare condivisibile.

## Decisioni

1. **Una sola rotta** `GET /opportunities` per Opportunità e per la Tabella di una bacheca. Contratto `strict`: parametri sconosciuti, ripetuti, fuori vocabolario o incoerenti → 400.
2. **SQL, non FTS5.** `LIKE … ESCAPE` per sottostringa su sei campi, parole in AND, parametri legati. FTS5 richiede tabella virtuale, trigger di sincronizzazione, popolamento e tokenizer per l'italiano; con i tetti esistenti (100 × 2.000 schede) e `workspace_id` come primo predicato non serve. Limite noto: maiuscole/minuscole solo ASCII. Da riconsiderare con misure su dati reali.
3. **Ordinamento a insieme chiuso**: chiavi mappate su espressioni SQL costanti (rango semantico per i vocabolari), NULL in fondo, spareggio per `id`. Nessun frammento SQL dall'input.
4. **Paginazione a offset con totale** (25, max 50): ordine deterministico, scala adeguata; il cursore non serve a questi volumi.
5. **Semantica dei filtri:** AND tra gruppi, OR nel gruppo; `none` = non indicato; retribuzione solo tra importi omogenei per sovrapposizione.
6. **Stato nell'indirizzo, preferenze visive locali.** Ricerca/filtri/ordine/pagina nell'URL (voci di cronologia per i filtri, sostituzione per la digitazione); colonne visibili in `localStorage`. Nulla di nuovo sul server.
7. **Nessuna libreria di tabelle** (TanStack Table): con tutto remoto servirebbe solo per la visibilità delle colonne. **Nessuna modifica inline** (correttezza e accessibilità).
8. **Code splitting per rotta:** Kanban, Tabella/Opportunità, configuratore dei campi e gestione etichette si caricano a richiesta.

## Alternative scartate

- **Filtrare sul client** tutte le schede: carica e rivela troppo, non scala.
- **Ricerca limitata alla bacheca corrente soltanto:** la schermata Opportunità serve proprio a cercare tra bacheche (l'ambito è sempre dichiarato).
- **Cursor pagination:** inutile complessità con l'ordinamento arbitrario per colonna.

## Conseguenze

Scansione filtrata per workspace a ogni ricerca (misurata nel report dei test); nessun costo di manutenzione di un indice testuale.
