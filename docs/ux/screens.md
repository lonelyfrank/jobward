# Schermate

Stato in M0 e comportamento. Le funzioni future sono **dichiarate** (badge "In arrivo · Mx", controlli disabilitati con descrizione accessibile) e non simulate.

| Schermata                   | Contenuto in M0                                                                                                                                                                                                                                                                                         | Dati                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Onboarding**              | Nome del workspace (valida, default "La mia ricerca"), fuso orario (rilevato dal browser), spiegazione di bacheche/colonne/schede. Errori del server annunciati                                                                                                                                         | Reale: `POST /workspaces`                     |
| **Accesso non autorizzato** | Messaggio dedicato per 401/403                                                                                                                                                                                                                                                                          | —                                             |
| **Overview**                | Saluto in base all'ora _nel fuso del workspace_; 5 contatori (opportunità, candidature inviate, colloqui, attività aperte con scadute, bacheche); "Inizia da qui" con i passi (completato / in arrivo); prossime scadenze; bacheche recenti. Skeleton in caricamento, errore recuperabile con "Riprova" | Reale: `GET /overview`                        |
| **Bacheche**                | Stato vuoto M1 + i tre template letti dai dati condivisi con le loro colonne. "Nuova bacheca" disabilitato                                                                                                                                                                                              | Template: dati statici di prodotto (non demo) |
| **Bacheca (Kanban)**        | Segnaposto M1                                                                                                                                                                                                                                                                                           | —                                             |
| **Opportunità**             | Stato vuoto M2 (vista tabella)                                                                                                                                                                                                                                                                          | —                                             |
| **Attività**                | Stato vuoto M3                                                                                                                                                                                                                                                                                          | —                                             |
| **Insights**                | Stato vuoto M4                                                                                                                                                                                                                                                                                          | —                                             |
| **Impostazioni**            | Tema (chiaro/scuro/sistema, persistente), workspace (nome, fuso, ruolo), account (email), elenco "In arrivo"                                                                                                                                                                                            | Reale                                         |
| **404**                     | Dentro la shell, con ritorno all'Overview                                                                                                                                                                                                                                                               | —                                             |

## Stati trasversali

- **Caricamento**: skeleton con `role="status"` e etichetta.
- **Errore**: messaggio comprensibile, nessun dettaglio tecnico, "Riprova" dove ha senso.
- **Vuoto**: spiega cosa comparirà e quando; nessun dato fittizio.

## Per M1

Kanban (colonne dinamiche, drag & drop con alternativa tastiera/menu), pannello di dettaglio (tab Overview/Notes/History), creazione rapida, onboarding con scelta del template. Vedi [milestone](../roadmap/milestones.md).
