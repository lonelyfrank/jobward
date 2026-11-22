# Motore di query v2 (M5-SW.3)

> **Avviso (PID-01, 2026-11-22):** il motore è **integrato** in `jobward-v1` (non più solo nel ramo `feat/m5-sw1-smart-kanban`). Il modello e i compromessi descritti sotto restano validi; i rimandi a SW.6/SW.7 e alla numerazione delle migrazioni sono storici ([ADR-0017](decisions/0017-local-v1-baseline.md)). Codice: `packages/shared/src/smart-query.ts`, `apps/api/src/services/query-sql.ts`.

**Stato:** implementato e committato in locale nel worktree `jobward-smart-workspace` (branch `feat/m5-sw1-smart-kanban`); non integrato, nessun push · **Decisioni:** D1 approvata come modello target per il piano SW.6/SW.7 (nessuna colonna né migrazione ora), D2 approvata in via temporanea (§3) · **Iniziativa:** [Smart Workspace](../roadmap/smart-workspace.md) · **Contesto:** [ADR-0016](decisions/0016-smart-workspace-domain.md)

Una definizione tipizzata e serializzabile dei filtri (`SmartQuery`), valutata con la stessa semantica in memoria (Kanban) e su SQL (Tabella). Questo documento descrive il modello, il **compromesso sulla normalizzazione dei testi** (§3), la strategia definitiva (§4–§5, da realizzare in SW.6/SW.7) e il vincolo sui filtri avanzati finché la UI non li espone (§6).

## 1. Modello

- `packages/shared/src/smart-query.ts`: tipi, campi e operatori (insiemi chiusi), normalizzazione canonica, validazione stretta, valutatore in memoria, comparatore di ordinamento, limiti.
- `apps/api/src/services/query-sql.ts`: compilatore SQL. Colonne in whitelist, ogni valore è un parametro legato, ogni foglia è a due valori (mai NULL).
- `packages/schemas/src/smart-query.ts`: schema Zod dell'API (`where`, JSON in un parametro, al massimo 4096 caratteri).
- Il formato `v:1` di SW.1 resta quello degli indirizzi del Kanban; `smartFilterToQuery` lo converte e `compileSmartFilter` delega al motore v2. I parametri storici della Tabella sono tradotti da `legacyFiltersToQuery`.

Regole di valutazione (campi mancanti, valori sconosciuti, date, gruppi): intestazione di `smart-query.ts`. Limiti: profondità 4, 30 condizioni, 64 parametri legati, 3 ordinamenti.

### 1.1 Opportunità senza bacheca (M5-SW.10-a)

`board_id` e `column_id` possono essere NULL ([database.md](database.md), ADR-0016). Semantica, identica nei due valutatori:

- **Ordinamento** per `board` e `column`: il nome assente è un valore _mancante_ e va **sempre in fondo, in entrambe le direzioni**, come ogni altro campo mancante. Il compilatore SQL lo ottiene perché la Tabella usa `LEFT JOIN` su bacheche e colonne (con un `JOIN` interno le opportunità senza bacheca sparirebbero in silenzio); il valutatore in memoria perché `boardName`/`columnName` nulli sono mancanti.
- **Filtri per bacheca e colonna** (`boardId`, `columnId`, parametri della Tabella): sono per identificatore e **escludono** le opportunità senza bacheca. Non esiste un operatore «senza bacheca» finché non c'è la vista Inbox (SW.13): il Query Engine non espone `board`/`column` come campi filtrabili.
- Tutti gli altri campi, gli operatori e i gruppi non cambiano. Le opportunità senza bacheca partecipano a filtri, ricerca testuale, paginazione e totale come le altre.
- Provato da `apps/api/test/placement.test.ts`: il suo ordine SQL coincide con `compareByQuerySort` in memoria per `board` e `column`, ascendente e discendente.

## 2. Parità tra i due valutatori

La parità è provata su D1/workerd con 450 query casuali in tre fusi orari (Roma, New York, Lord Howe), sulle 13 chiavi di ordinamento in entrambe le direzioni, sui parametri storici e sui casi di testo speciali (`apps/api/test/query-parity.test.ts`). Una mutazione deliberata (omettere il NULL in `not_in`) fa fallire i test.

## 3. Normalizzazione dei testi: comportamento SW.1 e SW.3

> **Non è equivalenza Unicode completa.** È un compromesso tecnico locale e temporaneo, accettato per chiudere SW.3. Non descriverlo, nell'interfaccia o nella documentazione per l'utente, come «ricerca senza distinzione di accenti e maiuscole» in generale.

### 3.1 Cosa facevano i due confronti

