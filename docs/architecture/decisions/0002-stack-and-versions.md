# ADR-0002 — Stack e versioni

**Stato:** Accettato · **Data:** 2026-11-04

## Contesto

La specifica indica lo stack; richiede di **verificare compatibilità e disponibilità reale dei pacchetti** prima
dell'installazione. Le versioni correnti su npm (novembre 2026) erano più avanzate di quelle di riferimento.

## Verifiche e decisioni

| Tema                           | Evidenza                                                                                                                   | Decisione                                                                                                                   |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| TypeScript                     | `latest` è 7.0.2, ma `typescript-eslint` dichiara `typescript >=4.8.4 <6.1.0`                                              | **6.0.3** (ultima 6.0.x)                                                                                                    |
| Vitest                         | `latest` è 5.1. Il vecchio pool Cloudflare richiedeva `vitest ^4.1`; il nuovo `vitest-plugin@1.5.1` accetta `^4.1 \|\| ^5` | **4.1.12** per prudenza e coerenza tra package. Non è più un vincolo: la 5.x non è stata provata con questa suite (backlog) |
| Test nel runtime Workers       | `@cloudflare/vitest-pool-workers@0.23.0` risulta **deprecato** (rinominato)                                                | **`@cloudflare/vitest-plugin@1.5.1`**, allineato a `wrangler 4.157.0`                                                       |
| ESLint                         | `latest` è 10, ma `eslint-plugin-jsx-a11y` dichiara peer solo fino a ESLint 9                                              | **9.39.5** (ramo manutenzione): si mantiene il lint di accessibilità, requisito della specifica                             |
| Vite / plugin React / Tailwind | Vite 8, `@vitejs/plugin-react` 6, `@tailwindcss/vite` 4.3 dichiarano compatibilità reciproca                               | Ultime versioni                                                                                                             |
| React Router                   | 8.x richiede Node ≥ 22.22 e React ≥ 19.2.7                                                                                 | Adottato; `engines` del repo fissa Node ≥ 22.22                                                                             |
| Supply chain                   | pnpm ha escluso automaticamente due pacchetti pubblicati il giorno stesso (controllo di età minima)                        | Eccezioni **rimosse**; fissate versioni del giorno precedente (`lucide-react 1.67.0`, `workers-types 5.20261103.1`)         |
| Script di installazione        | pnpm 12 blocca gli script dei pacchetti                                                                                    | Approvati solo `esbuild` e `workerd` (`allowBuilds`)                                                                        |
| Radix                          | Singolo pacchetto `radix-ui`                                                                                               | Usato al posto di wrapper shadcn generati dalla CLI                                                                         |
| Compatibilità Workers          | Nessun SDK Node assunto compatibile                                                                                        | Solo librerie note per Workers: Hono, Drizzle (driver D1), `jose` (Web Crypto), Zod                                         |

Le versioni condivise sono centralizzate nel `catalog` di `pnpm-workspace.yaml`, con i vincoli annotati.

### Componenti UI "in stile shadcn/ui"

La specifica cita shadcn/ui. Poiché shadcn **non è una libreria** ma un insieme di sorgenti copiati, i componenti
(`apps/web/src/components/ui`) sono scritti a mano con lo stesso schema (Radix + `class-variance-authority` +
`tailwind-merge`), limitati a quelli effettivamente usati. Evita il codice generato non necessario e il coinvolgimento
della CLI interattiva.

### Non installati in M0 (per scelta)

`@dnd-kit/*` (serve a M1), Cloudflare R2 (allegati, successivo). Evita dipendenze senza ruolo reale.

## Conseguenze

Quando i vincoli cadranno (typescript-eslint con TS ≥ 6.1, jsx-a11y con ESLint 10, nuovo `vitest-plugin`) si potrà
aggiornare; il backlog lo traccia. Ogni aggiornamento maggiore passa dal quality gate.
