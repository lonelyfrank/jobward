# M3.UI.1 — Workspace Navigation, Contextual Actions & Global Search

Obiettivo: recuperare lo spazio della navbar e rendere ricerca e azioni accessibili nel contesto delle cinque viste. [Audit e matrice delle azioni](audit.md).

## Implementazione

`Topbar` e il vecchio `PageHeader` sono eliminati. `WorkspacePageHeader` contiene titolo, descrizione, navigazione gerarchica eventuale, Search e dropdown `WorkspaceActionsMenu` tipizzato. Search precede Actions; il menu non viene renderizzato quando non ci sono azioni. A 320 px i comandi possono passare alla riga successiva per lasciare leggibile il titolo. Nessun cambiamento alla tipografia globale.

Overview, galleria e dettaglio bacheche, Opportunità, Attività e Insights condividono l’header. Anche Impostazioni, 404 e stati di caricamento/errore bacheca mantengono l’accesso mobile. Il menu account conserva iniziale, email e scelta del tema in fondo alla sidebar. Il breadcrumb generico è rimosso; resta il ritorno «Tutte le bacheche».

Gli header delle pagine scorrono nel main. **Eccezione UX del Kanban:** viene preservato il contenitore fullBleed preesistente, con header come fratello dell’area colonne scrollabile, senza `fixed` o `sticky`. Questo conserva le regioni di scroll delle colonne e i bersagli del trascinamento, evita di far scomparire i controlli mentre si lavora su una colonna e mantiene il comportamento precedente. Nessun offset da 64/86 px, nessuna nuova toolbar dell’App Shell.

Creazione, gestione bacheche/colonne, archivio, configurazione campi e preferiti usano moduli, mutazioni e permessi esistenti. La creazione globale accetta la bacheca corrente come preselezione e non chiama il dettaglio con un ID vuoto. Le azioni locali delle schede/colonne e i sensori/algoritmi drag-and-drop sono preservati. L’aggiunta colonna è nel menu, eliminando la duplicazione in coda al Kanban. Ricerca locale, filtri, ordinamento e configurazione colonne restano visibili.

## Ricerca e architettura

`GlobalSearchDialog` è caricato su richiesta. `WorkspaceControlsProvider` coordina apertura, scorciatoie e creazione con stato React; la digitazione non risale nell’App Shell. Il dialog condiviso Radix offre una variante `search`, usando superficie/overlay traslucidi con i token esistenti e blur leggero.

`GET /api/v1/search?workspaceId=…&q=…` aggrega tre proiezioni. Non duplica la schermata Opportunità: riusa `searchOpportunities` con modalità globale interna e `listBoards`; la sola nuova query di entità riguarda i colloqui, altrimenti accessibili soltanto una scheda per volta. Tutte le letture richiedono il workspace autorizzato dal middleware; ogni JOIN porta anche `workspace_id`. Nessun nuovo modello o migrazione. Il contratto condiviso Zod valida richiesta e risposta sui due lati.

| Categoria               | Campi cercati                                                                               | Apertura                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Opportunità/candidature | Titolo, posizione, azienda, descrizione, sede, fonte, nome bacheca, fase tecnica e italiana | Modale scheda nella bacheca originale; include archiviate segnalate |
| Bacheche                | Nome e descrizione                                                                          | Bacheca originale                                                   |
| Colloqui reali M2.5     | Azienda, posizione/titolo scheda, titolo/tipo colloquio, data UTC ISO o gg/mm/aaaa          | Modale scheda, scheda Colloqui                                      |
| Attività                | Non implementate; escluse                                                                   | Nessun modello o controllo fittizio                                 |

Semantica prevedibile: sottostringhe letterali, AND fra parole e ricerca case-insensitive per ASCII e diacritici latini comuni (inclusa forma decomposta NFD). Nessun fuzzy matching. La ricerca locale M2 conserva la semantica precedente. Massimo 100 caratteri, 6 parole e 10 risultati per categoria; ordinamento opportunità/colloqui per aggiornamento e ID, bacheche nell’ordine esistente. Le proiezioni non includono note riservate dei colloqui.

La normalizzazione SQL viene materializzata in una CTE prima dei predicati testuali: ogni parola confronta il documento già normalizzato. Questo evita il limite D1 di profondità delle espressioni (100), verificato con query a sei parole su opportunità e colloqui, e non ripete la normalizzazione per ogni parola. Anche le etichette italiane dei tipi di colloquio visibili nei moduli sono ricercabili.

Debounce 250 ms; TanStack Query con chiavi del workspace sotto il prefisso Opportunità, invalidate dalle mutazioni esistenti di schede, bacheche e colloqui. Cache 30 secondi, AbortSignal, nessun placeholder di risultati vecchi: durante una nuova query non è possibile aprire una voce precedente. La chiusura smonta il consumer e annulla richieste/debounce. Nessuna chiamata per query vuote. Stati iniziale, loading, vuoto ed errore con Riprova annunciati.

La lista bacheche viene filtrata sul server entro il tetto esistente di 100; nel browser arrivano soltanto le proiezioni limitate. Le opportunità restano cercate nel DB. Non si scaricano tutte le schede nel browser. Si conservano i limiti di SQLite LIKE: con dataset grandi la normalizzazione richiede scansione del workspace; un indice FTS è una valutazione futura, non una migrazione anticipata.

## Accessibilità

Ctrl+K/Cmd+K, Esc, frecce con selezione circolare, Invio; combobox/listbox e categorie nominate. Il focus iniziale va all’input, resta nel dialog e ritorna al controllo precedente se ancora presente. Il click sull’overlay chiude la ricerca. Durante altri dialog/editor modali la scorciatoia evita un secondo overlay, preservando la guardia delle modifiche non salvate. Nessun’altra scorciatoia viene intercettata.

Target Search/Actions da 44 px, nomi accessibili e focus del design system. Dropdown Radix ancorato con collision detection e scroll entro lo spazio disponibile. Il tooltip Search è sotto il controllo e non intercetta i clic, evitando di coprire Actions al ripristino del focus. Temi chiaro/scuro condivisi con l’account.

## Jello

La base confermata non contiene un adapter Glass stabile. La superficie transitoria usa `bg-surface/95`, `bg-background/55`, bordo, ombra e blur del design system nella variante `search` del Dialog. Il punto di integrazione futuro è quel ramo di superficie/overlay: un adapter Glass Subtle potrà sostituirne il materiale senza toccare contenuti, ricerca, focus o API. Nessun runtime, dipendenza o modifica diretta a Jello introdotto.

## Validazione e screenshot

Risultati finali e confronti: [report dei test](testing-report.md) e [galleria prima/dopo](screenshots.md).

Branch: `m3-ui1-workspace-actions-search`, da `f78107c`. File principali: AppShell, Sidebar/UserMenu, WorkspacePageHeader, WorkspaceActionsMenu, WorkspaceControlsProvider, GlobalSearchDialog, Dialog/Tooltip, le route interessate, GlobalCreateCardDialog, gestione creazione colonne e test; servizio/rotta aggregata e contratto Zod. Elenco completo dei [file della consegna](files.md).

La consegna è raccolta in un commit locale sul branch dedicato. Nessun merge, push o deploy. I risultati di test non eseguiti non sono dichiarati superati. Nessun cambiamento ad autenticazione, migrazioni, workflow, gestione colloqui o permessi.
