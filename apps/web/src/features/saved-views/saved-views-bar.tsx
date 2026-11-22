import type { SavedView } from '@jobward/schemas';
import { Bookmark, BookmarkPlus, MoreHorizontal } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogFooter } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { ApiRequestError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { useSavedViewMutations, useSavedViews } from './api';

const message = (error: unknown) =>
  error instanceof ApiRequestError ? error.message : 'Operazione non riuscita: riprova.';

/** Normalizza una query string per confrontarla (ordine dei parametri irrilevante). */
const canonical = (params: string) => [...new URLSearchParams(params).entries()].sort().join('&');

/**
 * Viste salvate dell'Opportunity Center (D-04): scorciatoie verso combinazioni di ambito, ricerca, filtri e
 * ordinamento. `current` è lo stato attuale dell'indirizzo (senza «?»).
 */
export function SavedViewsBar({ current, basePath }: { current: string; basePath: string }) {
  const views = useSavedViews();
  const { create, update, remove } = useSavedViewMutations();
  const notify = useNotify();
  const [dialog, setDialog] = useState<
    { mode: 'create' } | { mode: 'rename'; view: SavedView } | null
  >(null);
  const [name, setName] = useState('');
  const list = views.data ?? [];
  const active = list.find((v) => canonical(v.params) === canonical(current)) ?? null;
  const canSave = current !== '' && active === null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!dialog || name.trim() === '') return;
    try {
      if (dialog.mode === 'create') {
        await create.mutateAsync({ name: name.trim(), params: current });
        notify('success', `Vista «${name.trim()}» salvata.`);
      } else {
        await update.mutateAsync({ id: dialog.view.id, input: { name: name.trim() } });
        notify('success', 'Vista rinominata.');
      }
      setDialog(null);
    } catch (error) {
      notify('error', message(error));
    }
  };

  if (views.isError) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Viste salvate" role="group">
      <span className="flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        <Bookmark aria-hidden="true" className="size-3.5" />
        Viste
      </span>
      {list.map((view) => (
        <span
          key={view.id}
          className={cn(
            'inline-flex items-center rounded-full border text-sm',
            active?.id === view.id
              ? 'border-primary bg-primary-soft text-primary-soft-foreground'
              : 'border-border bg-surface',
          )}
        >
          <Link
            to={`${basePath}${view.params ? `?${view.params}` : ''}`}
            aria-current={active?.id === view.id ? 'true' : undefined}
            className="py-1 pr-1 pl-3 font-medium hover:underline max-md:py-2.5"
          >
            {view.name}
          </Link>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="mr-1 grid size-6 place-items-center rounded-full hover:bg-hover-soft max-md:size-10"
                aria-label={`Azioni della vista «${view.name}»`}
              >
                <MoreHorizontal aria-hidden="true" className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem
                disabled={current === view.params}
                onSelect={() =>
                  void update
                    .mutateAsync({ id: view.id, input: { params: current } })
                    .then(() => notify('success', `Vista «${view.name}» aggiornata.`))
                    .catch((e: unknown) => notify('error', message(e)))
                }
              >
                Aggiorna con i filtri attuali
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setName(view.name);
                  setDialog({ mode: 'rename', view });
                }}
              >
                Rinomina
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() =>
                  void remove
                    .mutateAsync(view.id)
                    .then(() => notify('success', `Vista «${view.name}» eliminata.`))
                    .catch((e: unknown) => notify('error', message(e)))
                }
              >
                Elimina
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      ))}
      {canSave ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setName('');
            setDialog({ mode: 'create' });
          }}
        >
          <BookmarkPlus aria-hidden="true" className="size-4" />
          Salva vista
        </Button>
      ) : list.length === 0 ? (
        <span className="text-xs text-muted-foreground">
          Imposta filtri o ordinamento e salvali come vista.
        </span>
      ) : null}

      {dialog ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={dialog.mode === 'create' ? 'Salva vista' : 'Rinomina vista'}
          description={
            dialog.mode === 'create'
              ? 'Salva ambito, ricerca, filtri e ordinamento attuali per ritrovarli con un clic.'
              : undefined
          }
        >
          <form noValidate onSubmit={(e) => void submit(e)} className="flex min-h-0 flex-col">
            <DialogBody>
              <Field id="saved-view-name" label="Nome della vista">
                <Input
                  id="saved-view-name"
                  value={name}
                  maxLength={60}
                  autoComplete="off"
                  placeholder="Es. Remoto, interesse alto"
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                Annulla
              </Button>
              <Button
                type="submit"
                disabled={name.trim() === '' || create.isPending || update.isPending}
              >
                Salva
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
