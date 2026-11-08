# M3 — dipendenze e salute del codice

Revisione del 2026-11-08 sul lockfile invariato. Nessun aggiornamento di dipendenza, framework o state manager introdotto.

## Advisory effettivi

`pnpm audit --json` ha consultato il registro npm: 2 vulnerabilità moderate, 0 high, 0 critical (668 dipendenze totali nel report). Non è uno script richiesto da `pnpm check`; il suo exit code nonzero indica advisory presenti, non un gate automaticamente verde.

| Dipendenza       | Percorso                                                      | Rischio e decisione                                                                                                                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| esbuild 0.18.20  | database → drizzle-kit → @esbuild-kit/esm-loader → core-utils | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), server di sviluppo. Non è il runtime Worker distribuito; non avviare server toolchain su interfacce pubbliche. Aggiornamento compatibile Drizzle da pianificare, senza override indiscriminato.                    |
| minimatch 10.2.6 | typescript-eslint → typescript-estree                         | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249), amplificazione glob/DoS. Tooling dev; i pattern dell'utente del prodotto non raggiungono ESLint. Il report propone >=11.0.1, cambio major: verificare compatibilità del pacchetto padre in un intervento separato. |

Non si dichiara assenza assoluta di vulnerabilità: il report descrive soltanto gli advisory restituiti dal registro al momento dell'esecuzione. Le dipendenze transitive @esbuild-kit sono anche debito di manutenzione della toolchain.

## Duplicazioni e codice inutilizzato

Nel lockfile React e React DOM hanno una sola versione, 19.3.1, e React Router 8.5.1. Esbuild compare in tre versioni: 0.18.20 nella catena @esbuild-kit, 0.25.12 in drizzle-kit e 0.28.2 negli strumenti recenti. Zod 4.6.6 appartiene al pool di test Cloudflare, mentre il catalogo applicativo usa 4.6.7. Queste duplicazioni della toolchain non dimostrano due copie del runtime React o contratti applicativi divergenti; nessun override forzato introdotto.

Il gate ESLint protegge variabili/import locali inutilizzati con no-unused-vars e le promise non gestite. Non prova che ogni export pubblico o dipendenza di configurazione sia necessario: non è stato eseguito un eliminatore globale di codice morto. Nessuna rimozione senza un consumatore verificato, in particolare per route lazy, CSS e configurazioni.

## Classificazione degli interventi

**Fix immediati:** stato ottimistico della ricerca dopo Back; closure del debounce che perde filtri; scope Table Glass; locator dei radio/menu/navigazione; misure dei test durante transizioni; copertura 0007. Motivazioni e prove nei report frontend/test.

**Refactor consigliati:** estrarre stato della ricerca in un hook solo se nuovi casi richiedono ulteriori responsabilità; isolare un eventuale modulo di retention se note/documenti iniziano a divergere; valutare partizionamento della suite seriale search con fixture indipendenti. Non sono prerequisiti automatici di M3 e non sono stati implementati per uniformità.

**Debito accettabile:** file estesi ma già separati in form/API/presentazione; caricamento Kanban entro tetto 2.000; timeline task per card in memoria; `HydrateFallback` mancante nel primo caricamento delle route lazy (warning osservato nei log Vite). Nessuna eliminazione di export o dipendenza dichiarata inutilizzata senza verifica affidabile: CSS, configurazioni e import dinamici possono usarli.

## Bundle e compatibilità

Build Vite e dry-run Worker sono verificati nel quality gate; le dimensioni effettive sono riportate sotto. Nessun confronto prestazionale prima/dopo è stato usato per rivendicare ottimizzazioni; il cambiamento di scope CSS elimina selettori inutilizzati ma non rappresenta un progetto di riduzione del bundle. Le versioni dichiarate in package.json e lockfile restano identiche.

Dimensioni della build finale (Vite, kB decimali):

| Asset                       | Minificato | gzip     |
| --------------------------- | ---------- | -------- |
| CSS principale              | 68,95 kB   | 13,27 kB |
| Entrypoint applicazione     | 299,19 kB  | 89,25 kB |
| Vendor React/router         | 314,55 kB  | 99,03 kB |
| Route Kanban                | 72,60 kB   | 23,78 kB |
| OpportunitiesView condivisa | 22,28 kB   | 7,36 kB  |

Sono misure dell'artefatto, non tempi di caricamento o benchmark. Il provider DOM richiesto da flushSync usa le dipendenze già installate. Log completo: `gate-check.log` nell'archivio di evidenze locali.

Il dry-run `wrangler deploy --dry-run` usato dallo script build non pubblica il Worker. Nessun nuovo job CI, aggiornamento delle action o modifica dei settings GitHub.

Durante il caso workflow che cambia gli hash direttamente compare anche il warning del router sui POP non creati dalle sue API. La ricerca nel sorgente non trova pushState/replaceState diretti nell'app: le navigazioni applicative usano il router. Il warning viene distinto dalla regressione Back corretta; eventuali modifiche manuali dell'hash con bozze sporche richiedono una verifica specifica, senza dedurne automaticamente un difetto del sistema Dialog.
