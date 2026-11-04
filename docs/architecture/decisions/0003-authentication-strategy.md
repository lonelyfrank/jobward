# ADR-0003 — Strategia di autenticazione

**Stato:** Accettato · **Data:** 2026-11-04

## Contesto

Requisiti elencati dalla specifica per l'autenticazione definitiva: account personali, sessioni sicure con cookie
HttpOnly/Secure/SameSite, CSRF, recupero account, rate limiting, autorizzazioni lato server, revoca delle sessioni.
Per M0 è ammesso l'accesso privato limitato al proprietario, **purché non diventi una scorciatoia insicura destinata a restare**.

## Opzioni valutate

| Opzione                                                           | Pro                                                                                              | Contro                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| **A. Cloudflare Access + verifica JWT nel Worker**                | MFA/IdP/revoca/durata/log senza codice nostro; protegge anche gli asset; nessun segreto nel repo | Dipendenza da Cloudflare; non adatto a utenti pubblici                                                 |
| B. Password condivisa / token statico                             | Banale                                                                                           | Insicuro, senza revoca né recupero: la scorciatoia vietata                                             |
| C. Auth completa propria (sessioni D1, hashing PBKDF2 Web Crypto) | Indipendente, riusabile in M5                                                                    | Molto codice sensibile da scrivere e mantenere prima che serva                                         |
| D. Libreria (Better Auth, ecc.)                                   | Funzionalità pronte                                                                              | Compatibilità con Workers/D1 e rotta di migrazione da verificare; sovradimensionata per un solo utente |

## Decisione

**Opzione A per M0–M4**, con queste garanzie:

- Il Worker **non si fida dell'edge**: verifica firma (JWKS del team), `iss`, `aud`, `exp`, algoritmo RS256 e confronta l'email con `OWNER_EMAIL`.
- **Fail-closed**: configurazione mancante/non valida → 500 `auth_misconfigured`.
- Una modalità `dev` (identità fittizia) esiste solo per lo sviluppo e viene **rifiutata** se `ENVIRONMENT≠development` o se l'hostname non è di loopback (difesa contro un deploy accidentale di `--env dev`).
- Il modello dati (`users`, `workspaces`, `workspace_members`) è già multiutente; ogni endpoint passa da `requireMembership`.

**Per M5** si valuterà tra C e D con un nuovo ADR, quando esisteranno requisiti concreti (provider, recupero, quote).

## Conseguenze

- M0 espone dati privati **solo** al proprietario, con test di sicurezza dedicati.
- Rate limiting, recupero account e revoca sessioni non sono implementati: sono onestamente fuori da M0 (vedi `authentication.md`, "Rischi residui").
- Il deploy richiede configurare Access; senza, l'API rifiuta tutto (comportamento voluto).
