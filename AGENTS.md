# AGENTS.md — bootstrap per agenti (L0)

Regole condivise da tutti gli agenti (Claude, Codex, altri). Fonte unica: [CLAUDE.md](CLAUDE.md) importa questo file senza ripeterlo.

## Il progetto in breve

**Jobward** è uno _Smart Career Workspace_ per chi cerca lavoro: opportunità, candidature, colloqui, attività e decisioni in un unico ambiente collegato. Monorepo pnpm: SPA React (`apps/web`), Worker Cloudflare Hono + D1 (`apps/api`), `packages/{database,schemas,shared}`. Oggi è un'**applicazione locale** a utente singolo (ramo `main` → `origin/main`; `jobward-v1` è l'archivio locale con la storia: mai pusharlo): niente staging, deploy o D1 remoto ([ADR-0017](docs/architecture/decisions/0017-local-v1-baseline.md)). Identità e principi: [docs/product/CORE.md](docs/product/CORE.md).

## Come leggere il contesto

1. Leggi [docs/agents/CURRENT-CONTEXT.md](docs/agents/CURRENT-CONTEXT.md) (stato operativo, poche righe).
2. Apri [docs/agents/CONTEXT-ROUTER.md](docs/agents/CONTEXT-ROUTER.md) e leggi **solo** i documenti indicati per il tuo tipo di attività.
3. Cerca file e simboli (`grep`, ricerca per nome) prima di leggere interi alberi. Non caricare tutta la documentazione.
4. In caso di conflitto prevale il **codice**, poi i documenti canonici; i report storici delle milestone non sono nella repository ([ADR-0018](docs/architecture/decisions/0018-launch-repository-and-docs-archive.md)).

## Regole non negoziabili

- **Perimetro:** implementa solo ciò che è approvato. La [scope policy](docs/roadmap/scope-policy.md) vieta senza nuova decisione: AI/LLM, funzioni per recruiter/aziende, ATS, marketplace. Backlog e roadmap funzionale **non** sono approvazioni. Non ampliare mai una milestone di tua iniziativa.
- **Git:** verifica `git status` e il worktree prima di intervenire; preserva le modifiche non committate; niente `reset --hard`, `clean`, `stash`, checkout distruttivi, eliminazione di branch o worktree. Commit, push, PR, merge e deploy solo con autorizzazione esplicita per **quella** azione.
- **Database:** non toccare il D1 originale del proprietario (`/home/frank/jobward/apps/api/.wrangler/state`). Anche nel worktree di lavoro il D1 locale contiene **dati reali** del proprietario (identità dev): non azzerarlo. I dati dimostrativi sono un profilo separato (Impostazioni → Dati demo, `pnpm db:seed:demo` con l'API avviata); i test usano DB temporanei. Nessuna migrazione strutturale senza piano approvato; nessuna migrazione remota senza approvazione separata.
- **Segreti:** mai leggere, scrivere o copiare credenziali; mai scrivere identificativi di account Cloudflare nei documenti versionati.
- **Onestà:** riporta solo ciò che hai eseguito, con l'esito reale (anche i fallimenti). Non modificare test o codice per farli passare artificialmente. Non dichiarare implementato ciò che è solo documentato.
- **Lavoro di altri:** non toccare i worktree elencati in CURRENT-CONTEXT come protetti; nessuna integrazione automatica tra rami.

## Durante e dopo il lavoro

- Aggiorna nello stesso commit il documento proprietario di ciò che cambi (tabella in [docs/agents/WORKFLOW.md](docs/agents/WORKFLOW.md#aggiornamento-della-documentazione)).
- Prettier controlla anche i Markdown: `pnpm exec prettier --write <file>` sui file toccati.
- Prima di chiudere: aggiorna CURRENT-CONTEXT (solo stato corrente, niente diario) e, se passi il lavoro, usa [docs/agents/HANDOFF-TEMPLATE.md](docs/agents/HANDOFF-TEMPLATE.md).

## Verifiche

`pnpm check` (~2–3 min) · `pnpm test:e2e` (~20 min) · `pnpm test:preview`. Dettagli: [docs/development/COMMANDS.md](docs/development/COMMANDS.md).
