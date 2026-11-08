# M3 — registro di stabilizzazione

Data 2026-11-08; supersede lo stato corrente del registro storico M3F senza cancellarne le evidenze.

| ID     | Priorità | Stato                                            | Problema / criterio di uscita                                                                               |
| ------ | -------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| M3S-01 | P2       | Corretto, verificato in locale e CI              | Locator radio ambiguo; light/dark e opzioni conservate.                                                     |
| M3S-02 | P2       | Corretto, verificato in locale e CI              | Test menu account obsoleto; focus e tastiera.                                                               |
| M3S-03 | P2       | Corretto, verificato in locale e CI              | Misuratore touch ignora area estesa della card; test negativo e click reale.                                |
| M3S-04 | P2       | Corretto, verificato in locale e CI              | Table eredita Glass oltre lo scope esplicito; guardie unitarie/browser.                                     |
| M3S-05 | P2       | Corretto, verificato in locale e CI              | Misura toolbar durante transizione; uguaglianza esatta a riposo.                                            |
| M3S-06 | P2       | Corretto, verificato in locale e CI              | Nome precedente del link ritorno.                                                                           |
| M3S-07 | P1       | Corretto, verificato in locale e CI              | Back rapido lascia filtro ottimistico attivo e risultati errati.                                            |
| M3S-08 | P2       | Già risolto nella baseline, contratto verificato | Guardia pseudo-elementi troppo ampia; scope Kanban protetto.                                                |
| M3S-09 | P2       | Già risolto nella baseline, upgrade finale verde | Fixture della prova API ferma a 0005, incompatibile con la timeline Tasks corrente (richiede 0006).         |
| M3S-10 | P1       | Corretto, verificato in locale e CI              | Debounce cancella filtro appena scelto.                                                                     |
| M3S-11 | P1       | Risolto sulla revisione 7ff0ab0                  | PR #9, run 42506245939: quality/E2E/preview completati verdi; ogni nuova HEAD richiede tutti i check verdi. |
| M3S-12 | P2       | Aperto, M4-C3                                    | Due advisory moderate di dipendenze dev transitive; aggiornamento compatibile da pianificare.               |
| M3S-13 | P2       | Aperto, prima di M4-C4                           | Access e D1 remoti non verificati; backup e procedure autorizzate prima di qualsiasi migrazione/deploy.     |
| M3S-14 | P3       | Aperto                                           | Chromium soltanto, niente device fisici/lettore di schermo reale; warning HydrateFallback lazy route.       |

Nessun P0/P1 aperto nel perimetro esaminato sulla revisione remota verificata. Non significa assenza dimostrata di ogni difetto possibile. Stato di chiusura e risultati finali nel [report finale](final-report.md).

**M3S-16 — P2, corretto e verificato in locale e CI:** preview con navigazione e selettore tema obsoleti. Riallineato soltanto il test; suite 14/14 verde, CSP/errori e focus conservati. Nessuna modifica del prodotto successiva al verde check/E2E.

**M3S-15 — P3, aperto/monitoraggio:** flaky tastiera/zoom del run storico 42393464315, ricomparso nel run 42506245939 della PR #9 e passato al retry esistente. Non riprodotto localmente. Trace esaminato; annuncio iniziale presente, ArrowUp senza annuncio di movimento. Race sospetta nella disponibilità di sensore/misure, causa esatta non isolata. Asserzioni conservate, nessuna quarantena o esclusione; confermare nella CI finale. Dettagli nella [RCA](ci-root-cause-analysis.md).
