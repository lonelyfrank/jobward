# Modello dati (stato reale)

**Stato:** canonico per il catalogo delle tabelle e delle relazioni · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01): base `0000_jobward_v1` più le additive `0001`–`0002` · Decisione: [ADR-0017](decisions/0017-local-v1-baseline.md).

Proprietà dei contenuti:

| Argomento                                                   | Documento proprietario                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Tabelle, colonne, vincoli, relazioni, vocabolari (as-built) | **questo documento**                                                                                                      |
| Convenzioni, backup, cancellazione (design)                 | [database.md](database.md)                                                                                                |
| Isolamento tra workspace                                    | [ADR-0007](decisions/0007-database-tenant-isolation.md) · [SECURITY](SECURITY.md)                                         |
| Modello concettuale del prodotto ideale                     | [PRODUCT-VISION §2](../product/PRODUCT-VISION.md#2-entità-del-dominio) · [DOMAIN-GLOSSARY](../product/DOMAIN-GLOSSARY.md) |

Fonti nel codice: schema Drizzle [`packages/database/src/schema.ts`](../../packages/database/src/schema.ts), SQL [`packages/database/migrations/0000_jobward_v1.sql`](../../packages/database/migrations/0000_jobward_v1.sql), vocabolari [`packages/shared/src/constants.ts`](../../packages/shared/src/constants.ts). `pnpm db:check` fallisce se schema e migrazioni divergono.

## Convenzioni (sintesi)

ID testuali (UUID), timestamp interi in millisecondi UTC, date di calendario `YYYY-MM-DD` come testo, `workspace_id` su ogni tabella di dominio, vocabolari con `CHECK` generati dalle costanti TypeScript, FK composite `(x_id, workspace_id)` contro i riferimenti fra workspace. Dettaglio in [database.md](database.md#convenzioni) e [ADR-0004](decisions/0004-data-conventions.md).

## Migrazioni

| ID     | File                   | Contenuto                                                                                         |
| ------ | ---------------------- | ------------------------------------------------------------------------------------------------- |
| `0000` | `0000_jobward_v1.sql`  | 18 tabelle e 41 indici generati dallo schema; 9 trigger d'integrità; vista `current_applications` |
| `0001` | `0001_companies.sql`   | Tabella `companies`, `application_details.company_id` (SET NULL), trigger di tenancy dell'azienda |
| `0002` | `0002_saved_views.sql` | Tabella `saved_views` (viste salvate dell'Opportunity Center)                                     |

Le migrazioni storiche `0000`–`0011` (M0–SW.10) sono state compattate in questa base ([ADR-0017](decisions/0017-local-v1-baseline.md)) e restano nella storia git. Le migrazioni future sono additive.

## Relazioni

```text
users N:M workspaces            via workspace_members(role: owner|editor|viewer)
workspaces 1:N boards 1:N board_columns
cards = OPPORTUNITÀ             (board_id/column_id FACOLTATIVI: senza bacheca = Inbox)
cards 1:1 application_details   (dati professionali dell'opportunità, tutti facoltativi)
cards 1:N applications          (CANDIDATURE: sequenza 1, 2, 3…; la più alta è la CORRENTE)
applications 1:N application_snapshots   (dati dell'opportunità fotografati all'invio; immutabili per convenzione del servizio, nessun trigger lo impone)
cards 1:N interviews | card_notes | card_documents | tasks   (interviews.application_id = candidatura corrente alla creazione)
workspaces 1:N companies 1:N application_details   (company_id facoltativo, ON DELETE SET NULL)
workspaces 1:N saved_views     (al massimo 50, solo per l'Opportunity Center)
workspaces 1:N labels;  cards N:M labels via card_labels
boards 1:N custom_field_definitions;  (card × definizione) → custom_field_values
workspaces 1:N activity_events  (card_id, board_id, application_id, actor facoltativi, ON DELETE SET NULL)
```

**Fase, esito e data d'invio vivono SOLO in `applications`.** Le API li espongono sulla scheda come valori derivati dalla vista `current_applications` (sola lettura), insieme a `applicationId` e `applicationCount`.

## Catalogo delle tabelle

`[T]` = colonna di tenancy.

| Tabella                    | Colonne principali                                                                                                                                                                                                                                                          | Vincoli e note                                                                                                                                  |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `users`                    | `id`, `email`, `display_name`                                                                                                                                                                                                                                               | Email univoca e minuscola. `display_name` non usato.                                                                                            |
| `workspaces`               | `id`, `name`, `timezone`                                                                                                                                                                                                                                                    | Uno per utente (regola di servizio).                                                                                                            |
| `workspace_members`        | PK (`workspace_id`[T], `user_id`), `role`                                                                                                                                                                                                                                   | Solo `owner` assegnato.                                                                                                                         |
| `boards`                   | `workspace_id`[T], `name`, `description`, `icon`, `color`, `background_image`, `position`, `is_favorite`                                                                                                                                                                    | Organizzazione personale; eliminarla **scollega** le opportunità (FK NO ACTION + `deleteBoard`).                                                |
| `board_columns`            | `workspace_id`[T], `board_id`, `name`, `color`, `position`, `category`                                                                                                                                                                                                      | `category` = suggerimento di fase, mai applicato in automatico.                                                                                 |
| `cards`                    | `workspace_id`[T], `board_id`, `column_id`, `title`, `description`, `position`, `priority`, `archived_at`                                                                                                                                                                   | **Opportunità.** `CHECK cards_placement_pair`: bacheca e colonna entrambe presenti o entrambe NULL. Archiviazione recuperabile.                 |
| `application_details`      | PK `card_id`, `workspace_id`[T], `company`, `position`, `location`, `work_mode`, `contract_type`, `salary_min/max`, `currency`, `salary_period`, `salary_basis`, `source`, `source_url`, `published_on`, `seniority`, `deadline_on`, `requirements`, `benefits`, `interest` | Dati professionali, tutti facoltativi. `interest` 1–5 (valutazione personale). `seniority` ∈ intern/junior/mid/senior/lead/executive.           |
| `applications`             | `workspace_id`[T], `opportunity_id`, `sequence`, `stage`, `outcome`, `applied_on`, `channel`, `request_fingerprint`                                                                                                                                                         | `(opportunity_id, sequence)` univoco; idempotenza per impronta; FK composita verso `cards` CASCADE.                                             |
| `application_snapshots`    | `application_id`, `version`, `title`, `company`, `position`, `location`, `work_mode`, `contract_type`, retribuzione, `listing_source`, `listing_url`, `published_on`                                                                                                        | Fotografia all'invio; `(application_id, version)` univoco.                                                                                      |
| `custom_field_definitions` | `board_id`, `name`, `type`, `config`, `position`, `is_active`                                                                                                                                                                                                               | 8 tipi, per bacheca.                                                                                                                            |
| `custom_field_values`      | PK (`card_id`, `field_id`), `value`                                                                                                                                                                                                                                         | Trigger: il campo deve appartenere alla bacheca della scheda.                                                                                   |
| `companies`                | `workspace_id`[T], `name`, `normalized_name`, `website`, `notes`                                                                                                                                                                                                            | Chiave `(workspace_id, normalized_name)` univoca (`companyKey`); il nome sull'opportunità resta quello scritto dall'utente.                     |
| `saved_views`              | `workspace_id`[T], `name`, `scope`, `params`, `position`                                                                                                                                                                                                                    | `params` = stato dell'Opportunity Center come query string; nome univoco case-insensitive; max 50 per workspace (servizio).                     |
| `labels` / `card_labels`   | etichette di workspace e assegnazioni                                                                                                                                                                                                                                       | Nome univoco case-insensitive.                                                                                                                  |
| `interviews`               | `card_id`, `application_id`, `sequence`, `title`, `type`, `status`, `scheduled_at`, `timezone`, `duration_minutes`, `modality`, `location`, `meeting_url`, `interviewers`, note, `result`, `completed_at`                                                                   | Trigger: la candidatura deve essere della stessa opportunità.                                                                                   |
| `card_notes`               | `card_id`, `body`, `deleted_at`                                                                                                                                                                                                                                             | Tombstone; idempotenza per id client.                                                                                                           |
| `card_documents`           | `card_id`, `title`, `kind`, `url`, `note`, `deleted_at`                                                                                                                                                                                                                     | Solo riferimenti, nessun file.                                                                                                                  |
| `tasks`                    | `card_id` (facoltativo), `title`, `description`, `due_on`, `due_at` (legacy), `completed_at`, `cancelled_at`, `priority`, `kind`                                                                                                                                            | Follow-up = `kind = 'follow_up'`; nessuna eliminazione.                                                                                         |
| `activity_events`          | `card_id`, `board_id`, `application_id`, `actor_user_id`, `type`, `metadata`, `occurred_at`, `dedupe_key`, `operation_id`, `request_fingerprint`                                                                                                                            | Trigger di tenancy e di coerenza candidatura↔opportunità. `application_created` è emesso; `card_placed`/`card_unplaced` predisposti e nascosti. |

**Vista `current_applications`:** la riga di `applications` con la sequenza più alta per ogni opportunità. Usata dalle letture con alias `ca` (schede, opportunità, overview, attività, ricerca, aziende, insights). Il calendario non la usa.

## Ciclo di vita della candidatura

- **Fase** (`stage`): `saved` · `preparing` · `applied` · `in_contact` · `interviewing` · `offer` · `closed`
- **Esito** (`outcome`): `pending` · `accepted` · `rejected` · `withdrawn` · `no_response` · `offer_declined`
- **Stato di pipeline** derivato (non memorizzato, [`pipeline.ts`](../../packages/shared/src/pipeline.ts)): `saved`, `applied`, `screening`, `interviewing`, `offer`, `hired`, `rejected`, `withdrawn`, `no_response`, `archived`. Un'opportunità senza candidature ha stato `saved`.
- Scritture: pipeline (prima candidatura creata al primo avanzamento) e nuova candidatura dopo una chiusura. Regole in [WORKFLOWS](../features/WORKFLOWS.md).

## Assenze

Non esistono ancora: contatti, notifiche, preferenze lato server, allegati come file, coordinate geografiche.

## Regola di manutenzione

Ogni nuova migrazione (additiva) aggiorna nello stesso commit la tabella **Migrazioni**, il **Catalogo** e, se cambia un concetto, il [DOMAIN-GLOSSARY](../product/DOMAIN-GLOSSARY.md). Vedi [agents/WORKFLOW](../agents/WORKFLOW.md#aggiornamento-della-documentazione).
