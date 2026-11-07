# Attività e follow-up — Contratti API proposti

**Stato:** proposta, **nessun endpoint implementato** · **Baseline:** `5a0d056eda`.
Indice: [tasks-index.md](tasks-index.md) · Modello: [tasks-architecture.md](tasks-architecture.md).

## 1. Convenzioni (identiche a M3-C2)

| Aspetto         | Regola                                                                                                                                                                   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Prefisso        | `/api/v1`, autenticazione e `csrfGuard`/`payloadLimit` globali già applicati                                                                                             |
| Workspace       | **`?workspaceId=`** su ogni richiesta, verificato da `workspaceScope`; mai dal body. Workspace altrui o inesistente → **404** indistinguibile                            |
| Ruoli           | `viewer` (predisposto) solo lettura: 403 sulle scritture                                                                                                                 |
| Validazione     | Zod con `parseJsonBody`; errore `400 validation_error` con `issues[]`; corpi con chiavi sconosciute **rifiutati** (`.strict()`)                                          |
| Errori          | vocabolario chiuso `API_ERROR_CODES`: **nessun codice nuovo**. Tutti i 409 usano `conflict` con messaggio italiano sicuro; il client li tratta come «aggiorna e riprova» |
| ID di creazione | UUID del **client** (come note/documenti/colloqui); retry = stesso ID e stesso payload                                                                                   |
| Idempotenza     | creazione: 201 / replay 200 / stesso ID e payload diverso 409; comandi di stato idempotenti per stato                                                                    |
| Concorrenza     | `expectedUpdatedAt` (compare-and-swap) sulle modifiche di campi                                                                                                          |
| Paginazione     | **cursore opaco** (`cursor` in ingresso, `nextCursor` in uscita), come note/timeline; **non offset**                                                                     |
| Rotte           | `/tasks` è **top-level** (non annidata sotto `/cards/:id`): l'attività può non avere card. L'elenco per card è un filtro (`?cardId=`)                                    |
| Rotte e test    | il test che **enumera le rotte** `/api/v1` le includerà automaticamente fra quelle da proteggere                                                                         |

Il percorso dei comandi usa `POST /tasks/:id/<azione>` (come `/cards/:id/archive`), non `PATCH` di un campo `status`: lo stato è derivato dai timestamp e non è scrivibile.

## 2. Tipi condivisi (`packages/schemas/src/task.ts`)

```ts
taskKind = z.enum(['general', 'follow_up', 'preparation']);
taskStatus = z.enum(['open', 'done', 'cancelled']); // solo in uscita
taskView = z.enum(['all', 'open', 'done', 'overdue', 'no_due', 'cancelled']);
dueOn = calendarDate; // 'YYYY-MM-DD', z.iso.date(); nullable dove indicato

createTaskInput = z
  .object({
    id: idSchema, // UUID del client
    title: requiredText(200),
    description: optionalText(2000).optional(),
    kind: taskKind.default('general'),
    priority: z.enum(PRIORITIES).default('none'),
    dueOn: dueOn.nullable().optional(),
    cardId: idSchema.nullable().optional(),
  })
  .strict();

updateTaskInput = z
  .object({
    expectedUpdatedAt: z.number().int().positive(), // OBBLIGATORIO
    title: requiredText(200).optional(),
    description: optionalText(2000).optional(), // null = svuota
    kind: taskKind.optional(),
    priority: z.enum(PRIORITIES).optional(),
    dueOn: dueOn.nullable().optional(), // null = senza scadenza
    cardId: idSchema.nullable().optional(), // null = scollega
  })
  .strict()
  .refine(hasAtLeastOneFieldBesidesExpected);

taskCardSummary = { id, boardId, title, company: string | null, archived: boolean };

taskResponseItem = {
  id,
  cardId: string | null,
  card: taskCardSummary | null,
  title,
  description: string | null,
  kind,
  priority,
  dueOn: string | null,
  status: taskStatus,
  completedAt: number | null,
  cancelledAt: number | null,
  createdAt: number,
  updatedAt: number,
};
asOf = { today: 'YYYY-MM-DD', timeZone: string }; // calcolati dal SERVER nel fuso del workspace
```

