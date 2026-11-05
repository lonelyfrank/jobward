# M2 — Etichette

Parole chiave **personali** (workspace) per ritrovare le opportunità: «Estero», «Part-time», «Da ricontattare». Non rappresentano fasi.

## Modello

Tabelle `labels` (`id`, `workspace_id`, `name`, `color`, `created_at`) e `card_labels` (chiave composita scheda–etichetta, entrambe vincolate al **stesso workspace** da FK composite, ADR-0007). Nome univoco nel workspace **senza distinzione di maiuscole** (indice su `lower(name)`).

## Regole

| Regola                | Dettaglio                                                                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Colore                | solo i token della palette (`slate blue green amber violet rose teal orange`); mai CSS arbitrario; `strict`                                 |
| Nome                  | 1–40 caratteri, rifilato; duplicato → 409 «Esiste già un'etichetta con questo nome»                                                         |
| Tetti                 | 100 etichette per workspace, 20 per scheda; verificati **nella stessa istruzione SQL** (nessuna finestra)                                   |
| Assegnazione          | idempotente; scheda e etichetta cercate nel SQL con `workspace_id`; scheda archiviata → 409                                                 |
| Eliminazione          | senza `force` rifiutata se in uso (409 con il numero di schede); con `force` rimuove **solo** l'etichetta e le assegnazioni — mai le schede |
| Modifica della scheda | assegnare/togliere aggiorna `updated_at` della scheda                                                                                       |

## Interfaccia

- **Pannello di dettaglio** (Panoramica): etichette assegnate con «Rimuovi», pulsante «Aggiungi etichetta» → elenco con caselle di controllo + «Nuova etichetta» (nome, colore) → «Crea e assegna». Le azioni sono **immediate** (non passano da «Salva»).
- **Kanban**: fino a 3 etichette per scheda (+N).
- **Impostazioni → Etichette** (modulo caricato a richiesta): crea, rinomina, cambia colore, elimina con conferma che dice quante schede coinvolge.
- **Filtro** nella Tabella/Opportunità (una qualsiasi delle selezionate).
- Il **nome è sempre testo**; il colore è un contrassegno decorativo (il nome del colore è letto agli screen reader).
