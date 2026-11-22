# Tutorial — aggiungere una funzione da capo a fine

**Stato:** canonico · **Per chi:** chi sviluppa su Jobward per la prima volta. Percorre tutti gli strati con un esempio reale già nel codice: le **viste salvate** dell'Opportunity Center (`saved_views`, `/api/v1/views`). Ogni passo indica il file da aprire. Per una funzione nuova, copia la struttura dell'esempio e cambiane i nomi.

```text
packages/database   →  packages/schemas  →  apps/api/services  →  apps/api/modules  →  apps/web/features  →  apps/web/routes
  tabella + SQL        contratti Zod         regole e SQL          rotta HTTP           hook di dati          interfaccia
                                  test API (apps/api/test)          test web (*.test.tsx)   E2E (apps/web/e2e)
```

## 0. Prima di scrivere codice

1. **È approvata?** Una voce del [backlog](../roadmap/backlog.md) o della [roadmap](../roadmap/MASTER-FUNCTIONAL-ROADMAP.md) non è un'approvazione. La [scope policy](../roadmap/scope-policy.md) vieta senza nuova decisione AI/LLM, funzioni per recruiter, ATS e marketplace.
2. **Che cosa tocca?** Trova il sottosistema in [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md): elenca i dipendenti, i test da eseguire e i documenti da aggiornare.
3. **Ambiente:** `pnpm dev` (app su `:5174`, API su `:8787`). Il D1 locale contiene dati reali: prima di applicare una migrazione copialo (`cp -r apps/api/.wrangler/state apps/api/.wrangler/backups/state-$(date +%Y%m%dT%H%M%S)`), e non azzerarlo.

## 1. Tabella e migrazione — `packages/database`

Definisci la tabella in [`schema.ts`](../../packages/database/src/schema.ts) (cerca `savedViews`). Le convenzioni sono in [database.md](../architecture/database.md):

- `id` testuale generato con `newId()`, tempi in millisecondi (`created_at`, `updated_at`);
- **`workspace_id` obbligatorio**, con chiave esterna `ON DELETE cascade`: cancellare un workspace cancella tutto ([ADR-0007](../architecture/decisions/0007-database-tenant-isolation.md));
- vincoli `CHECK` per lunghezze ed enumerazioni (il database rifiuta i dati non validi anche se il codice sbaglia);
- indici per le query che farai (qui: nome univoco per workspace senza distinzione di maiuscole, ordinamento per `position`).

```bash
pnpm db:generate       # crea packages/database/migrations/000N_<nome>.sql dallo schema
pnpm db:check          # fallisce se schema.ts e migrazioni divergono
pnpm db:migrate:local  # applica al D1 locale (dopo la copia di sicurezza)
```

Esempio generato: [`0002_saved_views.sql`](../../packages/database/migrations/0002_saved_views.sql). Le migrazioni dopo la `0000` sono **solo additive**. Un cambiamento strutturale (rinominare, rimuovere, ricostruire una tabella) richiede un piano approvato ([ADR-0017](../architecture/decisions/0017-local-v1-baseline.md)). I trigger vivono solo nell'SQL: `db:check` non li vede, quindi vanno provati con un test.

## 2. Contratti — `packages/schemas`

[`saved-view.ts`](../../packages/schemas/src/saved-view.ts) definisce, con Zod, **tre cose**:

| Che cosa            | Esempio                                   | Regola                                                                 |
| ------------------- | ----------------------------------------- | ---------------------------------------------------------------------- |
| Entità in uscita    | `savedViewSchema`                         | Ciò che l'API restituisce; il client la usa per validare la risposta   |
| Input               | `createSavedViewInput`, `update…Input`    | Sempre `.strict()` (campi sconosciuti = 400); `trim`, `min`, `max` qui |
| Involucro di uscita | `savedViewResponse`, `savedViewsResponse` | Un oggetto con una chiave (`{ view }`, `{ views }`), mai un array nudo |

Esporta il file da [`index.ts`](../../packages/schemas/src/index.ts). Server e client importano gli stessi schemi da `@jobward/schemas`, quindi un contratto cambia in un punto solo. Le regole pure che servono anche al client (calcoli, suggerimenti, ordinamenti) vanno in `packages/shared`, con i loro test unitari.

## 3. Regole e accesso ai dati — `apps/api/src/services`

[`services/saved-views.ts`](../../apps/api/src/services/saved-views.ts) contiene la logica. Regole da rispettare in ogni servizio:

- riceve `workspaceId` **come parametro** e lo usa in **ogni** `WHERE` (anche in `UPDATE` e `DELETE`): non lo legge mai dal corpo della richiesta;
- riceve `now` come parametro invece di chiamare `Date.now()`: i test e la [demo](../../apps/api/src/services/demo.ts) possono così simulare date passate;
- una risorsa di un altro workspace dà `notFound()`, come una inesistente: non si rivela che esiste;
- gli errori di dominio usano gli helper di `lib/errors` (`notFound`, `conflict`, `ApiError`); la violazione di un vincolo SQL diventa `conflict` (qui: nome duplicato → 409);
- i limiti si applicano in modo atomico nell'SQL (`INSERT … SELECT … WHERE count(*) < 50`), non con una lettura seguita da una scrittura.

## 4. Rotta HTTP — `apps/api/src/modules`

[`modules/saved-views/routes.ts`](../../apps/api/src/modules/saved-views/routes.ts) è sottile: valida, chiama il servizio, valida la risposta.

