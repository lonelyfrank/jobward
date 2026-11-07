# Attività e follow-up — Specifica funzionale

**Stato:** proposta per approvazione, nessuna implementazione · **Baseline:** `5a0d056eda`.
Indice: [tasks-index.md](tasks-index.md) · Decisioni: [tasks-decision-register.md](tasks-decision-register.md).

## 1. Scopo

La sezione **Attività** risponde a tre domande, senza richiedere una candidatura:

1. **Cosa devo fare?** → titolo.
2. **Entro quando?** → scadenza (un giorno, non un orario).
3. **A quale candidatura?** → collegamento facoltativo.

Non è un sistema di promemoria: **non invia nulla, non notifica, non pianifica da sola**. Mostra e ordina ciò che l'utente ha deciso di fare.

## 2. Il modello in una pagina

Un'unica entità **Task**. Il suo stato è **persistente e minimo** (tre valori); il suo «orario» è **derivato** (cinque condizioni).

| Campo                    | Obbligo                | Scopo e regola                                                                          | Perché esiste                           |
| ------------------------ | ---------------------- | --------------------------------------------------------------------------------------- | --------------------------------------- |
| `id`                     | sì                     | UUID generato dal **client** all'apertura del modulo (idempotenza, come note/documenti) | retry sicuri                            |
| `workspaceId`            | sì                     | isolamento; mai dal body                                                                | tenancy                                 |
| `cardId`                 | no                     | candidatura collegata; vuoto = attività del workspace                                   | requisito B4                            |
| `title`                  | sì                     | 1–200 caratteri dopo il trim                                                            | l'azione                                |
| `description`            | no                     | fino a 2.000 caratteri                                                                  | dettagli (es. indirizzo da contattare)  |
| `kind`                   | sì (default `general`) | `general` · `follow_up` · `preparation`                                                 | ricerca, icona, regole dei suggerimenti |
| `priority`               | sì (default `none`)    | stesso vocabolario delle card (`none/low/medium/high/urgent`)                           | tie-break operativo; già nello schema   |
| `dueOn`                  | no                     | **data di calendario** `YYYY-MM-DD` nel fuso del workspace                              | scadenza deterministica                 |
| `completedAt`            | derivato dallo stato   | istante di completamento (server)                                                       | storico, «completata in ritardo»        |
| `cancelledAt`            | derivato dallo stato   | istante di annullamento (server)                                                        | distingue «non serve più» da «fatto»    |
| `createdAt`, `updatedAt` | sì                     | timestamp server; `updatedAt` è anche il token di concorrenza                           | audit, compare-and-swap                 |

**Campi valutati e non adottati** (motivazioni in [D-02/D-03/D-04](tasks-decision-register.md)):

| Campo candidato                                                                | Esito        | Motivo                                                                                                                               |
| ------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `status` come colonna                                                          | **derivato** | si ricava da `completedAt`/`cancelledAt` (un solo posto di verità; un CHECK impedisce stati contraddittori)                          |
| orario di scadenza (`dueAt`)                                                   | **no**       | nessun consumatore: senza promemoria un'ora non cambia alcuna decisione e porta fuso/DST. Colonna legacy `due_at` resta inutilizzata |
| tipo `other` distinto da `general`                                             | **no**       | sinonimi                                                                                                                             |
| `interviewId` (task ↔ colloquio)                                               | **rinviato** | rende esatto «preparazione già pianificata», ma aggiunge una FK e regole di annullamento; v. [D-11](tasks-decision-register.md)      |
| promemoria, ricorrenza, tag, assegnatario, `completionNote`, posizione manuale | **no**       | funzioni di un altro prodotto; nessuna richiesta                                                                                     |

## 3. Stato persistente e condizione temporale

### 3.1 Stato (persistente)

| Stato       | Come si rappresenta                 | Transizioni consentite                        |
| ----------- | ----------------------------------- | --------------------------------------------- |
| `open`      | `completedAt` e `cancelledAt` nulli | → `done` (completa) · → `cancelled` (annulla) |
| `done`      | `completedAt` valorizzato           | → `open` (riapri)                             |
| `cancelled` | `cancelledAt` valorizzato           | → `open` (riapri)                             |