|           | SW.1 `normalizeText` (Kanban)                                         | SW.3 `foldKey` (Kanban e Tabella)                                                                              |
| --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Accenti   | scomposizione Unicode NFD e rimozione di **tutti** i segni combinanti | tabella **fissa** di 50 lettere latine accentate (25 minuscole, 25 maiuscole) e 7 segni combinanti (57 coppie) |
| Maiuscole | `toLowerCase()` Unicode completo                                      | solo **ASCII** (`A–Z`), come `lower()` di SQLite senza ICU                                                     |
| Spazi     | ogni sequenza di spazi bianchi (`\s+`) diventa uno spazio             | solo U+0020, in 5 passate (sequenze fino a 32 spazi diventano uno)                                             |
| Dove vive | solo in memoria                                                       | identica in JavaScript e in SQL (`FOLD_PAIRS`, `foldKey`, `foldKeySql`)                                        |

La scelta SW.3 è obbligata dalla parità: SQLite su D1 non ha ICU, quindi non può eseguire NFD né `lower()` Unicode. La ricerca globale (`foldText`/`foldSql`) usava già la stessa tabella e `lower()` ASCII lato SQL: Kanban e Tabella ora sono allineati a essa.

### 3.2 Classi di caratteri che cambiano

Misura: enumerazione di tutti i 150.164 punti di codice che sono lettere, segni, cifre o spazi; **16.681 (11,1 %)** hanno un risultato diverso tra `normalizeText` e `foldKey` se presi singolarmente. Il conteggio per punto di codice sovrastima l'effetto pratico (vedi §3.3). Il test `smart-filter-compat.test.ts` fissa un campione per ogni classe.

| Classe                                               | Punti di codice | Esempi                                                    | Effetto rispetto a SW.1                                                                                                                      |
| ---------------------------------------------------- | --------------: | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 1. Lettere latine accentate fuori tabella            |             449 | Š Ž Č Ć Ń Ś Ź Ż Ą Ę Ě Ř Ů Ő Ű Ğ Ş Ă Ș Ț Ý Ÿ (e minuscole) | «Škoda» non coincide più con «skoda»                                                                                                         |
| 2. Lettere latine senza scomposizione                |             230 | Æ Ø Þ Đ Ł Œ Ð                                             | cambia solo la maiuscola: «Łódź» ≠ «łódź»; le minuscole (æ ø þ đ ł œ ð) sono identiche nei due confronti. Né SW.1 né SW.3 riducono «ł» a «l» |
| 3a. Greco e cirillico accentati                      |             293 | ά Ά й Й ё Ё                                               | «й» non coincide più con «и»                                                                                                                 |
| 3b. Maiuscole di greco, cirillico, armeno, georgiano |             325 | Α Β Γ Д О М Ա Բ                                           | «ΑΛΦΑ» ≠ «αλφα»                                                                                                                              |
| 4. Altre maiuscole non ASCII                         |             501 | cherokee, copto, ecc.                                     | come 3b                                                                                                                                      |
| 5. Segni combinanti fuori tabella                    |           2.536 | U+0304 macron, U+0306, U+030C…                            | non vengono più eliminati                                                                                                                    |
| 5b. Sillabe Hangul                                   |          11.172 | 한                                                        | niente equivalenza canonica NFD (sillaba ↔ jamo)                                                                                             |
| 5c. Altri alfabeti con scomposizione canonica        |           1.151 | arabo, alfabeti indiani, giapponese                       | come 5b                                                                                                                                      |
| 6. Spazi diversi da U+0020                           |              24 | tabulazione, U+00A0, U+2003                               | non vengono più ridotti a uno spazio                                                                                                         |

Invariate (verificato): italiano, francese, spagnolo, portoghese e tedesco (`àèéìòù áíóú âêîôû äëïöü çñ ß ã õ å` e maiuscole), insieme all'accento combinante U+0301 sulle lettere della tabella.

Lettere europee d'uso comune **non** allineate (49 su quelle provate): ý ÿ š ž č ć ń ś ź ż ą ę ě ř ů ő ű ğ ş ă ș ț Æ Ø Œ Đ Ł (polacco, ceco, slovacco, rumeno, ungherese, turco, croato, scandinavo parziale).

### 3.3 Impatto reale

- Le classi 5, 5b e 5c contano per punto di codice ma incidono solo se **lo stesso testo** è scritto in due forme canoniche diverse (precomposto e scomposto), situazione rara salvo incolla da macOS o da sorgenti in NFD.
- Le classi 1–4 incidono sui nomi di azienda e di località non italiani. Il pannello del Kanban propone le aziende presenti nei dati (`companyOptions`) e, in questa revisione, le raggruppa con **la stessa chiave del confronto** (`foldKey`): «Škoda» e «SKODA» sono due voci e ciascuna seleziona le proprie schede (con SW.1 erano una sola voce che le univa). Senza questa correzione una voce avrebbe selezionato meno schede di quante ne rappresentasse. Il problema resta per il filtro testuale della località e per l'uso futuro di `contains`/`equals_any` con testo digitato.
- Nessun dato viene perso o modificato: cambia solo se due stringhe risultano uguali nel confronto.

