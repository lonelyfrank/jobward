# Efficienza del contesto

**Stato:** canonico · **Origine:** JW-CORE-01 (2026-11-21). Obiettivo: ridurre i token spesi per orientarsi **senza** perdere correttezza. Non si dichiara alcun risparmio senza misura.

## Regole operative

1. Formula l'obiettivo del task prima di leggere.
2. Leggi L0 ([AGENTS.md](../../AGENTS.md)) e L3 ([CURRENT-CONTEXT](CURRENT-CONTEXT.md)).
3. Usa il [router](CONTEXT-ROUTER.md); apri solo i documenti della tua riga.
4. Cerca prima di leggere: `grep -n` di simboli, ID di roadmap (`### B-03`) o di matrice (`OPP-05`); leggi intervalli di righe, non file interi, quando conosci la sezione.
5. Non rileggere ciò che hai già nel contesto; annota le conclusioni con `file:riga`.
6. Limita l'output dei comandi ai riepiloghi (`grep -E "Tests |FAIL"`), ma **leggi l'errore completo** quando qualcosa fallisce: nessun troncamento che nasconda errori.
7. Salva le evidenze lunghe in file (report, log) e cita il percorso, invece di incollarle in chat.
8. Per esplorazioni ampie usa subagenti in sola lettura che restituiscono conclusioni, non dump di file; verifica a campione le affermazioni importanti.
9. Comunica solo risultati e decisioni rilevanti.
10. Aggiorna CURRENT-CONTEXT prima dell'handoff.

## Misure di riferimento (2026-11-21)

Stime dei token = byte / 4 … byte / 3 (testo italiano con Markdown); **non** sono conteggi di un tokenizer.

| Insieme                                                                                     | Byte     | Token stimati    |
| ------------------------------------------------------------------------------------------- | -------- | ---------------- |
| **L0** `AGENTS.md` + `CLAUDE.md`                                                            | 3.695    | ~920–1.230       |
| **L1** `CONTEXT-ROUTER.md`                                                                  | 5.734    | ~1.430–1.910     |
| **L3** `CURRENT-CONTEXT.md`                                                                 | 2.307    | ~580–770         |
| **Orientamento dopo JW-CORE-01** (L0 + L1 + L3)                                             | 11.736   | ~2.930–3.910     |
| Orientamento tipico **prima** (README + milestones + scope-policy + overview, su `c007e53`) | 45.738   | ~11.400–15.250   |
| Tutta la documentazione Markdown (`docs/`, dopo JW-CORE-01)                                 | ~1,41 MB | ~350.000–470.000 |

Osservazioni:

- L0 rientra nell'obiettivo indicativo di 800–1.200 token solo al limite superiore della stima; L1 lo supera (gran parte sono collegamenti Markdown). Da rivedere dopo un mese d'uso.
- Il confronto «prima/dopo» misura **dimensioni dei file di orientamento**, non token effettivamente consumati: prima non esisteva un percorso di lettura definito, quindi l'insieme «prima» è un'ipotesi ragionevole, non una misura di sessioni reali.

### Aggiornamento PID-01 (2026-11-22)

Stesso stimatore; misure e metodo completi in [PID-01-REPORT §7](../status/PID-01-REPORT.md#7-efficienza-del-contesto).

| Insieme                                                         | Prima (`b34c032`) | Dopo PID-01     |
| --------------------------------------------------------------- | ----------------- | --------------- |
| L0 + L1 + L3 (CURRENT-CONTEXT misurato a HEAD)                  | 12.728 B          | 10.737 B (−16%) |
| L1 `CONTEXT-ROUTER.md` (da tabella a elenco, +3 voci)           | 7.137 B           | 5.146 B (−28%)  |
| Indice della memoria personale di Claude Code (sempre caricato) | 1.030 B           | 632 B           |

Le tabelle Markdown allineate da Prettier possono pesare quasi il doppio del loro contenuto (il router era per il 46% spazi e trattini): per i documenti obbligatori preferire elenchi; per le tabelle lunghe (CHANGE-IMPACT, FEATURE-MATRIX) leggere una riga con `grep`.

## Metriche da raccogliere

| Metrica                                     | Come                                                                                                           | Frequenza        |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ---------------- |
| Dimensione del bootstrap                    | `wc -c AGENTS.md CLAUDE.md docs/agents/CONTEXT-ROUTER.md docs/agents/CURRENT-CONTEXT.md`                       | a ogni modifica  |
| Token per task comparabili                  | Contatore di utilizzo dello strumento (es. `/cost` o telemetria di sessione), stesso tipo di task prima e dopo | campione mensile |
| Documenti letti per task                    | Elenco delle letture nel report di consegna                                                                    | per task         |
| Letture ripetute                            | Stesso file letto più volte nella sessione (dai log dello strumento)                                           | campione         |
| Tempo di ricostruzione del contesto         | Minuti dall'avvio al primo intervento utile                                                                    | campione         |
| Errori da informazioni obsolete             | Difetti o decisioni sbagliate attribuiti a documenti non aggiornati                                            | ogni occorrenza  |
| Completezza degli aggiornamenti documentali | Commit che cambiano codice di un'area senza toccare il suo documento proprietario (revisione PR)               | per PR           |

Registrare i valori in un report datato in `docs/status/` quando ce ne sono abbastanza da confrontare.
