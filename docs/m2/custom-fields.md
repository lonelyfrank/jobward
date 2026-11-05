# M2 — Campi personalizzati

Informazioni definite dall'utente **per bacheca** (nessun campo di settore è obbligatorio globalmente): un'iscrizione all'albo per la sanità, i turni per la logistica, lo stack per la tecnologia, il vitto e alloggio per la ristorazione.

## Tipi (da `packages/schemas/src/custom-field.ts`, non duplicati)

`text`, `long_text`, `number`, `date`, `boolean`, `single_select`, `multi_select`, `url`.

| Tipo             | Configurazione                      | Valore persistito (JSON)         |
| ---------------- | ----------------------------------- | -------------------------------- |
| text / long_text | `maxLength?` (≤ 10.000)             | stringa                          |
| number           | `min?`, `max?`, `integerOnly`       | **numero** (resta numero)        |
| date             | —                                   | `YYYY-MM-DD` reale               |
| boolean          | —                                   | **booleano** (`false` ≠ assente) |
| single_select    | `options[{id,label,color}]` (1–100) | ID dell'opzione                  |
| multi_select     | idem                                | array di ID (senza duplicati)    |
| url              | —                                   | `http(s)` soltanto               |

Le configurazioni sono **strict** (una chiave non prevista per il tipo è un errore). Le opzioni hanno **ID stabile** assegnato dal server (UUID): rinominare un'opzione non invalida i valori. Due opzioni con lo stesso nome (senza maiuscole) sono rifiutate.

## Politica conservativa

1. **Il tipo non si cambia** dopo la creazione (nessuna conversione silenziosa: testo→numero perderebbe dati). Per cambiarlo: nuovo campo.
2. **Una nuova configurazione è accettata solo se tutti i valori salvati restano validi.** Controllo generico: il server rivalida ogni valore con la nuova definizione (`valueSchemaFor`). Opzione rimossa ma in uso, `max` ridotto sotto un valore, lunghezza ridotta → **409** con il numero di schede coinvolte. La scrittura è inoltre condizionata a «nessun valore modificato dopo la lettura» (`updated_at`), quindi una scrittura concorrente non può lasciare un valore incompatibile.
3. **Disattivare** nasconde il campo dalle schede ma **conserva i valori**; **riattivare** li ripresenta. Un campo inattivo rifiuta nuove scritture (409).
4. **Eliminare** è un'azione separata: senza valori è diretta; con valori richiede `deleteValues: true` e l'interfaccia chiede conferma esplicita con il numero di schede e suggerisce di disattivare.

## Integrità dei valori

- Validazione **solo lato server** per ciò che conta (`validateCustomFieldValue`); il client usa le stesse funzioni per mostrare l'errore accanto al campo.
- Un valore persistito **non è considerato valido perché è JSON**: in lettura viene rivalidato con la definizione corrente; un valore non conforme (modifica diretta al database) non viene mostrato.
- `null` (campo svuotato) è **persistito**; l'assenza di riga significa «mai compilato» (`hasValue`).
- Il campo deve appartenere alla **stessa bacheca** della scheda e allo stesso workspace: verificato dal servizio (404), dal SQL dell'inserimento (`f.board_id = k.board_id`) e dal **trigger** di M0.H (ultima difesa, provata saltando il servizio).
- Un `fieldId`, `cardId`, `boardId` o `labelId` di un altro workspace dà **404 indistinguibile** dall'inesistente.

## Limiti

30 campi per bacheca (atomico), nome univoco nella bacheca senza maiuscole (indice), 100 opzioni.

## Interfaccia

- **Configuratore**: menu «Azioni bacheca» → «Campi personalizzati…» (modulo caricato a richiesta). Elenco con tipo e numero di schede, riordino con frecce (alternativa accessibile al trascinamento), modifica, disattiva/riattiva, elimina. Modulo con nome, tipo, impostazioni per tipo, editor delle opzioni (aggiungi/rinomina/sposta/rimuovi) e **anteprima** del controllo reale (lo stesso componente della scheda). Nessun JSON visibile.
- **Scheda**: sezione «Campi personalizzati» nel pannello; i valori si salvano con lo stesso «Salva» dei dettagli (richieste indipendenti: se una fallisce le altre restano salvate e la bozza del campo in errore non va persa).
- Sì/No è un menu a tre stati («Non indicato / Sì / No»).

## Limiti noti di M2

- Nessun filtro né colonna per i campi personalizzati nella Tabella (l'architettura lo prevede: il registro delle colonne è un elenco; i filtri richiederebbero join sui valori JSON).
- Nessuna conversione di tipo guidata.
- Il riordino delle opzioni nel configuratore avviene salvando il campo (l'ordine è quello dell'array).
