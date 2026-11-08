# M3-C3 closure e readiness per M3-T1

> **Aggiornamento:** le condizioni di questo documento sono state superate dall'implementazione ([consegna finale](m3-final-delivery.md)); la verifica del D1 remoto resta aperta (M3F-02).

**Data:** 2026-11-07 · **Baseline:** `origin/main` = `5a0d056eda` · Indice del pacchetto: [tasks-index.md](tasks-index.md).
Contesto: [c3-closure.md](c3-closure.md) (causa della CI rossa) · [registro decisioni](tasks-decision-register.md).

## 1. Esito CI di M3-C3

**Correzione pubblicata** con il solo commit `f359630` (genitore = `origin/main`, nessun altro commit) sul branch `fix/m3-c3-preview-race`; **PR [#8](https://github.com/lonelyfrank/jobward/pull/8)** verso `main`.
Nessun push su `main`, nessun merge, nessun auto-merge.

**Run [42362035618](https://github.com/lonelyfrank/jobward/actions/runs/42362035618)** sulla PR #8, commit `f359630f9e0d848e56b2ed0790a430de142e7404`, **tentativo 1, nessun retry** (la CI ha `retries: 1`; Playwright non ha segnalato alcun test «flaky»):

| Job / passo                            | Esito                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------- |
| Typecheck · Lint · Test · Build        | **verde**, 4 min 11 s (shared 599, schemas 49, web 142, API 389 = 1.179 test)         |
| E2E (Playwright) — `pnpm test:e2e`     | **verde**: 176 passati, 1 saltato (collector visuale opzionale preesistente), 8,5 min |
| E2E (Playwright) — `pnpm test:preview` | **verde**: **13/13** passati (20,2 s), incluso il test 302 che falliva su `main`      |
| Stato della PR                         | `CLEAN` / `MERGEABLE`, aperta, **non integrata**                                      |

**Lettura corretta dell'esito.** La **verifica remota del fix è verde**. `main` però **resta rossa** finché la PR non è integrata (il merge è una tua decisione: nessun auto-merge).
La chiusura formale di M3-C3 si ha con **merge + run di `main` verde**; fino ad allora non è dichiarata.

## 2. Stato PR e protezione di `main` (verificato, sola lettura)

| Controllo                | Esito                                                                                                                                           |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Branch protection `main` | **assente** (`404 Branch not protected`)                                                                                                        |
| Repository rulesets      | **nessuno** (`[]`)                                                                                                                              |
| Repository               | pubblico; permessi dell'utente: admin; merge commit, squash e rebase consentiti; auto-merge **disattivato**; branch non eliminati dopo il merge |
| Workflow                 | `CI` su `pull_request`, `push` su `main`, `workflow_dispatch`; job `Typecheck · Lint · Test · Build` e `E2E (Playwright)` (dipende dal primo)   |

### Aggiornamento verificato — 2026-11-08

Main `9a48f0b`, repository pubblico, permessi admin confermati; API branch: `protected: false`, required checks vuoti; API ruleset: `[]`. Le due check run effettive della HEAD PR `30436a1` sono `Typecheck · Lint · Test · Build` e `E2E (Playwright)`, entrambe verdi. La preview è uno step del secondo job, non un terzo status check.

Il connettore non espone la lettura delle protezioni: queste verifiche sono state completate via GitHub CLI in sola lettura. Il nome del piano account non è esposto dalla risposta disponibile; non viene ipotizzato. Per questo repository pubblico, i branch/tag ruleset e le branch protection sono disponibili anche su GitHub Free, secondo la [documentazione GitHub sui ruleset](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets) e sulle [branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches). La disponibilità di un push ruleset non è necessaria per proteggere main. Nessuna impostazione modificata.

### Configurazione proposta (**NON applicata**: serve la tua approvazione separata)

Ruleset di repository sul branch predefinito:

| Regola                               | Valore proposto                                                                  | Motivo                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Pull request prima del merge         | sì, **0 approvazioni richieste**                                                 | sei l'unico manutentore: GitHub non consente di approvare la propria PR; una review obbligatoria bloccherebbe ogni merge |
| Conversazioni risolte                | richiesto                                                                        | come richiesto                                                                                                           |
| Controlli obbligatori                | `Typecheck · Lint · Test · Build` **e** `E2E (Playwright)` (nomi esatti dei job) | Quality, E2E e preview (la preview è un passo del job E2E)                                                               |
| Branch aggiornato prima del merge    | sì (`strict_required_status_checks_policy`)                                      | evita merge su una base diversa da quella testata                                                                        |
| Force-push e cancellazione di `main` | bloccati                                                                         | storia lineare e non riscrivibile                                                                                        |
| Bypass                               | **nessuno**                                                                      | come richiesto                                                                                                           |
| Auto-merge, squash/merge/rebase      | invariati                                                                        | non richiesti                                                                                                            |

```json
{
  "name": "protect-main",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Typecheck · Lint · Test · Build" },
          { "context": "E2E (Playwright)" }
        ]
      }
    }
  ]
}
```

Applicazione (**da eseguire solo dopo approvazione**): `gh api -X POST repos/lonelyfrank/jobward/rulesets --input ruleset.json`. La proposta usa `enforcement: active` soltanto dopo approvazione; non si presume la disponibilità della modalità `evaluate`. In caso di rifiuto API/piano, mantenere il processo PR → due check verdi sulla HEAD e base aggiornata → merge autorizzato → CI main verde, registrando il limite; non è una protezione tecnica equivalente.

**Compromessi dichiarati**

- Senza bypass, neppure l'admin può forzare un push d'emergenza su `main`: bisognerebbe disattivare il ruleset (si può, ma è un'azione esplicita e tracciata).
- «Branch aggiornato» + E2E da ~13–18 minuti: ogni merge costringe le altre PR ad aggiornarsi e a rilanciare la CI. Con una sola PR alla volta è trascurabile.
- La storia dei flake E2E (PR #6, PR #7, run 42334739111) significa che un E2E obbligatorio può bloccare un merge: va previsto il «Re-run failed jobs» **dopo** aver letto la causa, non per abitudine.
- I nomi dei controlli contengono il carattere `·`: devono coincidere esattamente con `name:` nel workflow.

## 3. Verifica D1

### 3.1 Cosa è stato verificato **qui** (locale)

| Verifica                                                                                                                  | Esito                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identità/binding nel repo (`apps/api/wrangler.jsonc`)                                                                     | binding `DB`, `database_name = "meet-roulette"`, **`database_id` = segnaposto `0000…`** (ADR-0014); ambienti `dev`/`preview` su D1 locale                                                                                                                                                                                                 |
| Account Cloudflare raggiungibile con il login di wrangler (OAuth)                                                         | sì                                                                                                                                                                                                                                                                                                                                        |
| `wrangler d1 list` su quell'account                                                                                       | **`[]`: nessun database D1**                                                                                                                                                                                                                                                                                                              |
| `wrangler deployments list --name jobward`                                                                                | **richiesta fallita** (codice d'errore non catturato; coerente con l'assenza del Worker, **non provato**)                                                                                                                                                                                                                                 |
| Migrazioni `0000`→`0005` applicate su D1 locale (workerd) da zero                                                         | **6 migrazioni** registrate in `d1_migrations`                                                                                                                                                                                                                                                                                            |
| Schema `tasks` locale = quello di `0001` (10 colonne, FK composita, 2 indici)                                             | sì                                                                                                                                                                                                                                                                                                                                        |
| Righe in `tasks` nei DB locali/di test                                                                                    | 0 (nessun percorso di scrittura)                                                                                                                                                                                                                                                                                                          |
| **SQL additivo della proposta `0006`** su D1 locale (workerd), file di prova **fuori dal repo**, con riga legacy inserita | **7 istruzioni eseguite**; riga legacy **conservata** (`due_at` intatto, `kind='general'`); le 6 violazioni di prova (doppio timestamp, titolo vuoto, `kind` errato, `due_on='2026-02-30'`, fingerprint corto, card inesistente) **rifiutate** dal motore; `UPDATE` incoerente **rifiutato**; i 3 nuovi indici creati, il vecchio rimosso |
| `SELECT sqlite_version()`                                                                                                 | **vietata su D1** («not authorized to use function»): la versione **non è interrogabile**; la compatibilità si prova per comportamento                                                                                                                                                                                                    |

La migrazione `0006` **non è stata creata nel repo**: il file di prova sta nello scratchpad di sessione.

### 3.2 Cosa **non** è verificabile da qui

Con le credenziali disponibili **non esiste alcun D1 remoto** da ispezionare: non si può contare `tasks`, leggere lo schema o l'elenco delle migrazioni remote, né confermare che il database di produzione (se esiste) sia in un altro account.
Di conseguenza **l'approvazione definitiva di D-01 e D-13 è sospesa** (v. §6) finché non si eseguono i comandi qui sotto sul database reale, **oppure** si conferma che non esiste alcun database remoto (nel qual caso `0006` si applicherà a un ambiente nuovo insieme a `0000`–`0005`).

### 3.3 Comandi esatti, in sola lettura (da eseguire a mano)

Eseguire da una **cartella neutra** (non dentro il repo: il `database_id` segnaposto di `wrangler.jsonc` altererebbe la risoluzione per nome). `wrangler d1 execute` **non impone** la sola lettura: usare **solo** i comandi seguenti, tutti `SELECT`/`PRAGMA`, sempre con `--remote`. Non eseguire `migrations apply`, `export`, `time-travel restore` né `DELETE/UPDATE/DROP`.

```bash
mkdir -p ~/d1-check && cd ~/d1-check
W="pnpm --dir /home/frank/jobward --filter @jobward/api exec wrangler"   # oppure: npx wrangler@4

# 1. Identità: quale account e quale database
$W whoami
$W d1 list --json                       # annotare name e uuid del database di Jobward (atteso: meet-roulette o un nome scelto)
$W d1 info <NOME_DB> --json             # dimensione e numero di tabelle: nessun dato di riga

# Da qui in poi: <NOME_DB> = il nome trovato sopra
q() { $W d1 execute <NOME_DB> --remote --json --command "$1"; }

# 2. Migrazioni applicate (atteso: 0000 … 0005, nei nomi del repo; nessuna in più)
q "SELECT id, name, applied_at FROM d1_migrations ORDER BY id"

# 3. Schema effettivo di tasks (confronto con 0001: vedi tabella sotto)
q "PRAGMA table_info(tasks)"
q "PRAGMA foreign_key_list(tasks)"
q "PRAGMA index_list(tasks)"
q "SELECT sql FROM sqlite_master WHERE tbl_name = 'tasks'"

# 4. Righe (SOLO conteggi: non selezionare titolo o descrizione)
q "SELECT count(*) AS n, sum(due_at IS NOT NULL) AS con_due_at, sum(completed_at IS NOT NULL) AS completate, sum(card_id IS NOT NULL) AS con_card FROM tasks"

# 5. Nessun'altra tabella dipende da tasks (atteso: nessuna riga). NB: `pragma_foreign_key_list()` come funzione di tabella è vietata su D1
q "SELECT name FROM sqlite_master WHERE type = 'table' AND name <> 'tasks' AND sql LIKE '%REFERENCES \`tasks\`%'"
```

**Esito atteso e criterio di compatibilità con `0006`**

| Controllo                  | Atteso                                                                                                                               | Se diverso                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrazioni                 | esattamente `0000`…`0005`                                                                                                            | mancanti: applicarle prima; **in più**: stop, analizzare                                                                                                                      |
| `PRAGMA table_info(tasks)` | 10 colonne: `id, workspace_id, card_id, title, description, due_at, completed_at, priority (default 'none'), created_at, updated_at` | colonne diverse: stop, lo schema non è quello progettato                                                                                                                      |
| `foreign_key_list(tasks)`  | `workspaces(id)` cascade; `cards(id, workspace_id)` cascade                                                                          | stop                                                                                                                                                                          |
| `index_list(tasks)`        | `tasks_workspace_open_due_idx`, `tasks_card_idx`                                                                                     | altri indici: valutare prima del `DROP INDEX`                                                                                                                                 |
| Conteggio `n`              | **0**                                                                                                                                | `n > 0`: verificare che ogni riga rispetti i nuovi CHECK (titolo 1–200, descrizione ≤ 2000) **prima** di applicare; una riga violante interrompe la migrazione (per progetto) |
| Dipendenze da `tasks`      | nessuna                                                                                                                              | stop                                                                                                                                                                          |
| Versione di SQLite         | non interrogabile (`sqlite_version()` vietata)                                                                                       | prova per comportamento: v. sotto                                                                                                                                             |

**Prova di compatibilità sul motore remoto, senza toccare i dati** (due vie, **entrambe fuori da questo incarico**, da approvare): (a) creare un D1 **usa-e-getta** e applicarvi `0000`–`0005` + il SQL di `0006`; (b) esportare il database in un file locale (`d1 export --remote`, **contiene tutti i dati personali**: tenerlo in locale, mai in repo né in report) e provarvi `0006` su una copia locale.
Fino a una di queste prove, la compatibilità è provata **solo sul runtime locale (workerd)**.

Prima di qualunque applicazione remota: backup / Time Travel (`wrangler d1 time-travel info <NOME_DB>` è in sola lettura e mostra il punto di ripristino disponibile).

## 4. Decisioni approvate (2026-11-07) e condizioni

| ID   | Decisione                                | Esito                   | Condizione dell'utente                                       | Stato della condizione                                                                    |
| ---- | ---------------------------------------- | ----------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| D-01 | Riuso della tabella `tasks`              | **Approvata con cond.** | previa verifica di schema e dati                             | schema e dati **locali** verificati; **remoto non verificabile** → **in sospeso**         |
| D-03 | Scadenze come data di calendario         | **Approvata**           | —                                                            | —                                                                                         |
| D-05 | Solo annullamento, nessuna cancellazione | **Approvata**           | —                                                            | —                                                                                         |
| D-06 | Timeline derivata dalle Task             | **Approvata con cond.** | dichiararne i limiti rispetto a un registro storico completo | **soddisfatta**: elenco dei limiti nel [registro](tasks-decision-register.md) e qui sotto |
| D-13 | Migrazione `0006` additiva               | **Approvata con cond.** | subordinata alla verifica su D1                              | locale (workerd) **verificata**; D1 remoto **non verificabile** → **in sospeso**          |
| —    | Estensione Overview                      | **Approvata con cond.** | obbligatoriamente **retrocompatibile**                       | proposta **corretta** (v. §5): nessun campo rimosso o rinominato                          |
| —    | Roadmap T0 → T1 → T2 → T3 → C4 → C5      | **Confermata**          | —                                                            | [roadmap](tasks-roadmap.md)                                                               |

**Limiti dichiarati di D-06** (la Timeline non è un registro d'audit):

1. riaprire una task **fa sparire** la voce «completata» o «annullata» (la Timeline rappresenta lo **stato corrente**, non la sequenza degli eventi);
2. una task completata più volte (completa → riapri → completa) mostra **una sola** voce, con l'ultimo istante;
3. le **modifiche di titolo, scadenza, priorità e collegamento non lasciano traccia** storica;
4. non si registra **chi** né **da quale dispositivo** (workspace a utente singolo);
5. `task_added`/`task_completed` in `activity_events` restano **riservati e non scritti**: nessuna storia pregressa è ricostruibile;
6. un eventuale audit completo richiederebbe una decisione separata (tabella dedicata o nuovi tipi di evento con la guardia di `0005`).

## 5. Incompatibilità emerse

| #   | Incompatibilità                                                                                                                                                  | Esito                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I-1 | **Overview:** la proposta di T0 sostituiva `upcomingTasks[].dueAt` con `dueOn` (**breaking**). Incompatibile con il vincolo approvato                            | **Corretta nei documenti**: `dueAt` resta un intero (primo istante del giorno di scadenza nel fuso del workspace, derivato da `startOfLocalDay`), `dueOn` e due contatori sono **solo additivi**; test di contratto con lo schema attuale come condizione di T1 |
| I-2 | **Semantica di «scaduta»** cambia da «istante < ora» a «giorno < oggi»                                                                                           | forma del contratto invariata; nessun dato reale impattato (tabella senza scritture); dichiarato nei [contratti §5](tasks-api-contracts.md)                                                                                                                     |
| I-3 | **Versione di SQLite di D1 non interrogabile** (`sqlite_version()` vietata): il piano di T0 («verificare la versione») non è eseguibile così                     | sostituita da una prova **per comportamento** (§3.3)                                                                                                                                                                                                            |
| I-4 | **Nessun D1 remoto nell'account accessibile**, `database_id` segnaposto nel repo: il prerequisito P3 («conteggio remoto di `tasks`») non è soddisfacibile da qui | comandi da eseguire a mano (§3.3); approvazione definitiva di D-01/D-13 sospesa                                                                                                                                                                                 |
| I-5 | `main` non protetta: C3 è entrata con push diretto e CI rossa                                                                                                    | proposta di ruleset (§2), da approvare                                                                                                                                                                                                                          |

Nessuna incompatibilità emersa con D-03, D-05, D-06 né con lo schema locale (`0001`) o con il SQL additivo provato su workerd.

## 6. Condizioni rimanenti per M3-T1

| #   | Condizione                                                                                                                                                                | Stato                                                            | Chi      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------- |
| C-1 | CI verde del fix                                                                                                                                                          | ✅ sulla PR #8                                                   | —        |
| C-2 | **Integrare la PR #8** e verificare la run di `main` verde (chiusura formale di C3)                                                                                       | ⏳ in attesa                                                     | utente   |
| C-3 | **Verifica D1 remoto** con i comandi di §3.3 (migrazioni `0000`–`0005`, schema `tasks`, conteggio, nessuna dipendenza) **oppure** conferma che non esiste alcun D1 remoto | ⏳ in attesa (sospende l'approvazione definitiva di D-01 e D-13) | utente   |
| C-4 | Prova di compatibilità di `0006` sul motore **remoto** (D1 usa-e-getta o copia locale di un export)                                                                       | ⏳ da approvare; richiesta solo se esiste un D1 remoto con dati  | utente   |
| C-5 | Decisione sul **ruleset di `main`** (§2)                                                                                                                                  | ⏳ in attesa                                                     | utente   |
| C-6 | Conferma delle decisioni **non** indicate come bloccanti (D-02, D-04, D-07…D-12, D-14) o richiesta di modifiche                                                           | ⏳ in attesa                                                     | utente   |
| C-7 | Autorizzazione a pubblicare i **documenti** (PR di sola documentazione) — oggi solo in locale                                                                             | ⏳ in attesa                                                     | utente   |
| C-8 | In T1, **primo passo** prima di `0006`: rieseguire in repo la prova su workerd (già fatta fuori repo) e il **test di contratto Overview** contro lo schema di `5a0d056`   | per T1                                                           | sviluppo |

**Raccomandazione.** **Pronta con riserva.** I punti C-2 e C-3 (e di conseguenza l'approvazione definitiva di D-01/D-13) vanno chiusi **prima di scrivere la migrazione `0006`**.
I commit di T1 che non dipendono dal database (dominio puro e schemi Zod) non hanno dipendenze aperte, ma non sono stati avviati: questo incarico non implementa T1.
