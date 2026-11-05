# M2 — Ricerca e filtri

Una sola rotta, `GET /api/v1/opportunities`, per la schermata **Opportunità** (tutte le bacheche) e per la vista **Tabella** di una bacheca (`boardId` fisso). Contratto in [api-contracts.md](api-contracts.md#4-ricerca--get-opportunities).

## Ambito

Sempre dichiarato: sotto la casella di ricerca «Ambito: tutte le bacheche» oppure «Ambito: bacheca “X”» (e, nella schermata globale, il filtro per bacheca come contrassegno rimovibile). La ricerca globale della barra superiore porta a Opportunità con il testo nell'indirizzo; la ricerca dentro una bacheca vive nella sua vista Tabella. **Non si carica mai** l'insieme delle schede per cercare sul client.

## Ricerca testuale

- Campi: titolo, azienda, posizione, descrizione, sede, fonte.
- Ogni **parola** deve comparire (AND) in **almeno un** campo (OR): «ospedale brescia» trova una scheda con azienda «Ospedale Civile» e sede «Brescia».
- Max 100 caratteri e 6 parole (altrimenti 400).
- `LIKE '%…%' ESCAPE '\'` con `%`, `_`, `\` neutralizzati: sono caratteri letterali. Ogni parola è **un parametro legato** (riusato per i sei campi).
- **Limite noto:** in SQLite `LIKE` ignora le maiuscole solo per i caratteri ASCII (`è` ≠ `È`).

### Perché non FTS5

D1 supporta FTS5, ma richiederebbe una tabella virtuale, trigger di sincronizzazione su `cards` e `application_details`, una migrazione di popolamento e una gestione dei tokenizer per l'italiano. Con tetti di 100 bacheche × 2.000 schede e filtro obbligatorio per `workspace_id` la scansione resta nell'ordine dei millisecondi (misura locale su 2.000 schede: 8–22 ms per richiesta, vedi il report dei test). Si riconsidera se la misura su dati reali lo giustifica (vedi ADR-0011).

## Filtri e combinazione

**AND tra gruppi, OR tra i valori dello stesso gruppo.**
Esempio verificato: _priorità alta o urgente_ AND _remoto o ibrido_ AND _etichetta «Interessante»_.

| Filtro                           | Parametro                                     | Note                                                                                                    |
| -------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Bacheca / Colonna                | `boardId`, `columnId`                         | un id di un altro workspace dà un elenco vuoto (mai un errore diverso)                                  |
| Priorità                         | `priority`                                    | elenco                                                                                                  |
| Fase, Esito, Modalità, Contratto | `stage` …                                     | elenco; il valore speciale **`none`** = «non indicato» (NULL)                                           |
| Etichette                        | `labelId`                                     | **una qualsiasi** delle selezionate                                                                     |
| Data di candidatura              | `appliedFrom`, `appliedTo`                    | estremi inclusi; le schede senza data sono escluse                                                      |
| Retribuzione                     | `salaryMin/Max` + `currency` + `salaryPeriod` | **sovrapposizione** di intervalli; solo importi omogenei; valuta e periodo obbligatori (altrimenti 400) |
| Archiviate                       | `archived`                                    | `exclude` (predefinito) · `include` · `only`                                                            |

Filtri incompleti nell'interfaccia (retribuzione senza valuta, date invertite) **non vengono inviati** e il motivo è scritto accanto al campo.

## Ordinamento e paginazione

- Chiavi in **insieme chiuso** (`title company board column priority location workMode contractType stage outcome appliedOn updatedAt createdAt`), mappate su espressioni SQL costanti; `sort`/`dir` sconosciuti → 400. Nessun nome di colonna deriva dall'input.
- Priorità, fase, esito, modalità e contratto si ordinano per **rango semantico** (non alfabetico).
- Valori mancanti **sempre in fondo**, in entrambi i versi. Spareggio per `id`: ordine totale e ripetibile (nessun duplicato né salto tra pagine, provato con valori uguali).
- Pagine da 25 (max 50), `total` e `pageCount` nello stesso `batch()` dei risultati (stessa fotografia). Una pagina oltre la fine restituisce `items: []` con il totale; l'interfaccia lo spiega e riporta alla prima.

## Prestazioni e limiti D1

- Un solo `SELECT` per pagina e un `COUNT(*)`; etichette come sottoquery `json_group_array` (nessuna seconda richiesta).
- Parametri legati nel caso peggiore ≈ 75 (< 100, limite di D1).
- Indici usati: `cards_workspace_updated_idx (workspace_id, updated_at)` (nuovo, 0003), `cards_workspace_archived_idx`, `application_details_workspace_stage_idx`, PK dei dettagli e `card_labels_label_idx`.
- Interfaccia: attesa di 300 ms, **richiesta precedente annullata** (`AbortSignal` via TanStack Query), pagina precedente mantenuta durante il caricamento, un solo ritentativo per guasti passeggeri.

## Sicurezza

Parametri legati ovunque; `workspace_id` è il primo predicato e viene dal middleware; parametri ripetuti, sconosciuti o fuori vocabolario → 400; nessun conteggio, messaggio d'errore o filtro rivela dati di altri workspace (test dedicati, comprese stringhe di iniezione SQL); la query non viene registrata nei log.

## Stato nell'indirizzo

`q, board, column, priority, stage, outcome, mode, contract, label, from, to, smin, smax, cur, per, arch, sort, dir, page`. Solo valori non predefiniti. Filtri, ordine e pagina creano **voci di cronologia** (il tasto «indietro» le annulla una per volta); la digitazione nella ricerca **sostituisce** la voce. Valori non riconosciuti tornano al predefinito senza errori.
