# M3 — sicurezza, accessibilità e responsive

Audit locale del 2026-11-08. Le proprietà osservate nel sorgente sono distinte dalle esecuzioni browser nel [quality gate](quality-gate.md).

## Sicurezza

| Controllo            | Evidenza                                                                                                                                                            | Limite                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Autenticazione       | Access JWT con audience/issuer, proprietario esplicito; fail closed su configurazione mancante; dev soltanto development e loopback. Suite auth/security-hardening. | Access reale remoto non configurato né testato in questo incarico.                  |
| Isolamento           | Membership nel middleware, workspace nei predicati e chiavi composite/trigger nel DB. Suite ownership, tenant-integrity, isolation.                                 | Fixture sintetiche, nessuna ispezione dei dati reali.                               |
| CSRF                 | JSON obbligatorio, Origin e Sec-Fetch-Site verificati, nessun CORS aperto.                                                                                          | Non è stata eseguita una campagna di penetration testing.                           |
| Input/errori         | Zod strict, limite payload, SQL parametrizzato; errori pubblici standard con requestId.                                                                             | Concorrenza valutata secondo i contratti, non promessa di serializzabilità globale. |
| Documenti/background | Riferimenti HTTP(S), niente fetch/upload server; background selezionati da catalogo locale.                                                                         | Nessuna integrazione esterna introdotta.                                            |
| Cloudflare/CSP       | check:config, preview della build tramite Worker Static Assets, test di header e CSP reale locale. Build API solo deploy --dry-run.                                 | Nessun deploy e nessuna attestazione della configurazione dell'account remoto.      |

## Accessibilità e comportamento

Menu account: nome accessibile, apertura da Enter, focus sulla prima voce navigabile, ArrowDown, Esc, restituzione al trigger. Link ritorno alle bacheche: semantica Link/href conservati, nome aggiornato nel test e navigazione effettiva verificata. Drawer e dialog: trap, Esc, focus di ritorno, nesting e modifiche non salvate coperti dalle suite esistenti e preview.

La failure touch non richiedeva pulsanti più grandi: la card board è un link esteso tramite pseudo-elemento. Il misuratore ora riconosce quella geometria solo quando interattiva; un test negativo verifica che un link piccolo e uno pseudo-elemento pointer-events:none restino segnalati. Un test browser verifica anche il click reale fuori dal testo e le azioni separate.

Glass: esclusivo delle colonne Kanban; Tabella opaca. Test CSS e browser conservano forced-colors e contrast:more. Il fallback prefers-reduced-transparency è protetto staticamente; non va presentato come provato su ogni sistema operativo reale. Il test axe deve aspettare la nuova vista e la fine delle animazioni finite, evitando misure a metà fade.

## Matrice responsive

`stabilization.spec.ts` verifica 320, 375, 390, 768, 1024, 1440 e 1920 px in light/dark su Overview, Bacheche, Kanban, Tabella, Opportunità e Tasks. Tutti i 14 casi multivista passano nella suite finale (84 combinazioni), oltre ai due casi touch dedicati. Controlla overflow del documento, disponibilità dei contenuti e target header mobili. A 375 px usa reduced motion; la suite hardening conserva inoltre il controllo globale delle animazioni ridotte.

Prodotti otto screenshot a 390/1440 per Kanban e Tabella, nei due temi. Ispezionati visivamente quattro campioni: Tabella light mobile, Kanban light desktop, Kanban dark mobile e Tabella dark desktop; nessuna modifica estetica aggiunta dopo l'ispezione. Immagini in `apps/web/test-results/stabilization-*` nel worktree. Gli esiti della suite completa sono nel quality gate.

L'overflow orizzontale confinato della tabella/Kanban è intenzionale e non equivale a overflow del documento. Non si aggiungono eccezioni a elementi realmente persi oltre la finestra.

## Limiti dichiarati

Browser automatico: Chromium Playwright su Linux. Nessun Safari/WebKit, Firefox, device fisico o lettore di schermo reale certificato. Axe e contrasto token non equivalgono a conformità WCAG completa. Prima della beta privata pianificare verifica manuale assistiva, zoom utente e Access reale in M4-C3/C4.
