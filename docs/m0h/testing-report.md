# M0.H — Rapporto sui test

Tutti i risultati sono stati **eseguiti nello stato finale del codice** (nessun risultato ereditato dal report M0).

## 1. Esiti finali

| Controllo                     | M0 (baseline)      | M0.H (finale)        |
| ----------------------------- | ------------------ | -------------------- |
| `pnpm typecheck`              | ✅ 5 package       | ✅ 5 package         |
| `pnpm lint` (0 warning)       | ✅                 | ✅                   |
| `pnpm format:check`           | ✅                 | ✅                   |
| `pnpm check:contrast`         | ✅ 38 coppie       | ✅ 38 coppie         |
| `pnpm check:config` _(nuovo)_ | —                  | ✅                   |
| `pnpm db:check` _(nuovo)_     | —                  | ✅                   |
| `pnpm build`                  | ✅ (warning chunk) | ✅ **senza warning** |
| Unit/integrazione/componenti  | 101                | **163** (+62)        |
| `pnpm test:e2e`               | 11                 | **31** (+20)         |
| `pnpm test:preview` _(nuovo)_ | —                  | **8**                |
| Test saltati / flaky          | 0 / 0              | 0 / 0                |

Dettaglio dei 163: `shared` 5 · `schemas` 24 · `web` 28 (+2) · `api` **106** (+60: `tenant-integrity` 19, `security-hardening` 41, correzioni).

## 2. Cosa è stato aggiunto, per priorità della specifica

| #   | Priorità                               | Test aggiunti                                                                                                                                                                             |
| --- | -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Autenticazione e configurazioni errate | HS256/`alg:none`, hostname dev ingannevoli, variabili assenti (non solo vuote), `OWNER_EMAIL` normalizzato, rotazione/cache/indisponibilità del JWKS, `check:config`                      |
| 2   | Accesso a workspace diversi            | Enumerazione automatica di **tutte** le rotte registrate (401 senza credenziali), ID manipolati, SQL injection, isolamento nel DB                                                         |
| 3   | Integrità del database                 | 19 test di isolamento tra workspace (con controlli positivi), eliminazioni a cascata, guardia della migrazione su dati esistenti, esistenza di trigger e indici, deriva schema↔migrazioni |
| 4   | Error handling                         | Errori 401/500/rete in E2E con axe; JWKS non disponibile; errore interno senza dettagli                                                                                                   |
| 5   | Onboarding                             | Errore di validazione: focus sul campo, `aria-invalid`, descrizione accessibile; onboarding caricato a richiesta sotto CSP reale                                                          |
| 6   | Responsive                             | Matrice 5 larghezze × 7 percorsi (overflow, controlli fuori viewport, sidebar/hamburger); target 44 px; drawer→desktop; schede statistiche                                                |
| 7   | Persistenza                            | (già in M0) refresh; ripetuto nell'anteprima sulla build di produzione                                                                                                                    |
| 8   | Regressioni frontend                   | Tema condiviso, focus (skip link, menu, drawer), movimento ridotto, richieste non duplicate                                                                                               |
| +   | **Build di produzione** _(nuovo)_      | Suite di anteprima: header e CSP reali servite da Static Assets, fallback SPA, `/api/*`, ETag/304, **zero violazioni CSP** nell'app reale                                                 |

## 3. I test sanno fallire? (mutation check)

Ogni controllo di sicurezza o correzione è stato **rotto di proposito** e si è verificato che il test fallisse, poi ripristinato:

| Mutazione                                                                             | Test che fallisce                                                 |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Rimosso il controllo `owner` / il controllo di ownership                              | `auth.test.ts`, `ownership.test.ts`                               |
| Rotta registrata fuori dal middleware di auth                                         | enumerazione delle rotte                                          |
| `Content-Type` permissivo; `X-Frame-Options` di default                               | `security-hardening.test.ts`                                      |
| `OWNER_EMAIL!` senza gestione di `undefined`                                          | "OWNER_EMAIL non definita"                                        |
| Migrazione 0001 rimossa                                                               | **14 su 19** di `tenant-integrity` (i 5 positivi/cascata passano) |
| Regola `immutable` reintrodotta in `_headers`                                         | anteprima › asset con hash mancante                               |
| `jitless` rimosso                                                                     | anteprima › app reale sotto la CSP (`script-src eval`)            |
| Invarianti di `wrangler.jsonc` indeboliti (`AUTH_MODE`, `workers_dev`, `OWNER_EMAIL`) | `check:config`                                                    |
| Schema modificato senza migrazione                                                    | `db:check`                                                        |
| Icone senza `shrink-0` / griglia a 5 colonne da `lg`                                  | E2E › schede statistiche (1024 / 768)                             |
| axe su pagina volutamente scorretta (M0)                                              | rileva `color-contrast`, `image-alt`, `label`                     |

Errori **miei** scoperti dai test e corretti durante il lavoro: `owner.trim()` su variabile non definita (typecheck + test), misure del test sulle righe senza considerare il gap, `sed` che non corrispondeva (la mutazione sull'icona è stata rifatta), aspettativa sul menu legata all'implementazione modale.

## 4. Limiti dei test (onestà)

- **CI GitHub non eseguita**: nessuna run esiste (`gh run list` vuoto). Il workflow è stato riscritto e i suoi comandi sono stati eseguiti uno a uno in locale, ma il workflow stesso, le action fissate per SHA e l'installazione di Playwright con `--with-deps` su `ubuntu-latest` **non sono verificati**.
- **Un solo browser** (Chromium, build di fallback di Playwright per Fedora).
- **Cloudflare reale non coinvolto**: JWT/JWKS simulati; Static Assets provato su workerd locale; D1 locale.
- **Nessuna prova con screen reader.**
- **Test non deterministici evitati**, ma gli E2E durano ~2,2 min e dipendono dall'avvio di Wrangler/Vite (timeout di 120 s).
- La copertura non è misurata (nessuna soglia): il criterio è la copertura **dei rischi** elencati sopra.
- Il backoff di TanStack Query rende lenti gli E2E sugli errori (≈ 10–15 s ciascuno); nei test RTL il ritardo è azzerato.

## 5. Come rieseguire

```bash
pnpm install --frozen-lockfile
pnpm check            # typecheck, lint, format, contrasto, config, deriva migrazioni, test, build
pnpm test:e2e         # stack di sviluppo (porte 5199/8799)
pnpm test:preview     # build di produzione servita da Static Assets (porta 8797)
```