`workspaceId` non compare mai in input; in uscita non è necessario. `status` è **derivato** dal server con `taskStatus()` (stessa funzione pura del client).
Il riepilogo della card serve alla UI per costruire il link corretto (`/boards/:boardId/cards/:cardId`) e per mostrare azienda/ruolo.

## 3. Endpoint

### 3.1 `GET /tasks` — elenco

| Parametro     | Tipo / default            | Significato                                                                                                                        |
| ------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `workspaceId` | obbligatorio              |                                                                                                                                    |
| `view`        | `taskView`, default `all` | `all` = aperte + completate · `open` · `done` · `overdue` (aperte con `dueOn < oggi`) · `no_due` (aperte senza data) · `cancelled` |
| `cardId`      | facoltativo               | solo le attività di quella card; **include** le card archiviate (sola lettura). Card assente/altrui → **404**                      |
| `limit`       | 1–100, default 50         |                                                                                                                                    |
| `cursor`      | opaco                     | da `nextCursor` della pagina precedente; manomesso o non valido → **400**                                                          |

**Esclusione derivata:** senza `cardId`, le attività di **card archiviate** sono escluse da ogni vista (e dai contatori). Con `cardId` no.

**Ordinamento** (totale e deterministico; il cursore codifica la chiave completa):

| Vista                       | Ordine                                                                                          |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| `open`, `overdue`, `no_due` | `dueOn` ASC (assenti per ultime) → priorità DESC (`urgent`…`none`) → `createdAt` ASC → `id` ASC |
| `done`                      | `completedAt` DESC → `id` DESC                                                                  |
| `cancelled`                 | `cancelledAt` DESC → `id` DESC                                                                  |
| `all`                       | prima le aperte (ordine sopra), poi le completate (`completedAt` DESC)                          |

`« scadute < oggi < prossime < senza scadenza »` coincide con `dueOn ASC, assenti ultime`: **l'ordine non dipende da «oggi»**, il che rende il cursore stabile anche a cavallo della mezzanotte.

**Risposta 200:** `{ tasks: taskResponseItem[], nextCursor: string | null, asOf }`.
Errori: 400 (parametri), 404 (workspace, card), 403 non applicabile (lettura).

### 3.2 `GET /tasks/summary` — riepilogo operativo

`200 { asOf, counts: { open, today, overdue, noDue, done } }`. Calcolato con `COUNT` in **un'unica `batch()`**; nessuna riga restituita. Esclude le attività di card archiviate e le annullate.
Stessa definizione dell'elenco: `overdue` = aperte con `dueOn < oggi`; `today` = aperte con `dueOn = oggi`; `noDue` = aperte senza data; `open` = tutte le aperte (incluse queste).
Il servizio è **condiviso** con `GET /overview` (nessuna logica duplicata). Dichiarare in `asOf` la data usata rende il risultato riproducibile.

### 3.3 `POST /tasks` — creazione

Corpo: `createTaskInput`. Autorizzazione: membro non `viewer`.

| Esito | Condizione                                                                                 |
| ----- | ------------------------------------------------------------------------------------------ |
| 201   | creata → `{ task, asOf }`                                                                  |
| 200   | **replay**: stesso `id` e stesso fingerprint → stessa risorsa, nessun duplicato            |
| 400   | validazione (titolo vuoto/lungo, data impossibile, chiavi sconosciute)                     |
| 404   | `cardId` di un altro workspace o inesistente                                               |
| 409   | stesso `id` con payload diverso · card **archiviata** · tetto di 500 aperte o 5.000 totali |

Atomicità: un solo `INSERT … SELECT` guardato (tetti e card non archiviata nello stesso statement); se `changes = 0` si rilegge per scegliere fra replay, 409 o 404. Nessun evento da scrivere (v. architettura §6).

### 3.4 `GET /tasks/:id`

`200 { task, asOf }` anche per card archiviata. 404 se la task non esiste **o** appartiene a un altro workspace.

### 3.5 `PATCH /tasks/:id` — modifica campi

