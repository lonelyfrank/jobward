# ADR-0014 — Rebranding tecnico Jobward e compatibilità dei dati

**Stato:** accettata per M3-C1 · **Data:** 2026-11-05

Sostituisce formalmente il rinvio D6 e le decisioni su logo e nomi Worker di [ADR-0013](0013-rebranding-jobward.md), conservata come registrazione storica. Autorizzazione: richiesta M3-C1 del proprietario, successiva a `0000550`.

## Decisione

- I cinque workspace diventano `@jobward/{web,api,shared,schemas,database}`; la root diventa `jobward`. Struttura, dipendenze esterne e versioni non cambiano. Import, script, workflow, test e lockfile seguono il nuovo scope; nessun alias legacy di pacchetto.
- `brand.ts` centralizza nome e asset visibili. I PNG originali restano integri: il marchio trasparente su tema chiaro, il PNG su fondo bianco presentato su una targa chiara nel tema scuro. Simbolo e favicon mostrano un ritaglio degli stessi pixel originali, senza ridisegno. La favicon SVG incorpora il PNG per funzionare anche come immagine isolata.
- I nomi Worker configurati diventano `jobward`, `jobward-dev`, `jobward-preview`, `jobward-test`. Si rinomina la configurazione locale: **nessun Worker remoto è creato o distribuito**.
- I `database_id` e i binding `DB`/`MIGRATION_DB` rimangono identici. I `database_name` legacy in `wrangler.jsonc` sono preservati per evitare una configurazione che dichiari già rinominate risorse persistenti non migrate. Il codice usa il binding `DB`, non queste etichette. Non si creano database sostitutivi.
- La configurazione dev esistente conserva esplicitamente `dev@meet-roulette.local`: il database locale contiene già questo utente con un workspace e dati. Cambiare solo l'email configurata provocherebbe la creazione di un secondo utente, nascondendo il workspace precedente. Il fallback del codice e l'ambiente preview isolato usano `dev@jobward.local`. Le fixture dei test restano quelle previste dai rispettivi scenari.
- Le preferenze browser si scrivono su `jobward-theme` e `jobward-sidebar-collapsed`. La lettura delle vecchie chiavi `mr-*` copia il valore senza cancellarlo; una nuova preferenza già presente ha precedenza. Lo script prima del primo paint segue la stessa regola. Le animazioni CSS usano nomi `jobward-*`; le utility Tailwind `mr-*` (margine destro) non sono branding.
- Migrazioni `0000`–`0004`, journal e snapshot restano invariati. Nessun nuovo schema persistente in C1. Consegne e ADR storiche mantengono il nome usato al momento della loro redazione; la documentazione corrente segue questa decisione.

## Procedura conservativa dell'identità locale (non applicata ai dati esistenti)

1. Fermare volontariamente il proprio server dev e fare una copia coerente del database SQLite locale, inclusi eventuali WAL. Non interrompere automaticamente processi altrui.
2. Individuare il file SQLite **popolato** in `apps/api/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/` (non `metadata.sqlite`). Verificare l'utente e il workspace attesi.
3. Eseguire il dry-run: `node scripts/rename-dev-identity.mjs <file.sqlite> dev@meet-roulette.local dev@jobward.local`. Il file deve già esistere; la procedura apre una transazione locale e fa rollback per impostazione predefinita.
4. Solo dopo la verifica, ripetere con `--apply`. La procedura cambia esclusivamente `users.email`, preserva ID, membership e riferimenti, verifica le chiavi esterne e rifiuta collisioni senza fondere utenti. Non opera su D1 remoto.
5. Aggiornare insieme `DEV_USER_EMAIL` nell'ambiente dev o nel proprio override locale, riavviare e verificare il workspace. Per tornare indietro usare la procedura inversa prima di ripristinare la configurazione; non eseguire reset.

La procedura è testata su database temporanei, incluso lo schema reale fino a `0004`. Non è parte dell'installazione, dell'avvio o di una migrazione automatica.

## Infrastruttura remota rinviata

Prima di un eventuale deploy futuro occorrono inventario reale di Worker/D1/Access/domìni, backup e piano di spostamento del traffico. Conservare il database esistente e il suo ID; per un ambiente nuovo si può scegliere `database_name=jobward` configurando esplicitamente l'ID appropriato. Il nome Worker nuovo richiede una verifica separata di Access, segreti e instradamento. Questa ADR non autorizza creazione, sostituzione, import/export o migrazione di risorse remote.

## Operazioni non eseguite

Nessun deploy, push, merge, PR, migrazione remota, reset persistente o modifica di `main`. La compatibilità residua è limitata alle etichette D1, all'email dev esplicita, alla lettura delle preferenze browser e alla documentazione storica. C2 resta necessario per persistenza, idempotenza e nuovi eventi.
