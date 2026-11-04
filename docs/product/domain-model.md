# Modello di dominio

Implementazione: [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts) (persistenza) e
[`packages/schemas`](../../packages/schemas/src) (validazione). Diagramma ER: [database](../architecture/database.md).

| Entità                      | Scopo                                                | Note                                                           |
| --------------------------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| **User**                    | Account proprietario dei dati                        | Email minuscola e univoca                                      |
| **Workspace**               | Ambiente di lavoro                                   | Fuso orario IANA. MVP: uno per utente                          |
| **WorkspaceMember**         | Membership `owner` / `editor` / `viewer`             | Predispone permessi articolati; in M0 solo `owner`             |
| **Board**                   | Bacheca di opportunità                               | Nome, descrizione, icona, colore, posizione, preferita         |
| **BoardColumn**             | Colonna configurabile                                | Nome, colore, posizione, **categoria semantica** facoltativa   |
| **Card**                    | Elemento centrale                                    | Creabile col solo titolo; priorità; archiviazione recuperabile |
| **ApplicationDetails**      | Dati strutturati dell'opportunità, 1:1 con la scheda | Tutti i campi facoltativi                                      |
| **CustomFieldDefinition**   | Campo configurabile per bacheca                      | 8 tipi; configurazione tipizzata; ordine; attivo/disattivo     |
| **CustomFieldValue**        | Valore di un campo su una scheda                     | Validato rispetto alla definizione; JSON che preserva il tipo  |
| **Label** / **card_labels** | Etichette del workspace                              | Nome univoco senza distinguere maiuscole                       |
| **Task**                    | Attività                                             | Collegata a una scheda o al workspace; scadenza; completamento |
| **ActivityEvent**           | Cronologia                                           | Solo eventi significativi, metadati strutturati minimi         |

## Vocabolari controllati (`packages/shared/src/constants.ts`)

- **Priorità**: `none` · `low` · `medium` · `high` · `urgent`
- **Fase semantica** (`stage`): `saved` · `preparing` · `applied` · `in_contact` · `interviewing` · `offer` · `closed`
- **Esito** (`outcome`): `pending` · `accepted` · `rejected` · `withdrawn` · `no_response` · `offer_declined`
- **Modalità di lavoro**: `onsite` · `hybrid` · `remote` — **Contratto**: `permanent`, `fixed_term`, `part_time`, `freelance`, `internship`, `apprenticeship`, `temporary`, `other`
- **Periodicità retributiva**: `hour` · `day` · `week` · `month` · `year`
- **Tipi di campo**: `text`, `long_text`, `number`, `date`, `boolean`, `single_select`, `multi_select`, `url`
- **Eventi**: `card_created`, `card_moved`, `card_archived`, `card_restored`, `stage_changed`, `priority_changed`, `application_submitted`, `contact_logged`, `task_added`, `task_completed`, `application_closed`

I vocabolari sono **dati neutri rispetto al settore**; la specializzazione professionale si esprime con campi personalizzati.
Sono definiti una sola volta e riusati da schemi Zod, CHECK del database, API e interfaccia.

## Fase, esito e colonna

Una scheda in colonna "Colloquio" (posizione) può avere fase `interviewing` e esito `pending`. Se l'utente rinomina la colonna
in "Fase 2 — Call tecnica", la fase resta `interviewing` e le statistiche non cambiano. Una scheda chiusa (`closed`) ha un esito
(`rejected`, `accepted`, …): le due informazioni non si sovrappongono mai.

## Template di bacheca (dati, non logica)

Definiti in `packages/shared/src/templates.ts`: **Job Search Standard** (Salvate → Da candidarsi → Inviate → Contattato → Colloquio → Concluse,
con fasi semantiche associate), **Minimal** (Da fare → In corso → Completate) e **Custom** (vuota). Il frontend li legge, il backend li userà in M1 per creare le colonne.

## Stato di implementazione in M0

Schema e migrazioni: **tutte le entità**. Schemi di validazione: tutte le entità (testati). API: solo workspace/overview/me. CRUD delle altre entità: M1–M3.
