# Contesto corrente (L3 — memoria di lavoro)

Solo lo stato **attuale**; nessun diario. Si sostituisce a ogni handoff con il [modello](HANDOFF-TEMPLATE.md). Stato del progetto: [CURRENT-STATE](../status/CURRENT-STATE.md).

## Attività corrente

- **Task:** lancio completato il 2026-11-22 ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)). Vista Mappa D-07 implementata il 2026-11-23 ([ADR-0019](../architecture/decisions/0019-opportunity-map.md), migrazione `0003` applicata al D1 locale); in corso le ottimizzazioni dell'interfaccia.
- **Repository / worktree / branch:** `/home/frank/jobward-core-docs` · `main` → `origin/main`. `jobward-v1` è l'archivio locale con la storia: **mai pusharlo**.
- **Git:** commit e push solo con autorizzazione esplicita per ciascuna azione; email dell'autore: noreply di GitHub.
- **Dati:** il D1 locale contiene **dati reali** del proprietario (identità dev). Dimostrazioni: profilo **Dati demo** (`frank@demo.jobward.local`, sedi a Milano). Copie di sicurezza: `apps/api/.wrangler/backups/`.
- **Da NON fare:** azzerare il D1 di questo worktree o toccare quello in `/home/frank/jobward/apps/api/.wrangler/state`; ricreare cartelle `docs/m*/`; pushare `jobward-v1` o usare `git push --all`; aggiungere provider esterni oltre allo stradario OSM facoltativo, usare geocoding o dedurre coordinate dal testo (ADR-0019); introdurre funzioni AI/recruiter (scope policy).

## Avvio rapido per chi riprende

```bash
cd /home/frank/jobward-core-docs
pnpm dev                # http://localhost:5174 (API :8787)
pnpm db:seed:demo       # con l'API avviata: rigenera solo i dati demo
pnpm docs:screenshots   # con pnpm dev: schermate della guida dai dati demo
```
