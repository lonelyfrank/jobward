# Catalogo dei componenti

**Stato:** canonico · **Codice:** `apps/web/src/components/ui` (e `components/brand`). Che cosa usare per ogni bisogno, con le proprietà principali e un esempio. Colori, tipografia e contrasto: [design system](design-system.md). Struttura delle pagine e rotte: [FRONTEND](../architecture/FRONTEND.md). Importa sempre da `@/components/ui/<file>`.

## Quale componente scegliere

| Bisogno                                                | Componente                                           |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Azione, pulsante, collegamento con aspetto da pulsante | `Button` (`asChild` con un `<Link>`)                 |
| Campo di modulo con etichetta ed errore                | `Field` + `Input` / `Select` / `Textarea`            |
| Scelta fra 2–4 opzioni sempre visibili                 | `SegmentedControl`                                   |
| Sezioni della stessa pagina o finestra                 | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`     |
| Modulo o dettaglio sopra la pagina                     | `Dialog` (+ `DialogBody`, `DialogFooter`)            |
| Conferma di un'azione distruttiva                      | `ConfirmDialog`                                      |
| Elenco di azioni secondarie                            | `DropdownMenu…`; nelle viste, `WorkspaceActionsMenu` |
| Esito di un'azione, errore in background               | `useNotify()` (avvisi di `NoticeProvider`)           |
| Stato, fase, etichetta breve                           | `Badge`                                              |
| Spiegazione al passaggio o al focus                    | `Tooltip`                                            |
| Contenitore di una sezione                             | `Surface`                                            |
| Intestazione di una vista                              | `WorkspacePageHeader`                                |
| Nessun dato da mostrare                                | `EmptyState`                                         |
| Caricamento                                            | `Skeleton`                                           |
| Navigazione su telefono                                | `Sheet`                                              |
| Passaggio animato fra due contenuti                    | `ViewSwap`                                           |

## Azioni

**`Button`** — `variant`: `primary` (una sola per area: l'azione principale), `secondary`, `ghost` (barre e toolbar), `danger` (eliminazioni); `size`: `sm`, `md` (predefinita), `icon` (solo icona: serve `aria-label`). Il tipo predefinito è `button`, quindi non invia moduli per sbaglio; su telefono l'area di tocco è ≥ 44 px. `buttonVariants()` dà le stesse classi a un elemento diverso.

```tsx
<Button variant="secondary" onClick={save} disabled={pending}>
  <RefreshCw aria-hidden="true" /> Rigenera dati demo
</Button>
<Button asChild variant="ghost"><Link to="/settings">Impostazioni</Link></Button>
<Button size="icon" variant="ghost" aria-label="Chiudi"><X aria-hidden="true" /></Button>
```

**`DropdownMenu`** — involucri di Radix: `DropdownMenu`, `DropdownMenuTrigger` (con `asChild` su un `Button`), `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuLabel`, `DropdownMenuSeparator`, `DropdownMenuRadioGroup` / `DropdownMenuRadioItem`. Tastiera e focus sono già gestiti.

**`WorkspaceActionsMenu`** — menu «⋯» delle viste. Riceve `actions: WorkspaceAction[]` (`id`, `label`, `group`, `icon?`, `disabled?`, `danger?`, `onSelect`). I gruppi hanno un ordine fisso (`create`, `navigate`, `view`, `manage`, `danger`), quindi una voce occupa sempre la stessa posizione in ogni vista.

## Moduli

**`Field`** — etichetta + controllo + suggerimento + errore. L'`id` deve coincidere con quello del controllo. L'errore ha `role="alert"`; collega `aria-invalid` e `aria-describedby` sul controllo.

```tsx
<Field id="view-name" label="Nome" error={errors.name}>
  <Input
    id="view-name"
    value={name}
    onChange={(e) => setName(e.target.value)}
    aria-invalid={Boolean(errors.name)}
    aria-describedby={errors.name ? 'view-name-error' : undefined}
  />
