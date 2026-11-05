# M1 — Contratti API

Base: `/api/v1`. Tutte le rotte richiedono autenticazione (verificato da un test che le **enumera**).
Ogni richiesta indica `?workspaceId=<id>`: è verificato da `workspaceScope` (appartenenza); un workspace altrui e uno
inesistente danno la **stessa** risposta `404`. Il workspace **non** si legge mai dal corpo.

Le richieste che modificano dati (`POST/PATCH/DELETE`) devono avere `Content-Type: application/json` e un corpo JSON
(anche `{}`); altrimenti `415`. Un `Origin` diverso da quello dell'API dà `403`. Corpo oltre 64 KiB: `413`.
Gli schemi sono in `packages/schemas`; i corpi con campi sconosciuti sono rifiutati (`400`).

## Errori

`{ "error": { "code", "message", "requestId", "issues?" } }` — codici: `validation_error` 400, `unauthenticated` 401, `forbidden` 403,
`not_found` 404, `conflict` 409, `payload_too_large` 413, `unsupported_media_type` 415, `internal_error` 500.
Il client si basa sul `code`; il `message` dei 4xx è scritto per l'utente.

## Bacheche

| Metodo e percorso          | Corpo                                                | Risposta                                                | Note                                                                                                                       |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `GET /boards`              | —                                                    | `{ boards: [Board+columnCount+cardCount] }`             | Ordine manuale; conteggi delle schede **attive**                                                                           |
| `POST /boards`             | `{ name, description?, color?, icon?, templateId? }` | `201 { board, columns }`                                | `templateId` ∈ `job-search-standard`, `minimal`, `custom` (default). Bacheca + colonne **atomiche**. `409` al tetto di 100 |
| `GET /boards/:id`          | —                                                    | `{ board, columns[+cardCount,archivedCount], cards[] }` | Schede **attive**, ordinate; una sola richiesta                                                                            |
| `PATCH /boards/:id`        | `{ name?, description?, color?, isFavorite? }` (≥ 1) | `{ board }`                                             | `position` non modificabile da qui                                                                                         |
| `DELETE /boards/:id`       | `{}`                                                 | `{ id }`                                                | Elimina colonne, schede e dettagli (CASCADE); la cronologia resta con i riferimenti azzerati                               |
| `POST /boards/:id/move`    | `{ afterId: id \| null }`                            | `{ board }`                                             | `409` se l'ancora non esiste o coincide con la bacheca                                                                     |
| `GET /boards/:id/archived` | —                                                    | `{ cards[] }`                                           | Più recenti prima                                                                                                          |
| `POST /boards/:id/columns` | `{ name, color?, category? }`                        | `201 { column }`                                        | In fondo. `409` al tetto di 30 colonne                                                                                     |

## Colonne

| Metodo e percorso        | Corpo                                  | Risposta     | Note                                                                                                                                                                                                                                                                                                                   |
| ------------------------ | -------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PATCH /columns/:id`     | `{ name?, color?, category? }` (≥ 1)   | `{ column }` | `category` è un'etichetta informativa (vedi `board-interactions.md`)                                                                                                                                                                                                                                                   |
| `POST /columns/:id/move` | `{ afterId: id \| null }`              | `{ column }` | Come per le bacheche                                                                                                                                                                                                                                                                                                   |
| `DELETE /columns/:id`    | `{ moveCardsToColumnId?: id \| null }` | `{ id }`     | Vuota → eliminata. Con schede (anche archiviate) e senza destinazione → **409** `"La colonna contiene N schede (M archiviate): spostale…"`. Con destinazione della **stessa bacheca**: schede accodate in ordine + eliminazione, in un solo batch. Destinazione di un'altra bacheca → 400; di un altro workspace → 404 |

## Schede

| Metodo e percorso         | Corpo                                                                              | Risposta              | Note                                                                                                                                                                                                    |
| ------------------------- | ---------------------------------------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /cards`             | `{ columnId, title, description?, priority?, details?: { company?, sourceUrl? } }` | `201 { card }`        | **Basta il titolo.** In fondo alla colonna; evento `card_created`. `409` al tetto di 2000 schede per bacheca. Bacheca e workspace derivano dalla colonna                                                |
| `GET /cards/:id`          | —                                                                                  | `{ card, history[] }` | Cronologia: ultimi 50 eventi, più recenti prima                                                                                                                                                         |
| `PATCH /cards/:id`        | `{ title?, description?, priority?, company?, sourceUrl? }` (≥ 1)                  | `{ card }`            | `sourceUrl` solo http(s). `priority_changed` solo se il valore cambia. `409` se archiviata                                                                                                              |
| `POST /cards/:id/move`    | `{ columnId, afterCardId: id \| null }`                                            | `{ card }`            | Tra colonne o nella stessa; evento `card_moved` solo tra colonne. `400` colonna di un'altra bacheca; `404` di un altro workspace; `409` ancora non più valida, scheda spostata/archiviata nel frattempo |
| `POST /cards/:id/archive` | `{}`                                                                               | `{ card }`            | Idempotente. Non elimina nulla                                                                                                                                                                          |
| `POST /cards/:id/restore` | `{}`                                                                               | `{ card }`            | Idempotente. Torna nella sua colonna, **in fondo**                                                                                                                                                      |

`Card`: `id, boardId, columnId, title, description, priority, position, company, sourceUrl, createdAt, updatedAt, archivedAt`.

## Overview

`GET /overview` aggiunge `recentCards[{ id, title, boardId, boardName, columnName, updatedAt }]` (5 schede attive più recenti).
Le aggregazioni derivano solo da dati persistiti; con workspace vuoto tutto è zero.

## Concorrenza e consistenza

Vedi [kanban-ordering.md](kanban-ordering.md). In sintesi: ogni scrittura multipla è un `batch()` D1 (atomico); le condizioni
che devono valere al momento della scrittura sono **nel SQL**; un conflitto produce `409` con un messaggio per l'utente.