`done` ↔ `cancelled` **non** è diretto: si riapre e si decide di nuovo. Un vincolo di database impedisce che entrambi i timestamp siano valorizzati.

### 3.2 Condizione temporale (derivata, mai salvata)

Calcolata da una **funzione pura** con `oggi` (data locale del workspace) passato come argomento. Vale solo per le `open`.

| Condizione | Regola (confronto fra date di calendario) | Testo in interfaccia                   |
| ---------- | ----------------------------------------- | -------------------------------------- |
| `overdue`  | `dueOn < oggi`                            | «Scaduta da N giorni» / «Scaduta ieri» |
| `today`    | `dueOn = oggi`                            | «Oggi»                                 |
| `soon`     | `oggi < dueOn ≤ oggi + 3 giorni`          | «Domani» / «Tra N giorni»              |
| `later`    | `dueOn > oggi + 3 giorni`                 | data estesa («12 nov»)                 |
| `none`     | `dueOn` assente                           | «Senza scadenza»                       |

**Una task in ritardo non cambia stato.** Resta `open`. Per le `done` si deriva soltanto «completata in ritardo» (data locale di `completedAt` > `dueOn`), usata per l'etichetta nello storico.
La soglia di 3 giorni è una costante dichiarata del dominio, non una preferenza.

## 4. Scadenze: regole precise

