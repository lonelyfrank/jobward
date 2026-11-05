# M2.5 — Contratti API

Convenzioni invariate (M1/M2): prefisso `/api/v1`, `?workspaceId=` su ogni rotta (verificato solo da `workspaceScope`), nessun `workspaceId` nel body, body JSON `strict`, `Content-Type: application/json` per ogni scrittura, errori `{ error: { code, message, issues?, requestId } }`, risorse di altri workspace e inesistenti → **404 indistinguibili**. Gli schemi di `@meet-roulette/schemas` (`interview.ts`) sono il contratto condiviso con il client.

## Rotte

| Metodo e percorso               | Corpo                                       | Esito                                                                                                  |
| ------------------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `GET /cards/:id/interviews`     | —                                           | `{ interviews: Interview[] }` per `sequence`; legge anche le schede archiviate                         |
| `POST /cards/:id/interviews`    | `createInterviewInput`                      | 201 `{ interview }` · scheda archiviata 409 · oltre 50 round 409 · `followUpOf` di un'altra scheda 404 |
| `PATCH /interviews/:id`         | `updateInterviewInput` (almeno un campo)    | `{ interview }`                                                                                        |
| `POST /interviews/:id/complete` | `{ result?, feedbackNotes?, completedAt? }` | `{ interview }` · già completato/annullato 409                                                         |
| `POST /interviews/:id/cancel`   | `{}`                                        | `{ interview }` · completato/annullato 409                                                             |

Scelte rispetto alla bozza del prompt: nessun `DELETE` (si annulla); la riprogrammazione è un `PATCH` di `scheduledAt` (un solo modo per la stessa azione); «fase successiva» è `POST …/interviews` con `followUpOf`.

## `createInterviewInput` (strict)

`title?` (≤ 120), `type` (predefinito `other`), `scheduledAt?` (ms, 2000–2100, o `null`), `timezone?` (IANA; predefinito: workspace), `durationMinutes?` (1–1440), `modality?`, `location?`, `meetingUrl?` (http/https), `interviewers` (≤ 10), `preparationNotes?`, `followUpOf?`.
**Non accettati** (400): `status`, `sequence`, `result`, `feedbackNotes`, `id`, `workspaceId`. Lo stato lo decide il server: con `scheduledAt` → `scheduled`, senza → `to_schedule`.

## `updateInterviewInput` (strict, assente = invariato, `null` = azzera)

Tutti i campi sopra più `feedbackNotes` e `result`. Regole di stato (409):

| Situazione                                                                                          | Esito                                 |
| --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `annullato`                                                                                         | nessuna modifica                      |
| `scheduledAt`/`timezone` su un `completato`                                                         | rifiutato                             |
| `feedbackNotes`/`result` su un colloquio **non** completato                                         | rifiutato (si registrano completando) |
| `scheduledAt` valorizzato su `to_schedule`                                                          | diventa `scheduled`                   |
| `scheduledAt: null` su `scheduled`                                                                  | torna `to_schedule`                   |
| scheda archiviata                                                                                   | rifiutato                             |
| La scrittura è condizionata allo stato letto (`WHERE status = ?`): una modifica concorrente dà 409. |

## Risposte

`Interview` = tutti i campi del dominio (vedi [interview-domain.md](interview-domain.md)), con `interviewers` come array.
`Card.interviewSummary` (in bacheca, dettaglio scheda, archiviate e ricerca): `{ total, completed, next, action }` — nessuna nota; calcolato con una query per bacheca/pagina.

## Ownership e isolamento

`getInterview` cerca per `workspace_id`; la scheda del colloquio viene cercata nello stesso workspace; l'`UPDATE` ripete `workspace_id`; la chiave composita del database rifiuta righe incoerenti. Quattro difese indipendenti (servizio ×3 + vincolo). Matrice di test: GET/POST/PATCH/complete/cancel con ID altrui → 404 identico all'inesistente, nessun cambiamento nei dati, nessuna fuga nel messaggio.