### 3.4 Perché non ampliare la tabella degli accenti

Misurato su D1/workerd, con la forma reale delle query (`cards k LEFT JOIN application_details d`), 30 condizioni di testo bilanciate (piatte oppure annidate su 4 livelli):

| Coppie di sostituzione | Esito                                              |
| ---------------------: | -------------------------------------------------- |
|              57 (oggi) | ok, istruzione di ~41.000 caratteri                |
|         65, 70, 75, 80 | ok                                                 |
|         **85 e oltre** | `Expression tree is too large (maximum depth 100)` |

Il margine è quindi di circa 23 coppie. Per allineare le sole 49 lettere europee non allineate (con le maiuscole) servirebbero più di 49 coppie: si andrebbe oltre il limite. Per la classe 1 ne servirebbero 449. In più, l'istruzione crescerebbe verso il limite di 100.000 caratteri per istruzione. **Non si amplia la tabella.**

Nota di fragilità: la profondità è controllata anche quando SQLite sostituisce un'espressione dentro una sottoquery appiattita. Una sonda con `FROM (SELECT … )` costante ha fallito già a 57 coppie, mentre la forma reale passa. Se SW.8/SW.9 compilassero le query dentro sottoquery o viste SQL, la capacità va rimisurata.

## 4. Strategia definitiva: chiavi di normalizzazione persistite

> **Decisione D1 (approvata per il piano SW.6/SW.7).** Il modello target prevede chiavi di confronto normalizzate e versionate (`company_key`, `location_key`, `role_key`, `text_key_version`), con il testo originale conservato e le chiavi calcolate dal backend con una funzione condivisa e versionata. Il piano deve includere: backfill incrementale, verifica di coerenza, indici dove necessari, corpus Unicode condiviso, gestione delle differenze tra runtime e strategia di aggiornamento della versione (§4.3). **Nessuna colonna e nessuna migrazione vengono introdotte ora**; l'approvazione non autorizza migrazioni (richiedono il piano SW.6 e approvazione separata). Fino ad allora vale il compromesso D2 (§3).

**Idea.** Calcolare la chiave di confronto **nell'applicazione** (dove Unicode è completo) e salvarla in colonne dedicate; SQL confronta colonne semplici. La funzione è una sola, in `packages/shared`, usata da client e server: la parità diventa vera per costruzione e l'equivalenza Unicode diventa completa.

### 4.1 Alternative valutate

| Opzione                                                  | Esito                                                                                     |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| A. Tabella fissa in SQL (stato attuale)                  | Funziona, ma è limitata (§3) e non estensibile oltre ~80 coppie                           |
| B. Colonne generate da SQLite                            | **Non fattibile**: possono usare solo funzioni deterministiche incorporate, senza Unicode |
| C. ICU o funzioni utente in D1                           | **Non fattibile**: non disponibili                                                        |
| D. SQL filtra in modo approssimato e il client rifinisce | **Scartata**: rompe paginazione, totale e parità                                          |
| **E. Chiavi persistite scritte dall'applicazione**       | **Fattibile e raccomandata**                                                              |

### 4.2 Forma proposta

- Colonne nullable in `application_details`: `company_key`, `location_key` e, con D8, `role_key` (stessa chiave deterministica già prevista per il ruolo), più `text_key_version` (intero).
- Funzione `normalizeKey(text, version)` in `packages/shared`: NFD, rimozione di tutti i segni combinanti, minuscole Unicode, spazi bianchi ridotti a uno, rifilatura. La versione identifica la funzione (cambiarla significa riscrivere le chiavi).
- Query: `equals_any` e `contains` confrontano la chiave persistita con l'ago normalizzato dalla stessa funzione. `equals_any` può usare un indice `(workspace_id, company_key)`. `contains` resta una scansione con `instr`, accettabile per migliaia di righe per workspace.
- Il valutatore in memoria usa la stessa funzione su ago e valore, quindi non dipende dalla tabella SQL.

### 4.3 Impatto su D1

