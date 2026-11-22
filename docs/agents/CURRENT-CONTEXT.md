# Contesto corrente (L3 — memoria di lavoro)

Solo lo stato **attuale**; nessun diario. Si sostituisce a ogni handoff con il [modello](HANDOFF-TEMPLATE.md). Stato del progetto: [CURRENT-STATE](../status/CURRENT-STATE.md).

## Attività corrente

- **Task:** lancio completato il 2026-11-22 ([ADR-0018](../architecture/decisions/0018-launch-repository-and-docs-archive.md)): `origin/main` riparte dal commit radice, senza ruleset né altri rami. Ora le ottimizzazioni in corso; dopo, posizioni nel Profilo e vista Mappa (D-07, vincoli in [ADR-0016 D7](../architecture/decisions/0016-smart-workspace-domain.md)). Il calcolo delle distanze è pronto in `packages/shared/src/geo.ts`.
- **Repository / worktree / branch:** `/home/frank/jobward-core-docs` · `main` → `origin/main`. `jobward-v1` è l'archivio locale con la storia: **mai pusharlo**.
- **Git:** commit e push solo con autorizzazione esplicita per ciascuna azione; email dell'autore: noreply di GitHub.
- **Dati:** il D1 locale contiene **dati reali** del proprietario (identità dev). Dimostrazioni: profilo **Dati demo** (`frank@demo.jobward.local`, sedi a Milano). Copie di sicurezza: `apps/api/.wrangler/backups/`.
- **Da NON fare:** azzerare il D1 di questo worktree o toccare quello in `/home/frank/jobward/apps/api/.wrangler/state`; ricreare cartelle `docs/m*/`; pushare `jobward-v1` o usare `git push --all`; usare provider esterni di mappe o geocoding (D7); introdurre funzioni AI/recruiter (scope policy).

## Avvio rapido per chi riprende

```bash
cd /home/frank/jobward-core-docs
pnpm dev                # http://localhost:5174 (API :8787)
pnpm db:seed:demo       # con l'API avviata: rigenera solo i dati demo
pnpm docs:screenshots   # con pnpm dev: schermate della guida dai dati demo
```
