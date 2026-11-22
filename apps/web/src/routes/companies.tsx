import { Building2, Search } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { Surface } from '@/components/ui/surface';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { useCompanies } from '@/features/companies/api';
import { useWorkspace } from '@/features/workspace/context';
import { formatDateTime } from '@/lib/format';

/** Aziende (B-05): ogni azienda con le sue opportunità e candidature, dal nome scritto sulle schede. */
export function Component() {
  const { workspace } = useWorkspace();
  const companies = useCompanies();
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = (companies.data ?? []).filter((c) => c.name.toLowerCase().includes(term));
  return (
    <>
      <WorkspacePageHeader
        title="Aziende"
        description="Le aziende a cui ti sei interessato, con opportunità e candidature collegate."
      />
      {companies.isError ? (
        <Surface className="p-6" role="alert">
          Impossibile caricare le aziende.
        </Surface>
      ) : companies.isPending ? (
        <p className="text-sm text-muted-foreground">Caricamento…</p>
      ) : (companies.data ?? []).length === 0 ? (
        <EmptyState
          icon={Building2}
          title="Nessuna azienda ancora"
          description="Scrivi il nome dell’azienda su un’opportunità: la trovi qui, collegata a tutte le opportunità con lo stesso nome."
        />
      ) : (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <label htmlFor="company-search" className="sr-only">
              Cerca un’azienda
            </label>
            <Input
              id="company-search"
              type="search"
              value={q}
              placeholder="Cerca un’azienda"
              className="pl-8"
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((c) => (
              <li key={c.id}>
                <Link
                  to={`/companies/${c.id}`}
                  className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-hover-soft"
                >
                  <span className="flex items-center gap-2 font-semibold">
                    <Building2 aria-hidden="true" className="size-4 text-muted-foreground" />
                    {c.name}
                  </span>
                  <span className="mt-2 block text-sm text-muted-foreground">
                    {c.opportunities} {c.opportunities === 1 ? 'opportunità' : 'opportunità'} ·{' '}
                    {c.applications} {c.applications === 1 ? 'candidatura' : 'candidature'}
                    {c.activeApplications > 0 ? ` (${c.activeApplications} in corso)` : ''}
                  </span>
                  {c.lastActivityAt ? (
                    <span className="mt-1 block text-xs text-muted-foreground">
                      Ultima attività: {formatDateTime(c.lastActivityAt, workspace.timezone)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessuna azienda corrisponde alla ricerca.
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}
