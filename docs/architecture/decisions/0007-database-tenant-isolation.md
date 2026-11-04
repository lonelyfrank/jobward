# ADR-0007 — Isolamento tra workspace garantito dal database

**Stato:** Accettato · **Data:** 2026-11-04 · **Integra:** ADR-0004

## Contesto

ADR-0004 stabiliva `workspace_id` su ogni tabella e la verifica di appartenenza nel service layer. L'audit M0.H ha mostrato che lo schema di `0000_init` usava **FK semplici**: il database accettava qualunque riga che collegasse risorse di workspace diversi (scheda su bacheca altrui, etichetta altrui, ecc.). Con M1 un singolo bug in un servizio avrebbe potuto violare l'isolamento tra utenti, la proprietà più importante del prodotto.

## Decisione

1. **Difesa in profondità**: l'isolamento è garantito **sia** dal service layer **sia** dal database.
2. **FK composite** che includono `workspace_id` (e la bacheca, per la colonna di una scheda) con indici univoci di appoggio `(id, workspace_id)`.
3. **Trigger** dove una FK non basta: riferimenti facoltativi con `SET NULL` (`activity_events`: una FK composita azzererebbe anche `workspace_id`), coerenza scheda↔campo personalizzato e cambio di bacheca.
4. `cards.column_id` → **`NO ACTION`** (non `RESTRICT`): verificata a fine istruzione, così l'eliminazione di bacheca/workspace non dipende dall'ordine delle cascade, mentre una colonna con schede resta non eliminabile da sola.
5. **Migrazioni che ricreano tabelle**: scritte a mano per D1 (niente `PRAGMA foreign_keys`), con una **guardia** `CHECK` che le interrompe prima di qualunque operazione distruttiva se le tabelle non sono vuote. Una migrazione già applicata non viene mai modificata.
6. `pnpm db:check` fallisce se lo schema TypeScript diverge dalle migrazioni committate.

## Alternative scartate

- **Solo service layer**: un errore di programmazione = fuga di dati tra utenti. Inaccettabile per un prodotto che gestisce informazioni sensibili.
- **Trigger ovunque**: più flessibili ma più difficili da leggere, da testare e fuori dal modello drizzle; le FK composite sono dichiarative e verificate dal motore.
- **Modificare `0000_init`**: nessun dato reale esiste, ma riscrivere una migrazione già distribuita (anche solo in locale) crea ambienti incompatibili.
- **Rigenerare con drizzle-kit e applicare così com'è**: usa `PRAGMA foreign_keys=OFF` (non affidabile su D1) e conteneva un errore.

## Conseguenze

- Ogni `INSERT` di M1 deve valorizzare `workspace_id` in modo coerente (errore immediato altrimenti): è un vantaggio, perché i bug emergono nei test.
- I trigger vivono solo nell'SQL di `0001`: una futura ricostruzione di tabelle va scritta a mano e deve ricrearli (un test ne verifica l'esistenza).
- La validazione del **valore** di un campo personalizzato rispetto al suo tipo resta nel service layer (M2).