Corpo: `updateTaskInput` (`expectedUpdatedAt` obbligatorio + almeno un campo). `200 { task, asOf }`.

| Esito | Condizione                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 400   | validazione; nessun campo oltre `expectedUpdatedAt`                                                                                                                |
| 404   | task assente/altrui; `cardId` di destinazione assente/altrui                                                                                                       |
| 409   | `expectedUpdatedAt` non coincide (**stale**) · task di card **archiviata** · destinazione archiviata · modifica di una task `cancelled` o `done` (si riapre prima) |

`UPDATE … WHERE id=? AND workspace_id=? AND updated_at=? [AND stato di partenza]`; `changes = 0` → rilettura → 404 o 409. `updated_at = max(now, vecchio + 1)`.
Le attività **completate o annullate non si modificano**: si riaprono, poi si modificano (un solo flusso, nessuna modifica di storico).

### 3.6 `POST /tasks/:id/complete`, `/reopen`, `/cancel` — comandi di stato

Corpo: `{}` rigoroso (come `DELETE` di note). Risposta `200 { task, asOf }`. **Idempotenti per stato.**

| Comando    | Da `open`                      | Da `done`                                       | Da `cancelled`                  |
| ---------- | ------------------------------ | ----------------------------------------------- | ------------------------------- |
| `complete` | → `done` (`completedAt = now`) | **200 invariata** (timestamp **non** ritoccato) | **409** (riaprire prima)        |
| `reopen`   | **200 invariata**              | → `open` (azzera `completedAt`)                 | → `open` (azzera `cancelledAt`) |
| `cancel`   | → `cancelled`                  | **409** (riaprire prima)                        | **200 invariata**               |

Altri errori: 404 (task assente/altrui), **409** se la card è archiviata (sola lettura) e, per `reopen`, se si supera il tetto di 500 aperte.
Nessuno di questi comandi tocca la pipeline della candidatura.
`updated_at` avanza solo quando lo stato cambia davvero (un replay non invalida le altre schede aperte).

## 4. Idempotenza: matrice

| Scenario                                  | Risultato                                                               |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `POST` ripetuto dopo risposta persa       | 200, stessa task, un solo record                                        |
| `POST` con stesso `id`, titolo diverso    | 409, nessuna modifica                                                   |
| `POST` simultanei identici                | convergono su una riga (PK); uno 201, l'altro 200                       |
| `POST` simultanei diversi con stesso `id` | una riga; la perdente 409                                               |
| `complete` ripetuto                       | 200, `completedAt` invariato                                            |
| `complete` e `cancel` simultanei          | uno vince; l'altro 409 (condizione di stato nella `WHERE`)              |
| `PATCH` con `expectedUpdatedAt` scaduto   | 409; nessuna scrittura                                                  |
| Replay dopo modifica della task           | 200 con lo **stato corrente** (il fingerprint è quello della creazione) |

Senza cancellazione definitiva non esiste il caso «retry tardivo che ricrea una task eliminata».

## 5. Compatibilità con Overview

`GET /overview` mantiene la forma, con `counts.openTasks`, `counts.overdueTasks` e `upcomingTasks` ora calcolati dallo **stesso servizio** del riepilogo.
Cambio **di contratto** (T1, additivo-incompatibile solo per `upcomingTasks[].dueAt` → `dueOn`): documentato e coperto da test; il client web si aggiorna nello stesso checkpoint.

## 6. Decisioni e limiti dei contratti

- **Nessun nuovo `ApiErrorCode`** ([D-14 del registro](tasks-decision-register.md)): coerente con C2; i motivi di 409 distinguibili solo dal messaggio. Se la UI avrà bisogno di distinguerli in modo meccanico, si aggiungerà un campo `reason` **additivo** a `issues`.
- Nessun `DELETE /tasks/:id` (D-05). Nessun endpoint in blocco.
- `limit` massimo 100 e aperte ≤ 500: un'intera vista «aperte» sta in 5 pagine.
- Output sempre da `Schema.parse` (come `noteResponse.parse`): l'API non può restituire campi non dichiarati.
- Niente log di titoli o descrizioni (come già per note e documenti).