| Caso                                   | Regola                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| «Oggi»                                 | La data locale **nel fuso del workspace** dell'istante corrente. Non il fuso del browser: due dispositivi nello stesso workspace concordano.     |
| Mezzanotte                             | Il passaggio da `oggi` a `oggi+1` avviene a 00:00:00.000 locali; una task con `dueOn = ieri` diventa `overdue` a quell'istante.                  |
| Fuso, DST                              | La data di scadenza è un giorno di calendario: **non si sposta** se cambia l'offset. Si calcola solo `oggi`, con `Intl` e il fuso IANA.          |
| Cambio del fuso del workspace (futuro) | `dueOn` non viene riscritto; cambia soltanto il significato di `oggi`. Oggi il fuso non è modificabile.                                          |
| Completamento dopo la scadenza         | Consentito, senza avvisi bloccanti. Lo storico mostra «Completata in ritardo».                                                                   |
| Modifica della scadenza                | Libera, anche verso il passato (registrare un'attività già scaduta è legittimo). Nessun evento dedicato (v. [D-06](tasks-decision-register.md)). |
| Ordinamento a pari scadenza            | priorità decrescente → `createdAt` crescente → `id` crescente (totale e deterministico).                                                         |
| Task senza data                        | Dopo tutte quelle con data. Mai «scadute».                                                                                                       |
| Data non valida (30 febbraio, ecc.)    | Rifiutata in validazione (400) e dal database (CHECK).                                                                                           |

## 5. Rapporto con le candidature

- Una candidatura può avere **molte** attività; ogni attività ha **al più una** candidatura.
- Creazione dalla Panoramica (con la card già collegata) e dalla pagina Attività (collegamento scelto con una ricerca nel workspace).
- Dalla riga si **naviga alla candidatura** (riepilogo della card nella risposta → link alla rotta corretta); nella candidatura compare la sezione «Attività».
- **Completare non cambia la pipeline.** Nessun automatismo fra task e stato della candidatura, in nessuna direzione.

| Evento sulla candidatura                                    | Effetto sulle sue attività                                                                                                                                                                       |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Archiviata**                                              | Le attività restano **invariate nei dati**, diventano **sola lettura** (409 in scrittura, come note/colloqui) e **sono escluse da elenco operativo e contatori**.                                |
| **Ripristinata**                                            | Riappaiono tali e quali (nessun dato è stato toccato): comportamento reversibile, perché l'esclusione è derivata.                                                                                |
| **Chiusa** (rifiutata, ritirata, assunto, nessuna risposta) | Restano valide e modificabili (es. «ringraziare per il colloquio»). La conferma di chiusura **informa** che esistono N attività aperte, con un link; non le annulla.                             |
| **Riaperta**                                                | Nessun effetto.                                                                                                                                                                                  |
| **Eliminata**                                               | Le card non si eliminano da API. Se una cancellazione definitiva esisterà (o per cancellazione del workspace) le task **cadono con la card** (`ON DELETE CASCADE`): nessun riferimento pendente. |

Perché `CASCADE` e non `SET NULL`: azzerare `card_id` trasformerebbe in silenzio un'attività di candidatura in un'attività di workspace; inoltre, con una FK
composita, `SET NULL` azzererebbe anche `workspace_id` (stesso motivo per cui ADR-0007 usa trigger per `activity_events`).

Una task può essere **ricollegata** a un'altra candidatura o **scollegata** (modifica), purché la destinazione sia nello stesso workspace e non archiviata.

## 6. Follow-up

Un **follow-up è una Task con `kind = follow_up`**, non un'entità separata ([D-01](tasks-decision-register.md)). Eredita tutto: scadenza, completamento, annullamento, elenco, storico.

| Esigenza                            | Come si soddisfa                                                                                         |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Registrare un follow-up pianificato | crea una task `kind=follow_up` con `cardId` e `dueOn`                                                    |
| Collegarlo a una candidatura        | `cardId`                                                                                                 |
| Vederlo nella lista generale        | compare come ogni task, con icona e etichetta «Follow-up» (testo, non solo colore)                       |
| Completarlo / annullarlo            | stesse azioni di ogni task                                                                               |
| Storico pertinente                  | sezione «Attività» della candidatura (aperte, poi completate/annullate) + voci nella Timeline della card |

Non si invia alcuna e-mail o messaggio; non si integra alcun servizio esterno. «Segnato come completato» significa solo che **l'utente ha dichiarato** di averlo fatto.

## 7. Eventi e Timeline (sintesi; dettagli in [architettura §6](tasks-architecture.md))

- **Cronologia della candidatura:** le attività **con card** compaiono nella Timeline come **voci derivate dalla riga** (creata, completata, annullata), esattamente come le note: nessuna duplicazione in `activity_events`.
- **Attività generale (workspace):** non esiste un registro eventi del workspace nell'interfaccia; per le attività di workspace il registro è la riga stessa (`createdAt`, `completedAt`, `cancelledAt`).
- Nessun nuovo tipo di evento: **`activity_events` non viene ricostruita una terza volta.**
- Limite dichiarato: riaprendo una task, la voce «completata» sparisce dalla Timeline (rappresenta lo stato corrente, non un registro di audit). Se in futuro servisse un audit, è una decisione separata (M4).

## 8. Suggerimenti contestuali

Calcolati da dati reali, **mai** creano nulla da soli. Distinti rigorosamente: **(1) suggerimento → (2) creazione della task (azione esplicita dell'utente) → (3) eventuale modifica della candidatura (azione separata, mai conseguenza)**.

| Regola                           | Quando compare                                                                                                                                     | Precompila                                                                    | Scompare quando                                                                       |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| **S1** Follow-up dopo l'invio    | stato `applied` o `screening`, nessuna task `follow_up` per la card in **alcuno** stato                                                            | titolo «Follow-up: {azienda}», scadenza = max(data di invio + 7 giorni, oggi) | esiste una `follow_up` (anche annullata: è una decisione), o è ignorato               |
| **S2** Preparazione al colloquio | colloquio **programmato** entro 7 giorni (data nel fuso del workspace) e nessuna task `preparation` creata **dopo** la creazione di quel colloquio | titolo «Prepara il colloquio: round N», scadenza = giorno prima (o oggi)      | esiste la `preparation` così definita, il colloquio passa o è annullato, o è ignorato |
| **S3** Dopo il colloquio         | ultimo colloquio **completato** da ≤ 7 giorni e nessuna `follow_up` creata dopo il suo completamento                                               | titolo «Ringrazia / follow-up: round N», scadenza = oggi + 2                  | esiste la `follow_up` così definita, o è ignorato                                     |

- Presentazione: una riga **discreta** nella Panoramica («Vuoi pianificare un follow-up? **Pianifica** · Non ora»), mai un modale, mai sulle card Kanban, al massimo **una** per volta (priorità S3 > S2 > S1).
- «Non ora» è **ignorabile**; la memoria dell'ignorato è **per dispositivo** (v. [D-09](tasks-decision-register.md)): limite dichiarato, nessuna tabella nuova.
- **Registrare il feedback** di un colloquio resta l'azione rapida già esistente (`add_feedback`): non è una task.
- Nessuna notifica push, e-mail o scheduler.

## 9. Pagina Attività

Header «Attività» con riepilogo (Da fare · Oggi · In ritardo — conteggi reali, mai dimostrativi), pulsante **Nuova attività**, filtri.
Specifica visiva e comportamento: [tasks-ux-spec.md](tasks-ux-spec.md).

**Filtri (vista):** Tutte · Da fare · Completate · In ritardo · Senza scadenza · **Annullate** (aggiunta giustificata: senza di essa un'annullata sarebbe invisibile e non riaprirebbe).
«Tutte» = da fare + completate (non le annullate).

**Ordinamento predefinito** (aperte): scadute → oggi → prossime → senza scadenza. Si ottiene con **un solo criterio** (`dueOn` crescente, assenti per ultime) perché «scaduta < oggi < futura»: non dipende da «oggi» e si pagina a cursore.
Completate: `completedAt` decrescente. Annullate: `cancelledAt` decrescente. Tie-break: priorità, `createdAt`, `id`.

**Stati vuoti** (testi contestuali, nessun dato simulato):

| Situazione                      | Messaggio                                                                                     | Azione offerta |
| ------------------------------- | --------------------------------------------------------------------------------------------- | -------------- |
| Nessuna attività in assoluto    | «Nessuna attività, per ora»                                                                   | Nuova attività |
| «Da fare» vuoto, altre esistono | «Non hai attività da fare. Ottimo lavoro!» solo se esistono completate; altrimenti come sopra | Nuova attività |
| «In ritardo» vuoto              | «Nessuna attività in ritardo»                                                                 | —              |
| «Oggi» (riepilogo) a zero       | «Niente in scadenza oggi» come testo del riepilogo                                            | —              |
| Filtro senza risultati          | «Nessun risultato con i filtri attuali»                                                       | Mostra tutte   |
| Errore di caricamento           | messaggio + «Riprova»                                                                         | Riprova        |

## 10. Limiti per workspace

| Limite                         | Valore      | Perché                                                                                                |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| Attività **aperte**            | 500         | protegge la pagina operativa; supera di molto l'uso reale                                             |
| Attività totali (ogni stato)   | 5.000       | tetto di spazio, dato che non esiste cancellazione definitiva (v. [D-05](tasks-decision-register.md)) |
| Lunghezza titolo / descrizione | 200 / 2.000 | coerente con i limiti di note e card                                                                  |

Applicati **atomicamente** nello stesso `INSERT … SELECT` della creazione (e nella riapertura per il tetto delle aperte), come per note e documenti.

## 11. Attività manuali e scadenze dei colloqui ([D-11](tasks-decision-register.md))

I colloqui hanno **data e ora** e vivono nel loro modulo; non sono task. **Non** si creano task automatiche per i colloqui e **non** si mostrano colloqui nella lista Attività in questa serie. La «Prossima azione» derivata dai colloqui resta com'è. Una vista unificata («Agenda») è una possibile evoluzione separata, non necessaria per rispondere alle tre domande.

## 12. Fuori perimetro (esplicito)

Notifiche, e-mail, calendari, scheduler, ricorrenze, promemoria, AI, integrazioni (Gmail, Outlook, LinkedIn), assegnazioni multiutente, cancellazione definitiva, modifica in blocco, sincronizzazione del «suggerimento ignorato» fra dispositivi.
