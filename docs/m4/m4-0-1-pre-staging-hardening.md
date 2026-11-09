# M4.0.1 — Pre-Staging Hardening

Data: 2026-11-09. **Stato: CODE READY — CLOUD INVENTORY PENDING.** Gate locali completati; nessun provisioning autorizzato da questo documento. I check richiesti sulla HEAD della PR restano obbligatori prima del merge.

## Baseline e scope

`git fetch origin main` eseguito; base `4280165c4d9fea5555e2cc1442482c091d121d67`, PR #12 già integrata. La ricerca GitHub delle PR aperte ha restituito zero risultati all'avvio. Non è stata considerata integrata alcuna PR aperta. Branch `fix/m4-0-1-pre-staging-hardening`, worktree isolato `/tmp/jobward-m401-hardening`; checkout UI e modifiche non committate preservati. [Audit M4.0](m4-0-private-staging-readiness-audit.md) letto integralmente.

Scope: fix ricerca, template staging e guardie operative, regressioni e documentazione. Nessuna migrazione aggiunta/modificata, dipendenza esterna nuova, feature M4 o signup. Le prove usano D1/workerd del plugin Cloudflare con le migrazioni reali; nessun DB esistente o stato dev è stato aggiornato. Nessun deploy, creazione Cloudflare, modifica secret o migrazione remota.

## Ricerca: prima e dopo

Prima del fix la nuova suite di confine, dopo la correzione delle fixture, ha registrato **8 fallimenti e 5 successi su 13 test**: richieste API valide restituivano 500 per termini lunghi/multibyte o escaping esteso; D1 confermava il limite LIKE. Log locale `/tmp/jobward-m401-search-before-final.log`. La suite è stata eseguita sul codice della base Git; i tre servizi sono stati poi ripristinati al fix. I primi tentativi delle nuove fixture avevano email duplicate/maiuscole e un parametro sort errato: non sono usati come evidenza del difetto.

Soluzione: `containsSql(text, parameter)` genera `instr(lower(text), lower(parameter)) > 0`. I termini sono binding SQL, senza `%` aggiunti né escaping da pattern. Sostituiti tutti i LIKE di ricerca nei servizi Opportunità e globale/colloqui. Restano invariati schema/limite di 100 unità UTF-16 come nel contratto Zod esistente (non 100 byte o grafemi), AND fra parole, OR fra campi, workspace, filtri, ordinamenti, conteggi e paginazione. La ricerca board continua a usare il suo filtro JavaScript già esistente. Query assente/vuota in Opportunità significa nessun filtro testuale; nella ricerca globale resta 400. Dopo fix: **38/38 test mirati verdi**, inclusi i 13 nuovi, con D1 reale locale del runtime Cloudflare.

| Alternativa                    | Valutazione                                                                                                                                        |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `instr` con `lower` SQL        | Scelta: cambio circoscritto delle sole condizioni testuali; nessuno schema, pattern o indice nuovo                                                 |
| LIKE diviso in chunk <=50 byte | Più complesso: servirebbero verifica della contiguità/offset, escaping e caratteri UTF-8; AND dei chunk introdurrebbe falsi positivi               |
| FTS5                           | Futuro: tokenizer, prefissi/parole, ranking e manutenzione indice cambierebbero la semantica di sottostringa; richiede design e benchmark separati |

