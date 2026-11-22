# ADR-0013 — Rebranding a Jobward e identificatori persistenti

**Stato:** accettata (M3.0) · **Data:** 2026-11-05

**Aggiornamento M3-C1:** [ADR-0014](0014-jobward-technical-rebranding.md) sostituisce il rinvio D6 e le decisioni su logo e nomi Worker. Questo testo è conservato come decisione storica; le compatibilità persistenti sono precisate nella nuova ADR.

## Contesto

Il prodotto, finora «Meet Roulette», si chiama **Jobward**. Il nome compare in tre famiglie di posti con rischi diversi:

1. **Testo visibile** (titoli, interfaccia, documentazione): nessun rischio, si sostituisce.
2. **Identificatori di codice** (scope dei pacchetti `@meet-roulette/*`, 185 occorrenze in 5 pacchetti): nessun dato persistente, ma un rename tocca ogni `import` e il lockfile.
3. **Identificatori persistenti o di infrastruttura** (nome del Worker, `database_name` D1, identità di sviluppo `dev@meet-roulette.local`): cambiarli **non rinomina** la risorsa esistente, ne indica **un'altra**.

## Decisione

| Identificatore                                                                        | Azione in M3                                              | Motivo                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Testi dell'interfaccia, `<title>`, meta description, `<noscript>`, titolo del tab     | **Rinominati** → Jobward                                  | Una sola costante: `apps/web/src/lib/brand.ts` (`BRAND`, `documentTitle`).                                                                                                                |
| `package.json` (campo `description`), README, documentazione di prodotto/architettura | **Rinominati**                                            | Prosa.                                                                                                                                                                                    |
| Relazioni di consegna e registri delle milestone M0–M2.5                              | **Invariati**                                             | Sono documenti storici datati: riscriverli falsificherebbe la cronologia.                                                                                                                 |
| Logo e favicon                                                                        | **Originali forniti; segnaposto ancora nell'interfaccia** | `jobward.png` e `jobward-white.png` sono già versionati. `LogoMark` e `public/favicon.svg` restano da sostituire con verifica di resa, temi e accessibilità; nessun nuovo logo inventato. |
| Scope dei pacchetti `@meet-roulette/*`, `name` del `package.json` radice              | **Invariati; rename rinviato (D6)**                       | Decisione esplicita del proprietario del 2026-11-05: conservare gli identificatori tecnici esistenti. Un futuro rename richiede autorizzazione separata.                                  |
| `name` del Worker (`meet-roulette`, `-dev`, `-preview`, `-test`)                      | **Invariati**                                             | Il nome identifica il Worker distribuito, il suo dominio `workers.dev` e i suoi segreti: un rename è un **nuovo** Worker. Va fatto al momento del deploy, con il nuovo dominio.           |
| `database_name` D1 (`meet-roulette`, `-local`, `-preview`)                            | **Invariati**                                             | Un nome diverso punta a un database **vuoto**: i dati degli utenti resterebbero nel vecchio. D1 non supporta il rename. Strategia sotto.                                                  |
| Identità locale `dev@meet-roulette.local` (`DEV_USER_EMAIL`)                          | **Invariata**                                             | Cambiarla crea un utente diverso nel database di sviluppo e nasconde i dati esistenti dell'ambiente locale.                                                                               |
| Chiavi di `localStorage` / cookie                                                     | **Verificato: nessuna** contiene il nome                  | Niente da migrare.                                                                                                                                                                        |
| Repository GitHub, domini                                                             | **Fuori ambito**                                          | Decisione del proprietario; il redirect di GitHub copre il rename del repository.                                                                                                         |

### Strategia per gli identificatori persistenti (quando si farà il deploy con il nuovo nome)

1. **Worker:** creare il Worker `jobward` accanto al vecchio, con lo stesso binding al database; spostare il traffico; ritirare il vecchio.
2. **D1:** **non rinominare**. Il `database_name` è un'etichetta interna (il binding `DB` e il `database_id` non cambiano): si può mantenere `meet-roulette` indefinitamente senza effetti visibili. Se si desidera il nuovo nome: `wrangler d1 export` → `d1 create jobward` → `import` → verifica dei conteggi → cambio di `database_id`, con il vecchio database conservato fino alla verifica.
3. **Identità di sviluppo:** cambiarla solo insieme a un reset del database locale (`rm -rf .e2e-state`, già parte dei test).
4. Nessuna di queste azioni viene eseguita in M3: non c'è un ambiente remoto in questo repository e M3 non fa deploy.

## Conseguenze

- Nessuna incompatibilità con dati, ambienti o CI esistenti.
- Il nome visibile è definito in un solo punto; la futura brand identity cambia `BRAND` e `logo.tsx` (più `favicon.svg`).
- Convivono due nomi nel codice (visibile: Jobward; tecnico: `meet-roulette`). È documentato qui e nel README.
