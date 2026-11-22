import { derivePipelineStatus, isClosedPipelineStatus } from '@jobward/shared';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useNotify } from '@/components/ui/notices';
import { Surface } from '@/components/ui/surface';
import { Textarea } from '@/components/ui/textarea';
import { WorkspacePageHeader } from '@/components/ui/workspace-page-header';
import { cardPath, NO_BOARD_LABEL } from '@/features/cards/card-path';
import { useCompany, useUpdateCompany } from '@/features/companies/api';
import { STATUS_LABELS } from '@/features/pipeline/presentation';
import { ApiRequestError } from '@/lib/api';

/** Dettaglio di un'azienda: dati modificabili e tutte le opportunità collegate (anche archiviate). */
export function Component() {
  const { companyId = '' } = useParams();
  const detail = useCompany(companyId);
  const update = useUpdateCompany(companyId);
  const notify = useNotify();
  const [form, setForm] = useState<{ name: string; website: string; notes: string } | null>(null);

  if (detail.isPending) return <p className="text-sm text-muted-foreground">Caricamento…</p>;
  if (detail.isError) {
    return (
      <Surface className="p-6" role="alert">
        Azienda non trovata.{' '}
        <Link to="/companies" className="underline">
          Torna alle aziende
        </Link>
      </Surface>
    );
  }
  const { company, opportunities } = detail.data;
  const values = form ?? {
    name: company.name,
    website: company.website ?? '',
    notes: company.notes ?? '',
  };
  const dirty =
    values.name !== company.name ||
    values.website !== (company.website ?? '') ||
    values.notes !== (company.notes ?? '');

  const save = async () => {
    try {
      await update.mutateAsync({
        ...(values.name !== company.name ? { name: values.name.trim() } : {}),
        ...(values.website !== (company.website ?? '')
          ? { website: values.website.trim() === '' ? null : values.website.trim() }
          : {}),
        ...(values.notes !== (company.notes ?? '') ? { notes: values.notes } : {}),
      });
      setForm(null);
      notify('success', 'Azienda aggiornata.');
    } catch (error) {
      notify(
        'error',
        error instanceof ApiRequestError ? error.message : 'Salvataggio non riuscito.',
      );
    }
  };

  return (
    <>
      <Link
        to="/companies"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Aziende
      </Link>
      <WorkspacePageHeader
        title={company.name}
        description={`${company.opportunities} opportunità attive · ${company.applications} candidature`}
      />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Surface className="space-y-4 p-5">
          <h2 className="text-base font-semibold">Informazioni</h2>
          <Field id="company-name" label="Nome">
            <Input
              id="company-name"
              value={values.name}
              maxLength={120}
              onChange={(e) => setForm({ ...values, name: e.target.value })}
            />
          </Field>
          <Field id="company-website" label="Sito">
            <Input
              id="company-website"
              type="url"
              inputMode="url"
              value={values.website}
              placeholder="https://"
              onChange={(e) => setForm({ ...values, website: e.target.value })}
            />
          </Field>
          {company.website ? (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="-mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
            >
              Apri il sito <ExternalLink aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> (si apre in una nuova scheda)</span>
            </a>
          ) : null}
          <Field id="company-notes" label="Note">
            <Textarea
              id="company-notes"
              value={values.notes}
              maxLength={4000}
              className="min-h-28"
              placeholder="Referenti, cultura, impressioni dai colloqui…"
              onChange={(e) => setForm({ ...values, notes: e.target.value })}
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => void save()} disabled={!dirty || update.isPending}>
              Salva
            </Button>
            {dirty ? (
              <Button variant="ghost" onClick={() => setForm(null)}>
                Annulla
              </Button>
            ) : null}
          </div>
        </Surface>

        <Surface className="p-5">
          <h2 className="text-base font-semibold">Opportunità e candidature</h2>
          <ul className="mt-3 divide-y divide-border">
            {opportunities.map((o) => {
              const status = derivePipelineStatus(o);
              return (
                <li key={o.id} className="py-3">
                  <Link to={cardPath(o)} className="font-medium hover:underline">
                    {o.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <Badge
                      tone={
                        isClosedPipelineStatus(status) || status === 'archived' ? 'neutral' : 'info'
                      }
                    >
                      {o.applicationCount === 0 ? 'Da candidare' : STATUS_LABELS[status]}
                    </Badge>
                    {o.applicationCount > 1 ? (
                      <Badge tone="primary">{o.applicationCount} candidature</Badge>
                    ) : null}
                    <span className="text-muted-foreground">{o.boardName ?? NO_BOARD_LABEL}</span>
                    {o.company && o.company !== company.name ? (
                      <span className="text-muted-foreground">· scritta «{o.company}»</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </Surface>
      </div>
    </>
  );
}
