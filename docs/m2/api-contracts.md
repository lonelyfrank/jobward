# M2 — Contratti API

Convenzioni di M1 invariate: prefisso `/api/v1`, `?workspaceId=` obbligatorio su ogni rotta (verificato **solo** da `workspaceScope`), nessun `workspaceId` nel body,
body JSON `strict`, `Content-Type: application/json` per ogni scrittura (anche `{}`), errori `{ error: { code, message, issues?, requestId } }`,
risorse di altri workspace e inesistenti → **404 indistinguibili**. Gli schemi Zod di `@meet-roulette/schemas` sono il contratto: server e client li condividono.

## 1. Scheda

```ts
Card = {
  id, boardId, columnId, title, description: string|null, priority, position,
  company, jobTitle, location, source, sourceUrl: string|null,
  workMode: 'onsite'|'hybrid'|'remote'|null, contractType: ContractType|null,
  salaryMin, salaryMax: number|null,            // unità intere della valuta
  currency: string|null,                        // ISO 4217, maiuscolo
  salaryPeriod: 'hour'|'day'|'week'|'month'|'year'|null,
  salaryBasis: 'gross'|'net'|null,              // null = NON SPECIFICATO (mai mostrato come lordo o netto)
  publishedOn, appliedOn: 'YYYY-MM-DD'|null,
  stage: Stage|null, outcome: Outcome|null,
  labelIds: string[],
  createdAt, updatedAt, archivedAt: number|null
}
```

### `POST /cards` — creazione rapida (invariata)

`{ title, columnId, description?, priority?, details?: ApplicationDetails }` · `details` accetta ora tutti i campi professionali (strict). Solo `title` e `columnId` sono obbligatori.

### `PATCH /cards/:id` — modifica parziale

Corpo `strict`, almeno un campo. **Assente = invariato, `null` = azzera** (tutti tranne `title`).
Campi: `title, description, priority` + tutti i campi professionali di `Card` (esclusi `labelIds`, id, date di sistema).

Regole sullo **stato risultante** (valori salvati + patch):

| Regola                                                                       | Errore          |
| ---------------------------------------------------------------------------- | --------------- |
| `salaryMin` ≤ `salaryMax` quando entrambi presenti                           | 400 `salaryMax` |
| un importo richiede la valuta                                                | 400 `currency`  |
| `currency` = 3 lettere maiuscole; importi interi ≥ 0 (≤ 2·10⁹)               | 400             |
| `sourceUrl` solo `http(s)`                                                   | 400 `sourceUrl` |
| `publishedOn`, `appliedOn` date di calendario reali (`2026-02-30` rifiutata) | 400             |
| scheda archiviata                                                            | 409             |

Eventi registrati nella cronologia (solo se il valore **cambia**): `priority_changed`, `stage_changed {from,to}`,
`application_submitted {appliedOn}` (prima registrazione della data), `application_closed {outcome}` (esito ≠ `pending`).

Risposta `200 { card }`.

## 2. Etichette

```ts
Label = { id, name, color: ColorToken, cardCount: number, createdAt };
```

| Metodo e percorso                   | Corpo                 | Esito                                                                                       |
| ----------------------------------- | --------------------- | ------------------------------------------------------------------------------------------- |
| `GET /labels`                       | —                     | `{ labels }` ordinate per nome (senza distinzione di maiuscole)                             |
| `POST /labels`                      | `{ name, color? }`    | 201 `{ label }` · nome già esistente (senza distinzione di maiuscole) 409 · oltre 100 → 409 |
| `PATCH /labels/:id`                 | `{ name?, color? }`   | `{ label }`                                                                                 |
| `DELETE /labels/:id`                | `{ force?: boolean }` | `{ deleted: true }` · in uso e senza `force` → 409 con il numero di schede                  |
| `POST /cards/:id/labels`            | `{ labelId }`         | `{ labelIds }` · idempotente · oltre 20 etichette per scheda → 409 · scheda archiviata 409  |
| `DELETE /cards/:id/labels/:labelId` | `{}`                  | `{ labelIds }` · idempotente                                                                |

Un `labelId` di un altro workspace dà **404 `Etichetta non trovata`** (identico a inesistente).

## 3. Campi personalizzati

