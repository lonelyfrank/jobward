# Guida di Jobward

**Stato:** canonico per l'uso dell'applicazione · **Verificato su:** `jobward-v1` `b34c032` (2026-11-22, PID-01: etichette e percorsi controllati nel codice; nessuna schermata catturata) · Per chi sviluppa: [GETTING-STARTED](../development/GETTING-STARTED.md).

Jobward è il tuo spazio personale per la ricerca del lavoro: salvi le opportunità che trovi, decidi se e quando candidarti, segui colloqui, attività e scadenze, e leggi come sta andando il tuo percorso. È uno strumento **per il candidato**: non pubblica annunci, non invia candidature al posto tuo e non usa servizi di intelligenza artificiale. Identità e principi: [CORE](../product/CORE.md).

## Disponibilità

Oggi Jobward è un'**applicazione locale per una sola persona**: gira sul tuo computer, con i dati in un database SQLite locale. Non esiste una versione online né un account da creare ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)). L'interfaccia è solo in italiano e funziona su desktop e telefono (sugli schermi stretti la barra laterale si apre con «Apri il menu di navigazione»).

## Installazione e primo avvio

Requisiti: Node.js ≥ 22.22 e pnpm 12. Dalla cartella del progetto:

```bash
pnpm install
pnpm db:reset:local -- --yes   # solo la prima volta: crea il database locale (cancella quello esistente, dopo una copia)
pnpm dev                       # avvia l'app
```

Apri <http://localhost:5174>. Non serve alcun login: in locale l'identità è fissa (`dev@jobward.local`).

- Al primo avvio vedi «Crea il tuo spazio di lavoro»: scegli un nome (proposto «La mia ricerca») e il fuso orario, poi **Crea workspace**.
- **Per mostrare l'app a qualcuno** apri **Impostazioni → Dati demo** e scegli «Dati demo»: Jobward si ricarica con un'altra persona di esempio, due bacheche, candidature in ogni fase, colloqui nei prossimi giorni e attività. I tuoi dati restano separati e intatti; per tornarci scegli «I miei dati».

## Come è organizzata l'app

La barra laterale («Workspace») contiene, nell'ordine:

| Voce            | A che cosa serve                                                                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Overview**    | Saluto, contatori (opportunità, candidature inviate, colloqui, attività aperte, bacheche), elementi recenti e prossime scadenze; la lista «Inizia da qui» finché non hai bacheche o opportunità |
| **Pipeline**    | Tutte le candidature per stato: Da candidare, Inviate, Primo contatto, Colloqui, Offerta, Chiuse                                                                                                |
| **Bacheche**    | Le tue bacheche Kanban personali                                                                                                                                                                |
| **Opportunità** | Tabella di tutte le opportunità, con le schede Tutte / Inbox / Candidature e le viste salvate                                                                                                   |
| **Aziende**     | Le aziende, ognuna con le sue opportunità e candidature                                                                                                                                         |
| **Attività**    | Cose da fare, follow-up e scadenze                                                                                                                                                              |
| **Calendario**  | Colloqui, scadenze delle attività e degli annunci, mese per mese                                                                                                                                |
| **Insights**    | Funnel, stati, tempi di risposta e andamento delle candidature                                                                                                                                  |

Sotto trovi le «Bacheche recenti» e il menu dell'account con **Profilo**, **Impostazioni** e **Aiuto**. In ogni pagina, in alto: **Cerca in Jobward** (anche con Ctrl/Cmd+K) e il menu **Azioni della vista** (⋯) con **Nuova opportunità**.

## Per continuare

- [Usare Jobward](USER-GUIDE.md): i percorsi principali passo per passo.
- [Problemi comuni e domande](TROUBLESHOOTING.md).

## Limiti attuali

Sono dichiarati qui perché l'app non li simula:

- un solo workspace, non rinominabile né eliminabile dall'interfaccia; nessun logout né cancellazione dell'account;
- nessuna importazione di dati; l'esportazione è in JSON e non include ancora aziende e viste salvate;
- i documenti sono **riferimenti** (titolo, link, nota), non file caricati;
- nessuna notifica, promemoria o sincronizzazione con calendari o email esterni;
- tema, zoom, densità e colonne visibili della tabella sono salvati **per dispositivo**;
- i link della pagina Aiuto puntano a GitHub e richiedono una connessione.

Stato completo delle funzioni, con le evidenze: [FEATURE-MATRIX](../status/FEATURE-MATRIX.md).
