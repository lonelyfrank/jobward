# Backlog

Voci note, non pianificate in una milestone specifica o da rivalutare. Priorità: **A** alta, **M** media, **B** bassa.

## Sicurezza e affidabilità

| P   | Voce                                                                               | Note                                                                                             |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| A   | Rate limiting applicativo                                                          | Necessario prima di endpoint pubblici (M5); in M0–M4 mitigato dall'accesso del solo proprietario |
| A   | Audit manuale di sicurezza e accessibilità prima della release privata             | Gli strumenti automatici non bastano (M4)                                                        |
| M   | Stringere la CSP eliminando `style-src 'unsafe-inline'`                            | Richiede di capire gli stili inline di Radix/React                                               |
| M   | Prova di ripristino di D1 (Time Travel + export)                                   | Prima di avere dati reali                                                                        |
| M   | Verificare la CI su GitHub                                                         | Il workflow non è stato eseguito in M0                                                           |
| B   | Header di sicurezza anche per le risposte di asset dal Worker (oltre a `_headers`) | Dipende dal comportamento di Static Assets                                                       |

## Qualità e tooling

| P   | Voce                                                                                                       | Note                                                                 |
| --- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| M   | Budget di peso del bundle e code splitting delle rotte                                                     | Oggi JS ≈ 645 kB (≈ 170 kB gzip); warning di Vite sul chunk > 500 kB |
| M   | Aggiornare quando cadono i vincoli: TypeScript ≥ 6.1/7 (typescript-eslint), ESLint 10 (jsx-a11y), Vitest 5 | Vedi ADR-0002                                                        |
| M   | Test E2E su Firefox e WebKit                                                                               | Oggi solo Chromium                                                   |
| B   | Test visivi di regressione (screenshot)                                                                    | Dopo che l'interfaccia si stabilizza (M1–M2)                         |
| B   | Coverage con soglia minima nel quality gate                                                                |                                                                      |
| B   | Ridurre i font inclusi nel build (solo sottoinsiemi latini)                                                | Non scaricati senza i caratteri, ma presenti nel deploy              |

## Prodotto

| P   | Voce                                                                  | Note                                                    |
| --- | --------------------------------------------------------------------- | ------------------------------------------------------- |
| M   | Internazionalizzazione (UI in italiano oggi, stringhe nei componenti) | Introdurre una libreria quando serve una seconda lingua |
| M   | Scorciatoie da tastiera e palette comandi                             | Dopo M1                                                 |
| M   | Fuso orario per utente (oggi per workspace)                           | Rivedere in M5                                          |
| B   | Preferenze (tema, sidebar) sincronizzate sul server                   | Oggi in `localStorage` del dispositivo                  |
| B   | Bacheche preferite per utente (oggi attributo della bacheca)          | Con la condivisione (M5)                                |
| B   | Allegati (R2)                                                         | Milestone successiva a M4                               |
