# Backlog

Voci note, non pianificate in una milestone specifica o da rivalutare. Priorità: **A** alta, **M** media, **B** bassa.

## Sicurezza e affidabilità

| P   | Voce                                                                                    | Note                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Rate limiting applicativo                                                               | Necessario prima di endpoint pubblici (M5); in M0–M4 mitigato dall'accesso del solo proprietario                                                                        |
| A   | Audit manuale di sicurezza e accessibilità prima della release privata                  | Gli strumenti automatici non bastano (M4)                                                                                                                               |
| M   | Stringere la CSP eliminando `style-src 'unsafe-inline'`                                 | **Provato in M0.H e non praticabile** con Radix modali (`<style>` iniettato, contenuto variabile): servirebbe sostituire i modali o servire l'HTML dal Worker con nonce |
| M   | Prova di ripristino di D1 (Time Travel + export)                                        | Prima di avere dati reali                                                                                                                                               |
| A   | **Eseguire la CI su GitHub** (aprire una PR) e correggere le differenze                 | Mai eseguita; action aggiornate e fissate per SHA in M0.H ma non provate                                                                                                |
| A   | **Collaudo su Cloudflare reale** con la checklist di `docs/m0h/cloudflare-readiness.md` | Access, edge di Static Assets, sessione scaduta (H-22)                                                                                                                  |
| B   | Rivalutare gli header degli asset sull'edge reale                                       | In locale `_headers` è applicato (verificato in M0.H); da confermare sull'edge                                                                                          |
| M   | Rate limiting con regola WAF sul dominio, nel frattempo                                 | Mitigazione fino a M5                                                                                                                                                   |
| B   | Dipendenze dev con avvisi `pnpm audit` (minimatch, esbuild vecchio in drizzle-kit)      | Nessuna esposizione runtime; riverificare agli aggiornamenti                                                                                                            |

## Qualità e tooling

| P   | Voce                                                                                                       | Note                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| M   | Budget di peso del bundle (es. fallirebbe la CI sopra una soglia)                                          | Oggi JS iniziale 606,6 kB / 188,9 kB gzip (M0.H: −6%); Zod 84 kB è la voce migliorabile (`zod/mini`, riscrittura) |
| M   | Aggiornare quando cadono i vincoli: TypeScript ≥ 6.1/7 (typescript-eslint), ESLint 10 (jsx-a11y), Vitest 5 | Vedi ADR-0002                                                                                                     |
| M   | Test E2E su Firefox e WebKit                                                                               | Oggi solo Chromium                                                                                                |
| B   | Test visivi di regressione (screenshot)                                                                    | Dopo che l'interfaccia si stabilizza (M1–M2)                                                                      |
| B   | Coverage con soglia minima nel quality gate                                                                |                                                                                                                   |
| B   | Ridurre i font inclusi nel build (solo sottoinsiemi latini)                                                | Non scaricati senza i caratteri, ma presenti nel deploy                                                           |

## Prodotto

| P   | Voce                                                                  | Note                                                    |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| M   | Internazionalizzazione (UI in italiano oggi, stringhe nei componenti) | Introdurre una libreria quando serve una seconda lingua |
| M   | Scorciatoie da tastiera e palette comandi                             | Dopo M1                                                 |
| M   | Fuso orario per utente (oggi per workspace)                           | Rivedere in M5                                          |
| B   | Preferenze (tema, sidebar) sincronizzate sul server                   | Oggi in `localStorage` del dispositivo                  |
| B   | Bacheche preferite per utente (oggi attributo della bacheca)          | Con la condivisione (M5)                                |
| B   | Allegati (R2)                                                         | Milestone successiva a M4                               |

## Emerse in M1 (da [issue-register](../m1/issue-register.md))

| P   | Voce                                                                                                            | Note                                                   |
| --- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| A   | **Integrare la PR #2 prima di M1** (CI di `main` rossa per l'E2E)                                               | M1 è impilata sul suo branch                           |
| M   | Code splitting della vista bacheca (JS 293 → 452 kB)                                                            | L-04; M4                                               |
| M   | Prova manuale con screen reader e trascinamento da tastiera **tra colonne**; test su iOS/Android/Firefox/WebKit | L-05, L-06; prima del rilascio privato                 |
| M   | Cambio di fase proposto (con conferma) quando una scheda entra in una colonna con categoria                     | Decisione rinviata a M2; M1 è volutamente conservativa |
| B   | Token di versione nella modifica delle schede (ultima scrittura vince)                                          | L-01; utile solo con più dispositivi/utenti            |
| B   | Pulizia della cronologia scollegata dopo l'eliminazione di una bacheca                                          | L-07; M4/M5                                            |
| B   | Paginazione/virtualizzazione per bacheche molto grandi (tetto attuale 2000 schede)                              | L-03                                                   |

## Candidate per sviluppi futuri — non approvate

Elenco della [politica di perimetro](scope-policy.md): **la presenza qui non implica approvazione né assegnazione a una milestone**.

| Voce                                 | Note             |
| ------------------------------------ | ---------------- |
| Acquisizione assistita delle offerte | solo valutazione |
| Integrazioni email e calendari       | solo valutazione |
| Notifiche                            | solo valutazione |
| Analisi deterministica del CV        | solo valutazione |
| Confronto economico delle offerte    | solo valutazione |
| Strumenti avanzati per i candidati   | solo valutazione |

Fuori roadmap (**non pianificati**): funzioni basate su AI/LLM, dashboard e account per aziende/recruiter, sistemi ATS, marketplace di annunci.
