# M3 — refactor frontend controllato

## Ricerca: Back prima del commit del router

Problema dimostrato dal trace del run 42433287150: URL senza `stage`, checkbox Salvata ancora selezionata, chip Fase presente e zero risultati. L'API aveva risposto due risultati alla query senza stage. Un risultato ottimistico può arrivare prima che React committi l'URL aggiornato; tornando subito indietro, l'URL torna uguale a `pending.base` e il confronto per invalidare pending non scatta.

Correzione finale in `OpportunitiesView`: eliminare pending e usare l'URL come unica fonte dei filtri. Le azioni applicano setParams con flushSync, così il cambio di indirizzo e quello delle spunte appartengono allo stesso commit prima di un successivo Back. Il provider DOM di React Router, usato sia nell'entrypoint sia nei test, collega questa opzione a ReactDOM.flushSync; non cambia le altre navigazioni prive dell'opzione. Nessun listener nativo aggiuntivo e nessuna duplicazione ottimistica dei filtri. Restano invariati cronologia push/replace, debounce, OR/AND e contratti. La scelta è supportata dall'implementazione e dalla documentazione distribuite con react-router 8.5.1 (`lib/dom-export/dom-router-provider.js` e `lib/components.js`).

## Ricerca: debounce con stato precedente

Problema aggiuntivo riprodotto dal test unitario: digitare `acme` e scegliere Salvata entro i 300 ms produceva `q=acme` senza `stage=saved`. L'effetto dipendeva solo da input e state.q, ma usava anche gli altri filtri dalla closure.

Correzione: rendere stabile lo stato effettivo con useMemo e includerlo nelle dipendenze dell'effetto. Quando un filtro cambia, il timer precedente viene ripulito e il nuovo mantiene i filtri correnti. Rimossa la soppressione exhaustive-deps. La durata del debounce resta 300 ms. Regression test fallito prima (stage null), passato dopo. La cancellazione tramite AbortSignal e le chiavi Query già proteggevano dalle risposte obsolete: aggiunto test che completa per ultima la vecchia risposta e verifica i risultati nuovi.

## Scope Glass

Problema: `.glass-subtle.board-table-glass` estendeva il materiale alla Tabella, contrariamente al requisito esplicito della stabilizzazione. Rimosso il materiale da quel solo wrapper, mantenendo geometria, padding, angoli e background della board; superficie opaca con il token bg-surface esistente. Eliminati i selettori Table inutilizzati. Nessun token Kanban modificato.

La regressione unitaria della route Tabella fallisce prima (un host Glass), passa dopo (zero host e superficie opaca). La guardia CSS protegge token e fallback e permette soltanto l'override decorativo `::after { display:none }` del Kanban. Non si vietano indiscriminatamente tutti gli pseudo-elementi: sono parte del materiale approvato.

## Navigazione, layout, dialog e prestazioni

UserMenu usa menuitem navigabili: focus gestito da Radix, prima voce Profilo, frecce, Esc e restituzione al trigger. Nessun difetto di componente dimostrato; aggiornato il test. Il ritorno alla galleria è un Link con nome Torna alle bacheche e href /boards: corretto il locator precedente, conservata la verifica della navigazione effettiva.

Nessuna modifica al sistema Dialog, alla sidebar, al DnD o al calcolo dello zoom: le failure di misura richiedono attese del layout stabile, non tolleranze nuove. Il test attende le animazioni finite dopo l'apertura del pannello zoom. Le query del Kanban sono montate con key boardId, quindi la preferenza resta per bacheca.

Listener, ResizeObserver, MutationObserver, requestAnimationFrame e timer nelle aree esaminate hanno cleanup. Nessuna fuga di memoria o costo di rendering misurato tale da giustificare ottimizzazioni ulteriori. Non dichiarata alcuna accelerazione o riduzione del bundle.

## Rischi e reversibilità

I cambi di comportamento sono limitati al ripristino dello stato di ricerca e al vincolo esplicito Glass. Il commit sincrono riguarda soltanto le azioni della ricerca; il caricamento dei risultati resta asincrono. Il debounce riavviato dopo una modifica filtro mantiene una pausa coerente. Nessuna prestazione migliore dichiarata senza misura. Gate dedicati: cronologia browser, URL/refresh, OR/AND, risposta fuori ordine, cancellazione, persistenza zoom e interazioni con mouse/tastiera/touch.