- **Schema.** Solo `ALTER TABLE … ADD COLUMN` e `CREATE INDEX`, con il precedente di `0003`. Nessuna ricostruzione di tabella. Spazio trascurabile (testi brevi).
- **Backfill.** D1 non esegue JavaScript nelle migrazioni: va fatto dall'applicazione, a lotti (`batch`), idempotente e riprendibile, con `text_key_version IS NULL` come criterio di «da fare». Ordine: espandi, backfill, doppia scrittura, verifica, passaggio delle query, rimozione della tabella fissa.
- **Scritture.** Le chiavi vanno aggiornate nello stesso `batch` di ogni scrittura di azienda, località e ruolo. Percorsi attuali: `INSERT`/`UPDATE` in `apps/api/src/services/cards.ts` (creazione e dettagli); `pipeline.ts` inserisce solo fase/esito. Un trigger SQL **non** può calcolare la chiave, quindi la coerenza dipende dal codice: serve un controllo di coerenza (come per `current_application_id`, D4) e un test che impedisca scritture dirette.
- **Evoluzione.** Cambiare la funzione incrementa la versione e rilancia il backfill; fino al completamento le query usano la chiave solo per le righe alla versione corrente.
- **Rischio residuo.** Il client (browser) e il server (Workers) possono avere versioni diverse dei dati Unicode: per caratteri introdotti di recente le due chiavi potrebbero divergere. Mitigazione: fissare la versione con test su un insieme di riferimento e, se serve, far restituire al server la chiave nel payload invece di ricalcolarla.
- **Vincoli di processo.** È una migrazione di schema: richiede il piano di SW.6 approvato, esportazione preventiva a carico del proprietario, nessuna migrazione remota senza approvazione separata (ADR-0016, principi di migrazione). **Non in SW.3.**

### 4.4 Proposta di milestone

Integrare la soluzione in **SW.6/SW.7** invece di una milestone isolata: SW.7 introduce comunque `role_key` (D8), con lo stesso meccanismo. Sequenza suggerita: piano di migrazione (SW.6) con le tre colonne, `normalizeKey` condivisa e test di parità su Unicode completo, backfill verificato, passaggio di `query-sql.ts` alle chiavi persistite, rimozione di `FOLD_PAIRS` dal percorso SQL. Fino ad allora vale il compromesso di §3.

## 5. Strategia di normalizzazione condivisa (riepilogo)

1. Una sola funzione in `packages/shared`, versionata.
2. Applicata sull'ago e sul valore in memoria (Kanban) e sull'ago lato server (Tabella).
3. Persistita per i soli campi cercabili (azienda, località, ruolo), mai calcolata in SQL.
4. Test di parità su un corpus che include tutte le classi di §3.2, eseguito sia in memoria sia su D1.
5. La ricerca globale (`q`) va riallineata alla stessa chiave in una milestone successiva, con un'unica semantica di testo.

## 6. Filtri avanzati (`where`) e vincolo sulla UI fino a SW.8

| Livello                                                    | Stato in SW.3                                                                                                                                                   |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API `GET /opportunities`                                   | Accetta `where` (query v2, JSON, validazione stretta, limiti) in AND con i parametri storici                                                                    |
| API `GET /search` (ricerca globale)                        | **Non** accetta `where` (schema `strict`: 400)                                                                                                                  |
| Frontend Tabella (`OpportunitiesView`, `useOpportunities`) | Non invia mai `where`; `toApiQuery` non lo produce                                                                                                              |
| Frontend Kanban                                            | Legge solo i parametri `v:1` (`fase`, `azienda`, …); l'eventuale `where` nell'indirizzo è inerte                                                                |
| Indirizzo                                                  | Un `where` nell'indirizzo non viene letto né interpretato. Il Kanban lo preserva (come ogni parametro estraneo); la Tabella, riscrivendo l'indirizzo, lo scarta |

**Conseguenza:** nessuna vista può applicare un filtro avanzato senza mostrarlo. Non serve alcuna correzione al codice.

**Guardie** (`apps/web/src/features/opportunities/where-not-exposed.test.tsx`, `apps/api/test/query-parity.test.ts`):

- l'elenco Opportunità e la Tabella di una bacheca non inviano `where` neanche con `where` nell'indirizzo, e i filtri storici restano;
- il Kanban con `where` nell'indirizzo mostra tutte le schede, senza barra né contatore;
- nessun sorgente del frontend (fuori dai test) costruisce un parametro `where` né importa lo schema `where`;
- `/search?where=…` risponde 400.

**Per SW.8** (esposizione dei filtri avanzati): ogni condizione applicata deve avere un contrassegno rimovibile e contribuire al contatore dei filtri; «Cancella filtri» deve rimuoverla; l'indirizzo deve portare una versione del formato e gli errori vanno segnalati come in C2; i test sopra vanno aggiornati insieme alla UI, non aggirati.

## 7. Limiti residui di SW.3

- Confronto dei testi limitato come in §3; soluzione definitiva in §4.
- Filtri su ruolo e RAL non inclusi (dipendono da SW.7).
- La ricerca testuale `q` e la retribuzione restano fuori dal modello v2 (semantica diversa).
- Prove su Chromium e workerd locale; nessun D1 remoto (D3 resta condizionata).
- Margine di profondità SQL limitato (§3.4).