Semantica conservata: SQLite `LIKE` e `lower()` standard ignorano il case **ASCII**, non fanno case-fold Unicode generale. Opportunità non diventa accent-insensitive: `CÀFFÈ` e `càffè` restano diversi; `CAFFE` non trova `CÀFFÈ`. La ricerca globale continua a usare `foldText`/`foldSql` preesistenti per accenti latini comuni/NFD, con le loro limitazioni Unicode; non si introduce NFC/NFKC o una nuova collation. `%`, `_` e backslash erano già caratteri letterali grazie a ESCAPE; ora restano letterali senza espansione del pattern. Apostrofi restano parametri, mai SQL. I test confrontano vecchio e nuovo predicato su D1 per input corti, Unicode, wildcard e apostrofi. [Funzioni SQLite](https://www.sqlite.org/lang_corefunc.html), [semantica LIKE](https://www.sqlite.org/lang_expr.html), [limiti D1](https://developers.cloudflare.com/d1/platform/limits/).

Differenza marginale: `instr` ricerca il valore letterale anche in presenza di NUL, mentre LIKE usa terminazione da pattern; nessun taglio viene introdotto dal nuovo codice. Non sono state aggiunte regole che tronchino query valide. Le query sono ancora scan di sottostringhe: nessuna promessa di accelerazione o di CPU Free basata sul solo test locale. Le misure di utilizzo remoto restano nel gate Cloudflare.

## Configurazione staging

`apps/api/wrangler.staging.example.json` è un template **non selezionato automaticamente** da Wrangler. Account e UUID D1 sono stringhe vuote: nessun identificatore remoto inventato. Il default production e gli env locali rimangono invariati, con le identità persistenti ADR-0014.

- Nome Worker esplicito in `env.staging`: `jobward-staging`; root `jobward-staging-unconfigured` non è un target operativo.
- Binding applicativo resta `DB`; il nome risorsa dedicata è `jobward-staging-db`, da associare soltanto all'UUID realmente creato e inventariato. Nessun binding D1 al root da ereditare, nessun preview DB/remote development binding.
- `ENVIRONMENT=production`, `AUTH_MODE=access`; solo queste due vars, niente owner, credenziali, origine dev o fallback production.
- Nessuna route, `workers_dev:false`, `preview_urls:false`: il wrapper consente solo bootstrap di un **nuovo** Worker senza ingressi. Non gestisce la pubblicazione successiva del Custom Domain.
- Asset, entry e directory migrazioni vengono risolti da Wrangler e confrontati con i percorsi del checkout. Nessun service binding, trigger o configurazione arbitraria ammesso.

`pnpm build:staging` compila web e Worker con un binding chiaramente **locale** `local-staging-bundle`, senza account e credenziali. `pnpm build`/`pnpm check` includono anche questo dry-run. È una prova di bundle/routing, non una configurazione promuovibile: il validatore remoto rifiuta sempre quel valore, gli ID vuoti e gli UUID segnaposto.

Le copie operative si chiamano `apps/api/.env.staging.wrangler.json`, `apps/api/.env.staging.auth.json` e file `.env.staging.*` per inventario/approvazione. `.gitignore` già li esclude; lint/formattazione ora escludono anche questi file privati, mentre template e test restano nei gate. Le guardie li validano esplicitamente e richiedono permessi privati (nessun bit gruppo/altri) e percorso gitignored nel checkout.

## Guardie operative

Comandi supportati: `pnpm staging:check`, `staging:preflight`, `staging:deploy`, `staging:migrate`. **Gli ultimi tre non sono stati eseguiti su Cloudflare in M4.0.1**; i controlli di rete sono testati con transport sintetico che accetta esclusivamente GET.

1. Niente default: config, inventario e auth devono essere passati esplicitamente; nessun flag Wrangler libero, env production, nome o binding sovrascrivibile dalla CLI.
2. Parsing JSON e allowlist della configurazione; risoluzione con `unstable_readConfig` della versione Wrangler fissata; verifica del target effettivo e dei percorsi, oltre al nome ambiente.
3. Account ID e UUID validi, esattamente uguali a quelli inventariati; UUID diversi da ogni DB protetto/legacy/production elencato. Inventario con revisione esplicita e non più vecchio di 24 ore.
4. Tre valori auth soltanto, owner unico normalizzato, issuer e AUD allineati al manifest. Nessuna stampa di email o valori auth; file privato serializzato in una copia temporanea pulita.
5. Credenziale dedicata in `JOBWARD_STAGING_API_TOKEN`, fingerprint uguale a quello staging approvato e diverso dalle credenziali production note; nessun fallback al login Wrangler, profilo, API key o token ereditato nel processo figlio.
6. Prima di qualsiasi mutazione: GET account autenticato, GET D1 per UUID e verifica nome/UUID, lettura esistenza Worker e binding DB se presente, app Access hostname/AUD, policy singola email esatta e issuer del team. Risposte inattese, permessi mancanti, errore rete o redirect falliscono chiusi. [D1 API](https://developers.cloudflare.com/api/resources/d1/subresources/database/methods/get/).
7. Deploy solo se il nuovo nome Worker risultava assente nell'inventario e risulta ancora assente. Nessun aggiornamento/sovrascrittura di un Worker già esistente è ammesso dal wrapper di questa milestone.
8. Deploy/migrazione richiedono file di approvazione con operazione, SHA Git, hash dei byte di config/inventario/auth e scadenza entro 24 h; working tree pulito e committato. Approvazione dei test o della PR non equivale ad autorizzazione Cloudflare.
9. Config e auth vengono congelati in una directory temporanea senza `.env`/`.dev.vars` adiacenti; percorsi assoluti del checkout. Processo Wrangler senza shell, argv fisso, env ripulito; binding amministrativo passato come nome D1 dedicato, con config ed env espliciti. Cleanup del solo temporaneo posseduto dal comando.

`staging:check` esegue controlli locali e non attesta un inventario live. `staging:preflight` è esclusivamente read-only ma richiede credenziali e inventario reali; non è stato usato in questo incarico. `staging:migrate` ammette solo le migrazioni versionate del nuovo staging, mai `execute`, import, reset, cancellazione o restore arbitrari. La creazione del DB resta una futura operazione separata sottoposta al gate dell'audit; lo script non crea risorse.

### Limiti dei controlli automatici

Le guardie proteggono i comandi supportati, non possono impedire a un operatore di aggirarle usando direttamente Wrangler/API/dashboard. Il default versionato resta inerte, ma le credenziali e le procedure devono rispettare il gate. Usare token dedicati con privilegi minimi, non credenziali condivise tra ambienti.

I fingerprint riconoscono solo credenziali production già inventariate: non provano che un token abbia mai o non abbia mai operato in production né che i suoi permessi siano minimi. L'inventario/approvazione è una dichiarazione locale del proprietario, non una firma crittografica o un'autorità esterna. Una lista di DB protetti incompleta non è rilevabile soltanto dai nomi: la revisione dell'account resta obbligatoria. Le letture live risolvono account, UUID e binding, ma non validano piano, costi, residenza dati, tutte le wildcard/path Access, DNS/route e Service Binding entranti da altri Worker, o la revoca di una sessione reale. Queste vie devono essere escluse esplicitamente dall’inventario prima del bootstrap. Non annullano le race con un altro amministratore o modifiche malevole simultanee ai file del checkout.

La protezione Worker All traffic, assenza di ingressi alternativi, TLS, quote e primo smoke restano nel collaudo Cloudflare. Nessuna route può essere aggiunta dal wrapper attuale: per la successiva pubblicazione serve un intervento approvato che estenda la guardia con verifica live della copertura Access sull'intero Worker. I comandi diretti nella sezione G dell'audit restano esempi storici e non sostituiscono queste guardie.

## Preparazione futura, dopo inventario e autorizzazione

Questi esempi **non sono stati eseguiti contro Cloudflare**. Non contengono email o UUID reali. Dalla root:

```bash
umask 077
cp apps/api/wrangler.staging.example.json apps/api/.env.staging.wrangler.json
chmod 600 apps/api/.env.staging.wrangler.json
pnpm build:staging
```

Soltanto dopo il gate e la creazione D1 separata, compilare i due ID effettivi della config. Preparare `apps/api/.env.staging.auth.json` con i tre campi `OWNER_EMAIL`, `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, tutti ottenuti dalle impostazioni private corrette. Non inserire segreti in `vars` e non aggiungere route. Manifest privato `.env.staging.inventory.json`:

```json
{
  "schemaVersion": 1,
  "environment": "staging",
  "accountId": "",
  "workerName": "jobward-staging",
  "databaseName": "jobward-staging-db",
  "databaseId": "",
  "verifiedAt": "",
  "workerExists": false,
  "legacyInventoryReviewed": false,
  "protectedDatabaseIds": [],
  "productionCredentialsReviewed": false,
  "productionCredentialSha256": [],
  "stagingCredentialSha256": "",
  "ownerEmailSha256": "",
  "accessTeamDomain": "",
  "accessAudience": "",
  "accessAppId": "",
  "hostname": ""
}
```

Questo esempio è intenzionalmente incompleto e rifiutato dalle guardie. Inventariare integralmente tutti i target protetti e compilare timestamp UTC e fingerprint SHA-256 senza salvare token nel manifest. L'app self-hosted canonica e l'unica policy email devono già essere attive prima del preflight di bootstrap. Per gli endpoint GET sono necessarie letture account, D1, Workers, Access Apps/Policies/Organization; il token di futura mutazione necessita inoltre delle autorizzazioni specifiche Scripts/D1 sul corretto account. Non ampliare i permessi come workaround di un preflight fallito.

```bash
chmod 600 .env.staging.inventory.json apps/api/.env.staging.auth.json
pnpm staging:check --config apps/api/.env.staging.wrangler.json \
  --inventory .env.staging.inventory.json --auth apps/api/.env.staging.auth.json
```

La credenziale deve essere già disponibile nella shell in `JOBWARD_STAGING_API_TOKEN`, senza stamparla o metterla nella command line. Il comando locale rifiuta credenziali mancanti, mismatch o manifest incompleti. Il futuro `staging:preflight` usa gli stessi argomenti e compie solo GET. Nessuna autenticazione interattiva automatica.

Per una futura mutazione occorre anche `.env.staging.approval.json` privato, con `approvedByOwner:true`, `operation:"deploy"` oppure `"migrate"`, `gitCommit`, `configSha256`, `inventorySha256`, `authSha256`, `expiresAt`. Hash sui byte attuali dei file; qualsiasi modifica invalida l'approvazione. Passarlo con `--approval` soltanto dopo autorizzazione esplicita del proprietario. Nessuna approvazione o credenziale reale viene generata in questa PR.

### Sequenza M4.1 eseguibile dopo approvazione

1. Chiudere l’inventario account/nomi/legacy, permessi e piano/quote; ottenere autorizzazione distinta per creare il nuovo DB e l’app Access owner-only. I comandi di creazione e backup/recupero della sezione G dell’audit rimangono subordinati al gate remoto.
2. Compilare config, auth e inventario privati con le identità realmente restituite; eseguire `staging:check` e il preflight GET-only. Nessuna pubblicazione/route.
3. Approvare separatamente `operation:migrate` per la HEAD e gli hash attuali; applicare 0000–0007 soltanto al nuovo UUID. Verificare schema/integrità e preparare backup prima del bootstrap.
4. Approvare separatamente `operation:deploy`, con `workerExists:false` verificato di nuovo: bootstrap route-less. I comandi sotto richiedono i rispettivi file di approvazione, non una semplice conferma della PR.
5. Inventariare il Worker creato e aggiornare il manifest. Prima di aggiungere un dominio, estendere e collaudare la guardia per Worker Access All traffic e ogni ingresso alternativo. Serve approvazione separata; il wrapper attuale rifiuta questo aggiornamento.
6. Dopo la futura pubblicazione protetta, collaudare owner, anonimo, altra email, URL alternativi, API/CSRF/workspace e smoke sintetico. Un fallimento mantiene il dominio disabilitato. Nessuno stato release-ready automatico.

Esempi futuri, da non eseguire durante M4.0.1:

```bash
pnpm staging:preflight --config apps/api/.env.staging.wrangler.json \
  --inventory .env.staging.inventory.json --auth apps/api/.env.staging.auth.json
pnpm staging:migrate --config apps/api/.env.staging.wrangler.json \
  --inventory .env.staging.inventory.json --auth apps/api/.env.staging.auth.json \
  --approval .env.staging.approval-migrate.json
pnpm staging:deploy --config apps/api/.env.staging.wrangler.json \
  --inventory .env.staging.inventory.json --auth apps/api/.env.staging.auth.json \
  --approval .env.staging.approval-deploy.json
```

Rollback: prima della prima pubblicazione mantenere tutti gli ingressi assenti; dopo una futura pubblicazione rimuovere prima l’ingresso pubblico sotto autorizzazione, mantenendo Access. Ripristino di versione Worker e recupero D1 sono operazioni distinte: una vecchia versione non annulla migrazioni. Il wrapper non esegue rollback/import/delete; backup verificato e piano di recupero dell’audit richiedono approvazione per l’esatto nuovo UUID, senza toccare risorse ADR-0014. Non usare la rimozione di Access come rollback.

## Quality gate e rischi

Risultati locali sul branch dedicato, con dati sintetici e senza credenziali Cloudflare:

| Gate                         | Esito                                                                                                                                                 |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm check`                 | PASS: typecheck, lint, format, contrast, brand/config, 5 test identità, schema drift, upgrade locali, unit/integration e build                        |
| Unit/integration Vitest      | 58 file, **1.304 test verdi**: shared 632, schemas 59, web 172, API 441                                                                               |
| `pnpm test:search:d1`        | **38/38 verdi**, inclusi 13 nuovi test su D1/workerd; fixture con prefissi quasi uguali rilevano anche troncamenti silenziosi                         |
| Guardie staging              | **39/39 verdi**, rete sostituita con transport sintetico GET-only; nessuna chiamata Cloudflare                                                        |
| Migrazioni/upgrade locali    | Schema 0000–0007 e percorsi M1, M2.5 e tasks verdi; 17 artefatti migrazioni identici alla base                                                        |
| Build Worker dry-run         | Default e staging verdi; staging 1.294,46 KiB, gzip 229,90 KiB, 53 asset; binding solo locale nella prova                                             |
| `pnpm test:e2e`              | Corsa finale pulita: **237 passati, 1 skip preesistente**, 30,1 min; zero flaky/retry. Skip visuale condizionato da `WORKSPACE_VISUAL_DIR`, invariato |
| `pnpm test:preview`          | **14/14 verdi**, 49,1 s, dopo E2E e senza esecuzioni browser concorrenti                                                                              |
| Dopo il fix della fixture QA | Typecheck e lint completi ripetuti: PASS; diff whitespace pulito                                                                                      |

Non sono stati aumentati timeout/retry né disabilitati test. Il tempo locale E2E non dimostra il rispetto del budget CI: restano da verificare i due check richiesti sulla HEAD della PR. I log locali sono in `/tmp/jobward-m401-{check,search-no-truncation,guards-final-snapshot,e2e-final,preview-final}.log`; nessun log grezzo con identità viene versionato.

M3S-12, M3S-14 e M3S-15 restano distinti dal fix: nessuna chiusura di advisory, browser/device aggiuntivi o flaky tastiera/zoom implicita nei test di ricerca. Eventuali retry E2E devono essere riportati come tali. Nessuno stato `READY FOR STAGING PROVISIONING` può derivare dai soli test locali.

### Diagnosi QA durante il primo E2E completo

Il primo run ha rilevato un timeout touch Kanban distinto da M3S-15. Trace: POST `/cards/:id/move` già concluso con 200, poi il test esaurisce i 30 s mentre ricarica (GET me a fine budget). Il test ripeteva la navigazione già eseguita da beforeEach. Il retry seriale ricreava anche una board omonima e il locator per nome ne trovava due. Fix limitato alla fixture E2E: conservare l'URL/ID della board creata da beforeAll, navigarci una volta in beforeEach e mantenere la verifica dopo reload con readiness della colonna. Gesture, dati, controlli di persistenza, timeout e retry invariati.

Un tentativo mirato avviato in parallelo usava erroneamente la stessa `.e2e-state` del run completo: quel tentativo è fallito nel provisioning locale del webServer e il run completo è stato interrotto. I risultati dopo l'interferenza sono invalidi come evidenza del prodotto e non vengono attribuiti a M3S-15 o al fix SQL. È coinvolto soltanto lo stato sintetico del worktree; nessun database dev/legacy o remoto. La corsa E2E finale ripetuta in sequenza è verde (237 passati e lo skip visuale preesistente); il risultato iniziale non viene riportato come verde. La preview successiva è verde: 14/14.

## Gate finale

**CODE READY — CLOUD INVENTORY PENDING.** Nessun difetto applicativo bloccante rimasto nei gate eseguiti. Restano aperti inventario reale, collisioni risorse, credenziali/permessi, piano/quote, policy e copertura Access completa, backup/restore e smoke remoti. La pubblicazione protetta richiede inoltre l’estensione approvata della guardia descritta sopra. Non sono stati eseguiti deploy, provisioning, migrazioni remote, modifiche a DB esistenti o secret, né merge. Questo risultato non equivale a `READY FOR STAGING PROVISIONING` o `RELEASE READY`.