```ts
export const savedViewRoutes = new Hono<AppEnv>()
  .use('*', workspaceScope) // verifica ?workspaceId= e l'appartenenza; imposta c.get('workspaceId')
  .post('/', async (c) => {
    const input = await parseJsonBody(c, createSavedViewInput); // 400 se non valido
    const view = await createSavedView(
      c.env.DB,
      c.get('db'),
      c.get('workspaceId'),
      input,
      Date.now(),
    );
    return c.json(savedViewResponse.parse({ view }), 201);
  });
```

- Registra il modulo in [`app.ts`](../../apps/api/src/app.ts): `v1.route('/views', savedViewRoutes)`. L'autenticazione è già applicata a tutto `/api/v1`.
- Gli ID nel percorso si leggono con `idParam(c)` (un ID malformato dà 404).
- Ogni richiesta che modifica dati, anche `DELETE`, ha un corpo JSON (`{}` se vuoto): è la protezione CSRF di `middleware/guards.ts`.
- Aggiungi la riga dell'endpoint in [API-CONTRACTS](../architecture/API-CONTRACTS.md).

## 5. Test dell'API — `apps/api/test`

I test girano in un Worker reale (miniflare) con un D1 temporaneo: non toccano i tuoi dati. Il modello è [`saved-views.test.ts`](../../apps/api/test/saved-views.test.ts):

```ts
const { api } = await newUser('sv@example.com'); // utente + workspace + client già legato al workspace
const created = await api.post('/views', { name: 'Remoto', params: 'mode=remote' });
expect(created.status).toBe(201);
```

Copri sempre tre casi: il percorso felice, la validazione (400 o 409) e l'**isolamento**: un secondo utente riceve 404 sulle risorse del primo. Esegui con `pnpm --filter @jobward/api test -- saved-views`.

## 6. Dati nel client — `apps/web/src/features/<area>/api.ts`

[`features/saved-views/api.ts`](../../apps/web/src/features/saved-views/api.ts) espone degli hook TanStack Query:

```ts
const viewsKey = (ws: string) => ['saved-views', ws] as const; // la chiave include il workspace
export function useSavedViews() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: viewsKey(workspace.id),
    queryFn: ({ signal }) =>
      apiRequest(scoped(workspace.id, '/views'), savedViewsResponse, { signal }),
    select: (d) => d.views,
  });
}
```

- `apiRequest(path, schema, options)` di [`lib/api.ts`](../../apps/web/src/lib/api.ts) aggiunge `/api/v1`, gli header e la validazione della risposta; un errore diventa un `ApiError` con il messaggio del server.
- `scoped(workspaceId, path)` aggiunge `?workspaceId=`.
- Dopo una mutazione invalida le chiavi interessate (`invalidateQueries`). Se il dato compare in Overview o Insights, invalida anche quelle chiavi.

## 7. Interfaccia — `apps/web/src/features` e `apps/web/src/routes`

- I componenti dell'area stanno in `features/<area>/`; una pagina nuova è un file in `routes/` più una voce in `router.tsx` e, se va nel menu, in `layouts/nav.ts`. Mappa delle rotte: [FRONTEND](../architecture/FRONTEND.md).
- Usa i componenti di base del [catalogo](../ux/COMPONENTS.md) (`Button`, `Dialog`, `ConfirmDialog`, `SegmentedControl`, …) e i **token** del [design system](../ux/design-system.md): niente colori esadecimali nel codice, il contrasto è verificato da `pnpm check:contrast`.
- I testi sono in italiano, brevi, con verbi d'azione. Ogni controllo ha un nome accessibile, le azioni distruttive passano da `ConfirmDialog`, gli errori sono in un elemento `role="alert"`.

## 8. Test dell'interfaccia

- **Componenti** (Vitest + Testing Library, ambiente jsdom): `mockApi` sostituisce `fetch` con risposte per `"METODO /percorso"`, `renderApp('/percorso')` monta l'app intera. Esempio: [`data-profile-settings.test.tsx`](../../apps/web/src/features/workspace/data-profile-settings.test.tsx). Cerca gli elementi per ruolo e nome (`getByRole('button', { name: 'Rigenera dati demo' })`), non per classe.
- **E2E** (Playwright, `apps/web/e2e`): solo per i percorsi principali e per ciò che jsdom non vede (layout, trascinamento, scorrimento). Girano su un D1 dedicato: `pnpm test:e2e` (~20 min).

## 9. Documentazione e chiusura

Nello stesso commit aggiorna:

| Documento                                                 | Quando                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| [API-CONTRACTS](../architecture/API-CONTRACTS.md)         | nuovo o modificato endpoint              |
| [DATA-MODEL](../architecture/DATA-MODEL.md)               | nuova tabella o colonna                  |
| specifica dell'area in [features](../features/INDEX.md)   | nuove regole di comportamento            |
| [FEATURE-MATRIX](../status/FEATURE-MATRIX.md)             | stato della capacità                     |
| [CHANGE-IMPACT](../architecture/CHANGE-IMPACT.md)         | nuovi dipendenti o test                  |
| [guida utente](../user/USER-GUIDE.md)                     | la funzione è visibile a chi usa l'app   |
| [`services/demo.ts`](../../apps/api/src/services/demo.ts) | la funzione deve comparire nei Dati demo |

Poi: `pnpm exec prettier --write <file toccati>` e `pnpm check` (typecheck, lint, formato, contrasto, documentazione, migrazioni, test, build: ~2–3 min). Commit e push solo con autorizzazione del proprietario ([WORKFLOW](../agents/WORKFLOW.md)).
