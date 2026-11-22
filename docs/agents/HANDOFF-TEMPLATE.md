# Modello di handoff

Copia il blocco nella sezione «Attività corrente» di [CURRENT-CONTEXT](CURRENT-CONTEXT.md) (sostituendo la precedente) o nel messaggio di consegna. Breve: i dettagli vanno nei report, qui solo i rimandi.

```markdown
## Attività corrente

- **Task:** <ID e nome> — <obiettivo in una frase>
- **Autorizzazioni ricevute:** <es. solo modifiche locali; nessun commit/push>
- **Repository / worktree / branch:** <percorso> · <branch> · base <sha> · HEAD <sha>
- **Stato git:** <pulito | file modificati/non tracciati: elenco breve>
- **Ultimo stato verificato:** <comando → esito reale, data>; <comando → esito>
- **Fatto:** <punti, con rimandi a file>
- **In corso / non finito:** <punti>
- **Decisioni aperte (del proprietario):** <D-x: domanda → opzioni>
- **Blocchi:** <cosa e perché>
- **Prossimo passo consigliato:** <uno solo, concreto>
- **Evidenze:** <report, log, link CI>
- **Da NON fare:** <azioni vietate o non autorizzate rilevanti>
```

Regole: niente cronologia (la storia sta in git e nei report); niente copie di contenuti permanenti; risultati di test con numeri reali; se qualcosa non è stato verificato, scriverlo.