```ts
CustomFieldDefinition = {
  id, boardId, name, type: CustomFieldType, config: <dipende dal tipo>,
  position: number, isActive: boolean, valueCount: number, createdAt, updatedAt
}
CardCustomField = { field: CustomFieldDefinition, value: CustomFieldValue, hasValue: boolean }
```

| Metodo e percorso                       | Corpo                                        | Esito                                                                                                                    |
| --------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `GET /boards/:id/custom-fields`         | —                                            | `{ fields }` (attivi e inattivi) in ordine di `position`                                                                 |
| `POST /boards/:id/custom-fields`        | `customFieldDefinitionInput`                 | 201 `{ field }` · nome duplicato nella bacheca (senza distinzione di maiuscole) 409 · oltre 30 → 409                     |
| `PATCH /custom-fields/:id`              | `{ name?, config?, isActive? }`, strict, ≥ 1 | `{ field }` · il **tipo non si cambia** (campo rifiutato dallo schema) · config incompatibile con i valori salvati → 409 |
| `POST /custom-fields/:id/move`          | `{ afterId: string \| null }`                | `{ field }` (riordino nella bacheca)                                                                                     |
| `DELETE /custom-fields/:id`             | `{ deleteValues?: boolean }`                 | `{ deleted: true }` · con valori e senza `deleteValues` → 409 con il numero di schede                                    |
| `GET /cards/:id/custom-fields`          | —                                            | `{ fields: CardCustomField[] }` — **solo campi attivi** della bacheca della scheda                                       |
| `PUT /cards/:id/custom-fields/:fieldId` | `{ value }`                                  | `{ field: CardCustomField }` · valore non conforme 400 · campo inattivo o scheda archiviata 409                          |

Le opzioni delle selezioni sono `{ id, label, color }`. All'inserimento il **server** assegna gli `id` (UUID) alle opzioni inviate senza `id`; con `id` presente lo conserva (ridenominazione).
Un campo di **un'altra bacheca** (anche dello stesso workspace) usato su una scheda → 404 (e, in ultima istanza, il trigger `custom_field_values_*` del database).

## 4. Ricerca — `GET /opportunities`

Parametri (tutti facoltativi; valori multipli separati da virgola, **OR** nel gruppo, **AND** tra gruppi):

| Parametro                                                  | Significato                                                                                                                                               |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `q`                                                        | testo, ≤ 100 caratteri, ≤ 6 parole, ognuna in titolo/azienda/posizione/descrizione/sede/fonte                                                             |
| `boardId`, `columnId`                                      | ambito                                                                                                                                                    |
| `priority`, `stage`, `outcome`, `workMode`, `contractType` | vocabolari controllati                                                                                                                                    |
| `labelId`                                                  | una qualsiasi delle etichette indicate (≤ 20)                                                                                                             |
| `appliedFrom`, `appliedTo`                                 | intervallo (incluso) sulla data di candidatura                                                                                                            |
| `salaryMin`, `salaryMax`, `currency`, `salaryPeriod`       | intervallo retributivo: **richiede** valuta e periodo (confronto solo tra importi omogenei); si considerano le schede il cui intervallo **si sovrappone** |
| `archived`                                                 | `exclude` (predefinito) · `include` · `only`                                                                                                              |
| `sort`                                                     | `title company board column priority location workMode contractType stage outcome appliedOn updatedAt createdAt`                                          |
| `dir`                                                      | `asc` · `desc` (predefinito `desc` per `updatedAt`/`createdAt`/`appliedOn`, altrimenti `asc`)                                                             |
| `page`, `pageSize`                                         | pagina da 1 · dimensione 1–50 (predefinita 25)                                                                                                            |

Risposta `{ items, total, page, pageSize, pageCount }`, `items[i] = Card & { boardName, columnName }`.
Un parametro fuori vocabolario, `sort` sconosciuto, intervallo retributivo senza valuta/periodo, `appliedFrom > appliedTo` → **400** (mai ignorati in silenzio).
Spareggio deterministico: `id`. I valori mancanti stanno sempre in fondo.

## 5. Overview

`GET /overview` — contatori ridefiniti (vedi [architecture.md](architecture.md#d-4--definizioni-delle-statistiche-overview)): `applicationsSubmitted`, `interviews`.
