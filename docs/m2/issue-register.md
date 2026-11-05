# M2 — Registro dei problemi

Classificazione: **P0** sicurezza critica / perdita di dati / app inutilizzabile · **P1** errori gravi su dati, API, autorizzazioni, flussi fondamentali · **P2** funzionali non bloccanti, UX, prestazioni · **P3** minori.

## Riepilogo

| ID    | Gravità | Titolo                                                                                                                                    | Stato                            |
| ----- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| M2-00 | P2      | CI di `main` rossa: falso positivo axe a metà animazione + avvio a freddo                                                                 | Corretto                         |
| M2-01 | P2      | Eliminazione di etichette/campi: la risposta non rispettava il contratto condiviso (il client mostrava un errore a eliminazione riuscita) | Corretto                         |
| M2-02 | P2      | `DELETE` con cascata: D1 conta anche le righe eliminate dalle chiavi esterne (`changes` > 1) → falso 409 con `force`                      | Corretto                         |
| M2-03 | P2      | Input non `strict`: chiavi extra (`workspaceId`, `id`, `options` su una data) accettate e ignorate in silenzio                            | Corretto                         |
| M2-04 | P2      | `drizzle-kit generate` produce per la nuova colonna la ricostruzione distruttiva di `application_details` (PRAGMA non affidabile su D1)   | Prevenuto (migrazione riscritta) |
| M2-05 | P3      | Tabella: la spunta di un filtro tornava indietro per ~50 ms (stato legato all'indirizzo asincrono)                                        | Corretto                         |
| M2-06 | P3      | Filtri e ordinamento sostituivano la voce di cronologia: «indietro» non li annullava                                                      | Corretto                         |
| M2-07 | P3      | Un errore della ricerca arrivava dopo ~7 s (tre ritentativi con backoff)                                                                  | Corretto                         |

## M2-00 · CI di `main` rossa dopo il merge di M1 (P2)

- **Descrizione.** Il job _E2E (Playwright)_ del merge di #3 (`35b7614`, run 41942789544) fallisce: (a) `accessibilità WCAG 2.2 AA` → `color-contrast: .mt-1, .mt-1\.5` su `/opportunities (light)`;
  (b) il primo test (onboarding) risulta _flaky_ (riesce al secondo tentativo: l'intestazione non compare entro 5 s).
- **Evidenza.** Log della run; lo stesso commit sul branch della PR (run 41942442943) era verde; **in locale, da ambiente pulito, 65/65 E2E verdi**.
  Il contenuto principale entra con `mr-fade-in` (0,15 s, opacità 0→1): axe calcola il contrasto sul colore composto con l'opacità _corrente_.
- **Riproduzione del meccanismo.** Con `animation-duration: 3s` (runner lento simulato) e axe lanciato subito dopo il render di `/opportunities`:
  `color-contrast: h1 | .mt-1 | … | .mt-1.5` (gli stessi selettori della CI). Dopo aver atteso la fine delle animazioni finite: nessuna violazione.
  Il difetto **non è nell'applicazione** (i token superano la soglia: `pnpm check:contrast`); è nel test, che campionava un frame intermedio.
- **Impatto.** `main` rosso: nessun segnale affidabile per le PR successive. Nessun impatto sugli utenti.
- **Correzione.** `waitForAnimationsToSettle()` (attende `document.getAnimations()` finite, ignora quelle infinite dello skeleton) chiamata da `expectNoA11yViolations`;
  in CI `expect.timeout` passa da 5 s a 15 s per l'avvio a freddo di Vite. Nessun controllo rimosso, nessuna soglia di contrasto toccata.
- **Test di regressione.** L'intero helper è usato da ogni controllo axe (≈ 30 schermate); il meccanismo è stato verificato con la prova sopra descritta.
- **Stato.** Corretto in M2 (commit `fix(e2e)`); **da confermare con la CI della PR** (la riproduzione esatta del runner non è possibile in locale).

## M2-01 · Risposta di DELETE non conforme al contratto (P2)

- **Evidenza.** E2E `customization.spec.ts` n. 7: dopo «Elimina campo e valori» la finestra restava aperta con «Qualcosa è andato storto». Il campo era però stato eliminato: la rotta rispondeva `{deleted: true}`, il client validava con `deletedResponse` (`{id}`) → `invalid_response`.
- **Impatto.** Nessuna perdita di dati; l'utente credeva che l'eliminazione fosse fallita.
- **Correzione.** Le rotte rispondono `deletedResponse.parse({ id })`; documentazione allineata.
- **Regressione.** Test API che validano la risposta di eliminazione con lo schema condiviso (`labels.test.ts`, `custom-fields.test.ts`).

## M2-02 · Cascata e `meta.changes` (P2)

- **Evidenza.** `labels.test.ts`: `DELETE /labels/:id` con `force` su un'etichetta assegnata a 2 schede → 409 invece di 200.
- **Causa.** Il servizio verificava `changes !== 1`; su D1 `changes` include le righe rimosse dalla cascata.
- **Correzione.** `changes < 1` (nessuna riga eliminata). **Regressione:** gli stessi test.

## M2-03 · Input non `strict` (P2)

- **Evidenza.** Test di validazione: `POST /labels` con `workspaceId` nel body → 201; `POST /custom-fields` di tipo `date` con `config.options` → 201.
- **Impatto.** Nessuno sulla sicurezza (il workspace non si legge dal body), ma un parametro sbagliato veniva ignorato in silenzio, contro la convenzione dei contratti.
- **Correzione.** `createLabelInput`, `createCustomFieldInput` e tutte le `config` per tipo sono `strict`.

## M2-04 · Migrazione generata distruttiva (P2, prevenuta)

- **Evidenza.** `pnpm db:generate` per `salary_basis` ha prodotto `CREATE __new_application_details … DROP TABLE application_details … RENAME` con `PRAGMA foreign_keys=OFF`.
- **Rischio.** Su D1 il `PRAGMA` non è affidabile e il `DROP` avrebbe cancellato i dettagli (azienda, URL) inseriti in M1.
- **Correzione.** `0003` è additiva (`ALTER TABLE … ADD COLUMN … CHECK`), lo snapshot resta quello generato. **Test:** `pnpm db:upgrade-test` (ora anche in CI): database M1 popolato (601 schede, di cui 60 archiviate, dettagli, eventi, etichetta) → aggiornamento → dati identici campo per campo, `foreign_key_check` vuoto, vincoli nuovi attivi.

## M2-05 · Spunta dei filtri in ritardo (P3)

- **Evidenza.** E2E: Playwright segnalava «Clicking the checkbox did not change its state»; una traccia mostrava `checked=false` fino a ~60 ms dopo l'aggiornamento dell'indirizzo.
- **Correzione.** Stato ottimistico locale, valido finché l'indirizzo non cambia (poi torna la fonte di verità). **Regressione:** gli E2E sui filtri.

## M2-06 · Cronologia dei filtri (P3)

- **Evidenza.** `page.goBack()` dopo aver cambiato un filtro usciva dalla pagina.
- **Correzione.** Filtri, ordine e pagina creano voci di cronologia; la digitazione nella ricerca sostituisce la voce.

## M2-07 · Ricerca: errore tardivo (P3)

- **Evidenza.** Con il server in errore la tabella restava su «Ricerca in corso…» per ~7 s (default di TanStack Query: 3 ritentativi con backoff).
- **Correzione.** Nessun ritentativo per 4xx; uno solo, dopo 400 ms, per guasti passeggeri.

## M2-08 · Violazione CSP `script-src eval` dopo il code splitting (P2)

- **Evidenza.** `pnpm test:preview` (build di produzione con CSP reale), test «onboarding, navigazione, menu…»: `CSP: script-src eval`. Con la suite di sviluppo (senza CSP) non si vede.
- **Causa.** Zod 4 prova `new Function()` alla **creazione** di ogni schema; `z.config({ jitless: true })` stava in `main.tsx` ed era valido finché la build era un unico chunk. Con Kanban, tabella e configuratore caricati a richiesta, i moduli di Zod e degli schemi finiscono in un chunk condiviso valutato **prima** del corpo dell'entry.
- **Impatto.** Una violazione CSP segnalata a ogni avvio (nessun blocco funzionale: Zod ripiega), ma rumore nei report e rischio con una CSP in modalità enforcing/reporting.
- **Correzione.** La configurazione vive in `packages/schemas/src/zod-setup.ts`, importato per **primo** da `index.ts`: viaggia con gli schemi in qualunque chunk (su Workers il JIT è comunque disattivo).
- **Regressione.** La suite di anteprima (tutti i test «sotto la CSP di produzione», incluso il nuovo flusso M2).
