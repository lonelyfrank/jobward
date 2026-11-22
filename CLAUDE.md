@AGENTS.md

## Note specifiche per Claude Code

- Le regole condivise sono in `AGENTS.md` (importato sopra): non duplicarle qui.
- La memoria automatica di Claude (`~/.claude/projects/.../memory/`) è personale e non versionata: tienici solo preferenze del proprietario e puntatori. La conoscenza del progetto vive in `docs/` ([docs/agents/MEMORY-SYSTEM.md](docs/agents/MEMORY-SYSTEM.md)); se un ricordo contraddice la repository, verifica sul codice e aggiorna il ricordo.
- Per ricerche ampie usa subagenti di sola lettura e conserva solo le conclusioni con riferimenti `file:riga`.
