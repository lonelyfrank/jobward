# M2.5 — Dominio dei colloqui

Un **colloquio** è un _round_ di selezione di una candidatura. È un'entità dedicata (tabella `interviews`), **non** un campo personalizzato: ha stati, date, esito e storia propri.

## Campi

| Campo                               | Tipo                                                                   | Note                                                                                                                                   |
| ----------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `id`, `workspaceId`, `cardId`       | testo                                                                  | chiave composita (scheda, workspace): un round non può puntare a una scheda altrui                                                     |
| `sequence`                          | intero ≥ 1                                                             | **numero d'ordine stabile** per scheda (1, 2, 3…), univoco; assegnato dal server nell'`INSERT`; mai riusato (i round non si eliminano) |
| `title`                             | testo ≤ 120                                                            | se vuoto alla creazione: «Round N»                                                                                                     |
| `type`                              | `screening` · `technical` · `behavioral` · `panel` · `final` · `other` | neutri rispetto al settore                                                                                                             |
| `status`                            | `to_schedule` · `scheduled` · `completed` · `cancelled`                | **stato organizzativo**                                                                                                                |
| `scheduledAt`                       | istante UTC (ms) o `null`                                              | 2000–2100; obbligatorio se `scheduled` (CHECK)                                                                                         |
| `timezone`                          | fuso IANA                                                              | quello in cui l'utente ha inserito l'ora (predefinito: workspace)                                                                      |
| `durationMinutes`                   | 1–1440 o `null`                                                        |                                                                                                                                        |
| `modality`                          | `video` · `phone` · `onsite` o `null`                                  | normalizzata                                                                                                                           |
| `location`, `meetingUrl`            | testo / `http(s)`                                                      | l'URL è validato come negli annunci                                                                                                    |
| `interviewers`                      | elenco di nomi (≤ 10 × 120)                                            | colonna JSON: dato leggero, non un'entità (nessuna rubrica in M2.5)                                                                    |
| `preparationNotes`, `feedbackNotes` | testo ≤ 10.000                                                         | riservati                                                                                                                              |
| `result`                            | `positive` · `neutral` · `negative` o `null`                           | **esito del round**; solo se `completed` (CHECK)                                                                                       |
| `completedAt`                       | istante o `null`                                                       | presente **se e solo se** `completed` (CHECK)                                                                                          |
| `createdAt`, `updatedAt`            | ms                                                                     |                                                                                                                                        |

Tipi e modalità sono pochi e generici di proposito (valutati contro professioni diverse: un turno di prova in cucina è «tecnico o prova pratica», un colloquio con la commissione è «commissione»). Se serviranno altri valori si aggiungono con una migrazione.

## Stato ≠ esito ≠ esito della candidatura

```
to_schedule ──(data)──▶ scheduled ──(completa)──▶ completed   (esito del round: opzionale, solo qui)
     │  ◀──(togli la data)──┘            │
     └─────────(completa)────────────────┘
to_schedule / scheduled ──(annulla)──▶ cancelled   (terminale)
```

- `completed` e `cancelled` sono terminali per lo stato; di un `completed` si possono ancora modificare **feedback, esito, note e dettagli** (non la data).
- L'**esito del round** (`result`) e l'**esito della candidatura** (`outcome` della scheda) sono indipendenti: completare un round «negativo» **non** chiude né respinge la candidatura.

## Regole di business (tutte verificate da test)

1. Creare un colloquio **non** cambia colonna, fase, esito generale né priorità.
2. Creare un colloquio non produce un esito positivo; completare un round non conclude la candidatura.
3. Passare al round successivo («fase successiva») non elimina né modifica il precedente.
4. Un colloquio **annullato** non è mai il «prossimo appuntamento» e non conta nel totale dei round attivi; resta nello storico.
5. Una candidatura **archiviata** conserva lo storico: i colloqui si leggono; le **scritture** richiedono il ripristino (409).
6. La fase si aggiorna **solo con un'azione esplicita**: nella scheda «Colloqui», se ci sono round e la fase è precedente, compare «Imposta la fase “Colloquio”» (un pulsante, nessun automatismo); dal riepilogo c'è «Aggiorna fase».
7. Nessun automatismo sulle statistiche: «in colloquio» dell'Overview continua a dipendere dalla fase e dall'esito generale (test: completare un round non cambia il contatore).
8. Tetto: **50 round** per candidatura (verificato nella stessa istruzione SQL dell'inserimento), 10 persone per round.

## Riepilogo (Kanban, tabella, pannello)

Calcolato dal server con la funzione pura `summarizeInterviews` (stessa per i test), in **una query per bacheca o per pagina** — nessuna query per scheda (provato con 1.500 schede).

- `next`: il primo colloquio **programmato non ancora trascorso** (a parità di data, il numero d'ordine minore).
- `total`: round non annullati; `completed`: quelli completati.
- `action` — **mai inventata**, deriva dai dati, in quest'ordine:
  1. `overdue`: programmato ma la data è trascorsa → «Aggiorna “Round N”»;
  2. `record_feedback`: completato senza feedback né esito → «Registra il feedback di “Round N”»;
  3. `schedule`: da programmare → «Programma “Round N”».
- «Attività aperte» **non** è mostrata: in M2.5 non esiste ancora un modo per creare attività (M3). Non c'è un controllo finto.

## Cronologia

| Evento                         | Metadati (mai note né feedback)                                                                             |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `interview_created`            | `interviewId`, `sequence`, `scheduledAt`                                                                    |
| `interview_next_round_created` | idem + `previousSequence`                                                                                   |
| `interview_rescheduled`        | `interviewId`, `sequence`, `from`, `to` (anche prima programmazione: `from` nullo; `to` nullo = data tolta) |
| `interview_completed`          | `interviewId`, `sequence`, `result`                                                                         |
| `interview_cancelled`          | `interviewId`, `sequence`                                                                                   |
| `interview_feedback_recorded`  | `interviewId`, `sequence`, `result` (solo l'esito, mai il testo)                                            |

Ogni evento è nella stessa `batch()` atomica della modifica e ha una guardia SQL: se la scrittura non è avvenuta, l'evento non c'è. Test: i testi riservati inseriti nei test non compaiono in nessun evento.

## Fusi orari

L'istante è UTC; l'utente lo scrive e lo legge nel fuso indicato (`datetime-local` + selezione del fuso, predefinito: workspace). Le conversioni sono funzioni pure testate anche attorno ai cambi d'ora; un'ora locale ambigua (l'ora che si ripete in autunno) è interpretata come la **prima**. La sigla del fuso compare solo se diverso da quello del workspace.

## Non in M2.5

Eliminazione di un round (si annulla), riordino manuale (l'ordine è il numero), invio di inviti o email, integrazione con calendari, promemoria o notifiche, rubrica degli intervistatori, valutazioni a punteggio.
