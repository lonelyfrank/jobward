# ADR-0017 — Jobward v1 locale: base unica, candidature come fonte dello stato

**Stato:** Accettato · **Data:** 2026-11-21 · **Decisore:** proprietario del prodotto («lavoriamo in locale, possiamo essere brutali, la pubblicazione si vedrà dopo») · **Supera:** il percorso conservativo di migrazione di ADR-0016 (SW.10-d backfill, SW.11 dual-write) e, per la ricerca, ADR-0011.

## Contesto

Jobward non ha utenti né ambienti remoti: l'unico dato reale sono due candidature del proprietario nel D1 locale. Il ramo Smart Workspace aveva progettato una migrazione prudente (ricostruzioni guardate, backfill con politica congelata, doppia scrittura, switch delle letture) pensata per dati reali in produzione. Il costo — 12 migrazioni, ~9.000 righe di strumenti di audit, test di upgrade da 8 minuti, staging protetto mai usato — rallentava lo sviluppo del prodotto.

## Decisione

1. **Solo locale.** Nessuno staging, deploy o D1 remoto nel ciclo di sviluppo corrente. Gli strumenti di staging (`scripts/staging.mjs`, modello di configurazione, controlli di configurazione Cloudflare) e i test di upgrade delle migrazioni sono rimossi; restano recuperabili dalla storia git (`c007e53`).
2. **Base di migrazione unica** `0000_jobward_v1.sql`, generata dallo schema e completata a mano con i soli trigger d'integrità essenziali (tenancy degli eventi, campi personalizzati per bacheca, coerenza candidatura↔opportunità) e la vista `current_applications`. Le migrazioni `0000`–`0011` storiche sono eliminate.
3. **Opportunity 1:N Application, fonte unica.** Fase, esito e data d'invio vivono SOLO in `applications`. La candidatura corrente è quella con sequenza più alta. Le API continuano a esporre `stage`/`outcome`/`appliedOn` sulla scheda come valori **derivati in sola lettura**, più `applicationId` e `applicationCount`.
4. **Una sola via di scrittura dello stato:** la pipeline (`POST /cards/:id/pipeline`) — il primo avanzamento crea la candidatura n. 1 con snapshot — e `POST /cards/:id/applications` per una ricandidatura dopo una chiusura. `PATCH /cards/:id` non accetta più fase/esito/data (A-02).
5. **Nessun backfill né doppia scrittura:** i dati demo si caricano con `pnpm db:seed:demo`.
6. **Ricerca:** sottostringa con `instr`, nessun `LIKE` (già in codice da M4.0.1): questa ADR registra formalmente il superamento di ADR-0011 per la parte sulla ricerca.

## Conseguenze

- Positive: schema leggibile in un solo file; `pnpm check` in ~2 minuti invece di ~10; nessun codice per stati intermedi.
- Negative: un database locale creato con le vecchie migrazioni non è aggiornabile: va ricreato (`pnpm db:reset:local -- --yes && pnpm db:seed:demo`). Il D1 originale del proprietario resta intatto nel suo worktree, con copia di backup.
- Prima di una futura pubblicazione con dati reali servirà di nuovo una strategia di migrazione incrementale (le migrazioni successive alla `0000` saranno additive e verificate).
