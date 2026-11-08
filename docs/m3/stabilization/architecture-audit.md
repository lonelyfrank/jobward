# M3 — audit architetturale di stabilizzazione

Audit del 2026-11-08. Baseline `fa20c06f8cee5148f39bba685c39dca55b48bd6e`, confermata da `git fetch origin --prune`: HEAD originale e origin/main coincidono. Working tree originale pulito, nessuno stash; altri sei worktree preesistenti lasciati intatti. Intervento isolato in `/tmp/jobward-m3-stabilization-refactor`, branch `fix/m3-stabilization-refactor`. Nessuna incorporazione dei commit delle precedenti attività M3, nessuna operazione remota mutativa.

## Perimetro e metodo

Lettura di route, provider, shell, menu, dialog, ricerca, Kanban, servizi M3, middleware, contratti, migrazioni, script e workflow. Confronto con i quattro run richiesti e riproduzioni locali su D1 temporaneo. I risultati di esecuzione sono distinti dall'ispezione statica in [quality-gate.md](quality-gate.md). Un test superato non equivale a certificazione completa del modulo.

| Area              | Evidenza e valutazione                                                                                                                                                        | Correzione proporzionata                                                                                                                                      |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pacchetti         | shared contiene dominio puro; schemas contratti Zod; database schema/persistenza; API non dipende dal frontend. Il client importa shared e schemas, non servizi server.       | Conservare i confini. Nessuna nuova astrazione.                                                                                                               |
| Shell/navigazione | AppShell coordina titolo, focus, drawer e scorrimento; WorkspacePageHeader centralizza azioni. Listener matchMedia rimosso nel cleanup. UserMenu usa link con ruolo menuitem. | Riallineare il test obsoleto; conservare focus, Esc e ripristino.                                                                                             |
| Materiali         | board-table.tsx applica realmente glass-subtle. Anche la guardia unitaria era stata estesa per ammetterlo. Contraddice il perimetro esplicito di questo incarico.             | Rimuovere solo il materiale della Tabella e i relativi selettori; conservare token, fallback e colonne Kanban. Aggiungere regressione unitaria.               |
| Target touch      | BoardCard estende il link con ::after assoluto inset:0. Il bounding box del testo non rappresenta l'area cliccabile. Due misuratori dei target duplicano la regola.           | Consolidare il controllo nell'helper esistente e misurare anche l'estensione. Verificare separatamente il click reale. Nessuna modifica globale ai pulsanti.  |
| Zoom              | Il pannello usa max-width con transizione di 200 ms; aria-expanded diventa true prima della geometria finale.                                                                 | Sincronizzare le misure con le animazioni finite; mantenere l'uguaglianza esatta e i test DnD/persistenza.                                                    |
| Ricerca           | Chiavi Query includono workspace e parametri; signal passa a fetch. Nella baseline convivono URL, pending e debounce; la failure CI è dopo Back.                              | Eliminata la copia pending: URL unica fonte e commit sincrono supportato dal provider DOM; regressioni di cronologia/concorrenza, semantica OR/AND invariata. |
| Dialog            | Primitive Radix, focus trap, cleanup e conferma modifiche non salvate; i dialog task annidati hanno suite dedicate e preview sotto CSP.                                       | Nessuna riscrittura globale giustificata.                                                                                                                     |
| Backend           | Route sottili, validazione input/output, ownership centralizzata; pipeline usa batch atomici e fingerprint; Tasks riusa riepiloghi in Overview.                               | Conservare i contratti. Note e documenti hanno duplicazioni intenzionali di regole simili, con dati e vincoli diversi.                                        |
| CI                | Quality precede E2E; preview è saltata se E2E fallisce. Artifact solo su failure, retention sette giorni, un retry CI.                                                        | Registrare anche suite non eseguite; nessun timeout aumentato o test disabilitato.                                                                            |

## Complessità e debito

Scansione statica degli import locali: 213 moduli, 940 archi risolti, nessun ciclo rilevato (inclusi import di tipo). Copre import relativi, alias `@/` e ingressi `@jobward/*`; esclude test, librerie esterne e import calcolati. Non equivale a un'analisi esaustiva del grafo runtime delle dipendenze npm.

`card-detail.tsx` (737 righe), `interviews-tab.tsx` (637), servizio Tasks (570), OpportunitiesView (493) e KanbanBoard (402) sono moduli importanti, ma la lunghezza non dimostra da sola un difetto. Conservare la separazione già presente fra API hooks, form, dominio e presentazione. Un'estrazione futura deve partire da un caso riprodotto e proteggere draft, retry e focus.

La bacheca carica l'insieme delle schede entro il limite approvato; la timeline legge le task della singola scheda per derivarne gli eventi. Accettabili per l'uso privato attuale; misurare su dataset realistici prima di virtualizzazione o query più complesse. Nessuna ottimizzazione prestazionale dichiarata senza benchmark.

Dipendenze fra servizi: documents importa la costante di retention da notes, un accoppiamento piccolo e trasparente. Non giustifica da solo un modulo generico CRUD. La revisione delle dipendenze e i rischi residui sono in [code-health.md](code-health.md).

## Decisione

Refactor limitato alle cause dimostrate. Palette, animazioni approvate, background, dati e funzionalità M3 rimangono nel perimetro esistente; l'esclusione Glass della Tabella applica il requisito esplicito dell'incarico. Chiusura subordinata ai gate effettivi e alla CI remota sulla revisione finale.
