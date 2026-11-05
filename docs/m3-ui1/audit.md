# M3.UI.1 — Audit iniziale

Data: 5 novembre 2026. Base: `f78107c`, identica a `m3-application-workflow` e al relativo riferimento remoto locale. Branch iniziale `m3-ui-glass-surface`; branch di lavoro `m3-ui1-workspace-actions-search`. Nessun fetch, merge, reset, push o deploy.

All’avvio erano presenti modifiche non committate Glass in Surface, EmptyState, KanbanColumn, risultati, Overview, viste future, CSS, package.json e relativi test/documenti. Salvata una patch preventiva in `/tmp/jobward-m3-ui1-initial.patch` e l’elenco degli untracked in `/tmp/jobward-m3-ui1-initial-untracked.txt`. Durante la sessione un’operazione esterna ha rimosso queste modifiche; l’utente ha confermato di usare la versione attuale. L’implementazione UI.1 non ripristina Glass. Gli screenshot finali «before» vengono ricavati dalla base M3 pulita in una copia temporanea.

## Componenti e dipendenze

- `AppShell`: sidebar indipendente, drawer Radix su mobile, Topbar permanente da 64/86 px, main scrollabile; Kanban fullBleed con scroll confinato. Router annidato per Kanban/Tabella e modale scheda. Navigazione SPA e guardia delle modifiche non salvate.
- `PageHeader`: titolo/descrizione/azioni, già usato dalle viste principali, eccetto dettaglio bacheca. Non sticky.
- `Topbar`: hamburger mobile, breadcrumb ridondante, form di ricerca, nuova scheda, iniziale/account e tema. Nessun logout implementato.
- Dialog e Sheet: Radix, focus trap, Esc, overlay e ripristino focus. Dropdown condiviso Radix non modale con collision detection e altezza disponibile. Button/Input hanno token semantici e focus globale. Tema unico condiviso tra account e impostazioni.
- `GlobalCreateCardDialog`: selezione bacheca/colonna, titolo e mutazione esistente; dettaglio scheda aperto tramite sotto-rotta. Colonne gestite da `ColumnDialog`; trascinamento in `KanbanBoard` e mutazioni ottimistiche.
- Attività e Insights: placeholder onesti, nessuna azione di dominio attiva. Colloqui M2.5 reali; M3-C1 contiene solo dominio puro, non UI/API pipeline C2–C5.

## Matrice delle azioni

| Funzione                                        | Componente/posizione iniziale             | Destinazione                                               | Disponibilità e dipendenze                                            | Mobile                                         |
| ----------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------- |
| Navigazione principale                          | Sidebar; hamburger Topbar                 | Sidebar invariata, hamburger nell’header                   | Reale; router, Sheet                                                  | Stesso drawer, stesso ritorno focus            |
| Ricerca globale                                 | Form Topbar → Opportunità                 | Search nell’header → dialog dedicato                       | Reale sulle opportunità; estensione aggregata per bacheche e colloqui | Pulsante 44 px, dialog adattivo                |
| Nuova scheda                                    | Topbar → GlobalCreateCardDialog           | Menu Overview/Opportunità; bacheche quando ci sono colonne | Reale; boards/detail, createCard, cache Query                         | Stesso modulo, bacheca corrente preselezionata |
| Le mie bacheche                                 | Pulsante header Overview                  | Menu Overview                                              | Reale; navigazione SPA                                                | Voce del dropdown                              |
| Nuova bacheca                                   | Pulsante header galleria; CTA stato vuoto | Menu galleria; CTA primo utilizzo preservata               | Reale; BoardDialog/template                                           | Dropdown e modulo esistenti                    |
| Aggiungi colonna                                | Coda orizzontale Kanban                   | Menu dettaglio bacheca                                     | Reale; ColumnDialog e limite server                                   | Non richiede scroll orizzontale per trovarla   |
| Archiviate e conteggio                          | Pulsante header bacheca                   | Menu bacheca                                               | Reale; ArchivedDialog                                                 | Voce con conteggio, pannello esistente         |
| Preferita                                       | Stella titolo bacheca; card galleria      | Menu dettaglio; card galleria preservata                   | Reale; updateBoard                                                    | Nome esplicito aggiungi/rimuovi                |
| Modifica/elimina bacheca                        | Dropdown bacheca/galleria                 | Menu dettaglio; card galleria preservata                   | Reali; conferma distruttiva esistente                                 | Stessi moduli/conferme                         |
| Campi personalizzati                            | Dropdown bacheca                          | Menu dettaglio                                             | Reale; configuratore lazy                                             | Dialog esistente                               |
| Kanban/Tabella, densità                         | Header bacheca                            | Visibili sotto titolo                                      | Reali; router, preferenza locale                                      | Controlli a capo                               |
| Ricerca locale, filtri, ordine, colonne tabella | Opportunità/Tabella                       | Sempre visibili nella pagina                               | Reali; URL, Query, preferenze locali                                  | Elenco compatto e filtri esistenti             |
| Azioni scheda/colonna                           | Menu locali e quick-create                | Posizione originale                                        | Reali; nessuna modifica al drag-and-drop                              | Alternative accessibili preservate             |
| Account e tema                                  | Iniziale in Topbar                        | Fondo sidebar, vicino a Impostazioni                       | Email e tema reali; nessun logout disponibile                         | Utilizzabile nel drawer e sidebar compressa    |
| Attività/Insights                               | Viste informative                         | Solo Search                                                | Funzioni non implementate; nessun menu vuoto                          | Nessuna azione fittizia                        |

## Ricerca iniziale

`GET /opportunities` è già cross-board e paginato (massimo 50). `boardId` lo limita alla bacheca solo nella Tabella. Semantica: AND tra parole, OR tra titolo, posizione, azienda, descrizione, sede e fonte; sottostringhe letterali con `%`, `_` e backslash escapati. SQLite LIKE gestisce maiuscole ASCII, non diacritici; mancano nome bacheca e fase nel testo libero. `GET /boards` restituisce al massimo le 100 bacheche consentite dal servizio. I colloqui si leggono solo sotto `/cards/:id/interviews`: usarlo globalmente richiederebbe richieste per ogni scheda.

Decisione: mantenere il comportamento locale esistente e introdurre un endpoint aggregato con proiezioni e limite di 10 per categoria, riutilizzando servizi Opportunità/Bacheche e aggiungendo soltanto una lettura SQL limitata per colloqui. Middleware di autorizzazione esistente; nessuna modifica a modelli, permessi, autenticazione o migrazioni.

## Baseline eseguita

- Typecheck e lint: superati.
- `pnpm check`: fermo su formattazione preesistente di `docs/m3/c1-issue-register.md`. La consegna include soltanto la correzione Prettier di quel documento.
- Test: 597 shared, 43 schemas, 306 API, 120 web superati. I 120 web includevano i test Glass iniziali poi rimossi esternamente; i conteggi finali non sono direttamente confrontabili.
- Primo tentativo test Workers bloccato da sandbox (`listen EPERM`), rieseguito con accesso alle porte locali e superato.
- Catture iniziali: 60 screenshot. Per il confronto sulla base confermata, rigenerazione dalla copia temporanea di M3, senza mutare il checkout di lavoro.
