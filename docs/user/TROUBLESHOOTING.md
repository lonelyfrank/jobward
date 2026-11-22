# Problemi comuni e domande

**Stato:** canonico · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01: comportamenti letti nel codice e negli script, non riprodotti). Comandi completi: [COMMANDS](../development/COMMANDS.md).

## Problemi

| Sintomo                                                         | Causa probabile                                                                                                           | Che cosa fare                                                                                                                                                 |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` si ferma subito citando la porta 5174                | La porta del frontend è fissa (`strictPort`) ed è occupata, spesso da un'altra copia di `pnpm dev`                        | Chiudi l'altro processo. Per cambiare porta vanno allineate la porta di Vite e `APP_ORIGIN` del Worker ([GETTING-STARTED](../development/GETTING-STARTED.md)) |
| «Non riusciamo a caricare i tuoi dati» con **Riprova**          | L'API (Worker su `:8787`) non risponde: avviata solo con `pnpm dev:web`, oppure si è fermata                              | Avvia `pnpm dev` (oppure `pnpm dev:api` in un secondo terminale), poi **Riprova**                                                                             |
| «Accesso non autorizzato»                                       | L'API non è in modalità locale: identità di sviluppo accettata solo con `ENVIRONMENT=development` su `localhost`/loopback | Avvia con `pnpm dev` (usa `--env dev`) e apri <http://localhost:5174>                                                                                         |
| `pnpm db:reset:local` non fa nulla e chiede conferma            | Lo script si rifiuta senza `--yes`                                                                                        | `pnpm db:reset:local -- --yes` (cancella **tutto** lo stato locale di questa copia)                                                                           |
| `pnpm db:seed:demo` fallisce con «API non raggiungibile»        | Lo script usa l'API locale                                                                                                | Avvia prima `pnpm dev`, oppure usa Impostazioni → Dati demo → Rigenera dati demo                                                                              |
| Errori dopo un aggiornamento del codice, su un database vecchio | Il database era stato creato con le migrazioni precedenti alla v1                                                         | Ricrea il database: `pnpm db:reset:local -- --yes` ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md))                                          |
| Tema, zoom o colonne della tabella diversi su un altro browser  | Sono preferenze salvate per dispositivo nel browser                                                                       | Reimpostale su quel browser                                                                                                                                   |

## Domande frequenti

**Dove sono i miei dati?** Nel database locale `apps/api/.wrangler/state` della copia del progetto da cui avvii l'app. Non vengono inviati a nessun servizio.

**Come faccio un backup?** Con **Impostazioni → Esporta tutti i dati (JSON)**. Non esiste ancora un'importazione, quindi il file serve come copia di sicurezza leggibile, non come ripristino automatico; aziende e viste salvate non sono incluse.

**Spostare una scheda cambia lo stato della candidatura?** Solo nella bacheca **Pipeline**, e sempre con conferma. Nelle bacheche personali no.

**Posso candidarmi due volte alla stessa offerta?** Sì, dopo che la candidatura precedente si è chiusa: **Nuova candidatura** ne crea una nuova e conserva lo storico.

**Posso eliminare un'attività?** No: si annulla. Resta visibile nella vista Annullate.

**Jobward usa l'intelligenza artificiale?** No. I suggerimenti seguono regole dichiarate e non modificano nulla da soli ([CORE §4.6](../product/CORE.md#46-intelligent-organization)).

**Esiste una versione online o multiutente?** No, e non è nel ciclo corrente ([CURRENT-STATE](../status/CURRENT-STATE.md)).