</Field>
```

**`Input`, `Select`, `Textarea`** — elementi nativi con lo stile del design system; accettano tutte le proprietà HTML.

**`SegmentedControl`** — `label` (nome accessibile del gruppo), `value` (opzione attiva: fa scorrere il fondino), `as` (`div` o `nav`). I figli sono pulsanti con `aria-pressed`. Esempio completo: [`data-profile-settings.tsx`](../../apps/web/src/features/workspace/data-profile-settings.tsx).

## Finestre e pannelli

**`Dialog`** — `open`, `onOpenChange`, `title` (obbligatorio: è il nome accessibile), `description?`, `variant`:

| `variant`          | Uso                                                                               |
| ------------------ | --------------------------------------------------------------------------------- |
| `center` (default) | moduli brevi; su telefono occupa la larghezza                                     |
| `drawer`           | pannello laterale; a schermo intero su telefono                                   |
| `workspace`        | dettaglio ampio della candidatura, con intestazione propria (`DialogCloseButton`) |
| `search`           | ricerca globale                                                                   |

Dentro: `DialogBody` (parte che scorre) e `DialogFooter` (azioni). Focus trap, Esc e ripristino del focus sono gestiti da Radix.

**`ConfirmDialog`** — per ogni azione distruttiva o irreversibile. Il focus iniziale va su «Annulla», ed Esc o un clic esterno non confermano mai. Proprietà: `title`, `description`, `confirmLabel`, `cancelLabel?`, `pending?` (pulsante in attesa durante la richiesta), `confirmDisabled?`, `error?`, `onConfirm`. La chiusura la decide il chiamante, dopo l'esito.

```tsx
<ConfirmDialog
  open={confirming}
  onOpenChange={setConfirming}
  title="Rigenerare i dati demo?"
  description="Le modifiche fatte nella demo vengono cancellate."
  confirmLabel="Rigenera"
  pending={pending}
  onConfirm={() => void reset()}
/>
```

**`Sheet`** — pannello laterale modale per la navigazione su telefono; `returnFocusRef` riporta il focus al pulsante che lo ha aperto.

## Contenuti e stato

**`Badge`** — `tone`: `neutral`, `primary`, `success`, `info`, `teal`, `warning`, `danger`. Il colore non è mai l'unica informazione: il testo dice lo stato.

**`Tooltip`** — `content` (testo), `side?`, `disabled?`. Compare al passaggio del mouse e al focus da tastiera, mai dopo un focus riportato dal codice. Non metterci informazioni che non si trovano altrove.

```tsx
<Tooltip content="Aggiungi opportunità">
  <Button size="icon" aria-label="Aggiungi opportunità">
    <Plus aria-hidden="true" />
  </Button>
</Tooltip>
```

**`Tabs`** — `TabsList` con `variant` `underline` (predefinita) o `pill`. I pannelli restano montati: cambiando scheda le bozze dei moduli non si perdono. Su schermi stretti la lista scorre in orizzontale.

**`EmptyState`** — `icon` (Lucide), `title`, `description`, `milestone?` (dichiara che la funzione arriverà più avanti), `children?` (un'azione **reale**, mai un pulsante finto).

**`Skeleton`** — segnaposto di caricamento nascosto agli screen reader; dagli la forma del contenuto con `className`.

**`Surface`** — contenitore con bordo e fondo del tema: la «carta» di ogni sezione (`<Surface className="p-5">`).

**`WorkspacePageHeader`** — intestazione delle viste: `title`, `description?`, `backLink?`, `navigation?` (schede della vista), `controls?` (filtri), `actions?` (menu ⋯), `canCreateCard?` / `boardId?` (pulsante «nuova opportunità»), `compact?`.

**`ViewSwap`** — `viewKey` (cambia quando cambia il contenuto), `direction` (`forward` / `back`): dissolvenza e altezza animata, ferma con `prefers-reduced-motion`.

**`useNotify()`** — `notify(tone, message, action?)` con `tone` `success`, `info` o `error`. Gli errori restano finché non vengono chiusi (`role="alert"`); successi e informazioni spariscono da soli (`role="status"`). Per il testo di un errore dell'API usa `userMessage(error, 'Messaggio di riserva')` da `features/kanban/mutations.ts`.

**`UserAvatar`** (`email`), **`LogoMark`** / **`Wordmark`** (`components/brand/logo.tsx`): identità visiva, già usati nel layout.

## Regole comuni

- Nessun colore esadecimale o classe di colore Tailwind grezza: usa i token (`bg-surface`, `text-muted-foreground`, `text-danger`, …). Li controlla `pnpm check:contrast`.
- Le icone decorative hanno `aria-hidden="true"`; un pulsante con sola icona ha `aria-label`.
- Un componente nuovo va qui solo se serve in almeno due aree; altrimenti resta in `features/<area>/`. Aggiungendolo, aggiorna questo catalogo.
