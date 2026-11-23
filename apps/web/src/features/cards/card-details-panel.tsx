import type { Card, CardCustomField } from '@jobward/schemas';
import {
  CONTRACT_TYPES,
  formatCoordinates,
  LIMITS,
  SALARY_BASES,
  SALARY_PERIODS,
  SENIORITY_LEVELS,
  WORK_MODES,
} from '@jobward/shared';
import {
  Banknote,
  Briefcase,
  Building2,
  CalendarDays,
  ChartNoAxesColumn,
  Clock,
  Crosshair,
  ExternalLink,
  FileText,
  Heart,
  House,
  Link2,
  ListChecks,
  MapPin,
  NotebookText,
  Pencil,
  SlidersHorizontal,
  Tag,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ValueEditor } from '@/features/custom-fields/value-editor';
import { displayValue, draftFromValue, type FieldDraft } from '@/features/custom-fields/values';
import { COORDINATES_HINT } from '@/features/places/coordinates';
import { cn } from '@/lib/cn';
import { formatCalendarDate } from '@/lib/format';
import {
  BASIS_LABELS,
  CONTRACT_LABELS,
  INTEREST_LABELS,
  PERIOD_LABELS,
  SENIORITY_LABELS,
  WORK_MODE_LABELS,
} from '@/lib/labels';
import { formatSalary } from '@/lib/salary';
import type { CardDraft, DraftErrors } from './card-form';

const labelled = <T extends string>(values: readonly T[], labels: Record<T, string>) =>
  values.map((value) => ({ value, label: labels[value] }));

/** Gruppo di campi: scheda bianca con icona e titolo. `wide` occupa entrambe le colonne. */
function Group({
  icon,
  title,
  wide = false,
  children,
}: {
  icon: ReactNode;
  title: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className={cn(
        '@container min-w-0 rounded-2xl border border-border bg-surface p-4',
        wide && '@xl/details:col-span-2',
      )}
    >
      <h3 className="mb-3 flex items-center gap-2.5 text-[17px] font-bold">
        <span aria-hidden="true" className="text-primary-soft-foreground [&_svg]:size-5">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

/** Campo in lettura: piastrina con l'icona, etichetta piccola e valore. */
function ViewField({
  icon,
  label,
  children,
  span = false,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  span?: boolean;
}) {
  const empty = children === null || children === undefined || children === '';
  return (
    <div
      className={cn('relative min-h-8 min-w-0 pl-[2.625rem]', span && '@min-[18rem]:col-span-2')}
    >
      <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
        <span
          aria-hidden="true"
          className="absolute top-0 left-0 grid size-8 place-items-center rounded-[9px] bg-surface-muted text-muted-foreground [&_svg]:size-4"
        >
          {icon}
        </span>
        {label}
      </dt>
      <dd
        className={cn(
          'text-sm font-semibold whitespace-pre-wrap [overflow-wrap:anywhere]',
          empty && 'font-normal text-muted-foreground',
        )}
      >
        {empty ? 'Non indicato' : children}
      </dd>
    </div>
  );
}

const viewGrid = 'grid gap-x-3.5 gap-y-4 @min-[18rem]:grid-cols-2';
const editGrid = 'grid gap-4 @md:grid-cols-2';

export interface CustomFieldsState {
  fields: CardCustomField[] | undefined;
  drafts: Record<string, FieldDraft>;
  errors: Record<string, string>;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onChange: (fieldId: string, draft: FieldDraft) => void;
}

/**
 * Scheda «Dettagli»: in lettura i campi sono raggruppati con icona ed etichetta; «Modifica» apre gli
 * stessi gruppi in modifica. Il salvataggio è quello unico della modale (barra in basso): ciò che si
 * scrive qui si salva insieme alle modifiche delle altre schede.
 */
export function CardDetailsPanel({
  card,
  draft,
  errors,
  editing,
  archived,
  cities,
  custom,
  onEdit,
  onDone,
  set,
}: {
  card: Card;
  draft: CardDraft;
  errors: DraftErrors;
  editing: boolean;
  archived: boolean;
  /** Città già usate, come suggerimenti: la stessa città si scrive sempre allo stesso modo. */
  cities: string[];
  custom: CustomFieldsState;
  onEdit: () => void;
  /** Chiude la modifica; `null` quando non si può (bozza da salvare o annullare). */
  onDone: (() => void) | null;
  set: <K extends keyof CardDraft>(key: K, value: CardDraft[K]) => void;
}) {
  const text = (
    key: keyof CardDraft,
    label: string,
    icon: ReactNode,
    extra: {
      max?: number;
      hint?: string;
      placeholder?: string;
      type?: string;
      inputMode?: 'url' | 'numeric';
      list?: string;
      span?: boolean;
    } = {},
  ) => (
    <div className={cn('min-w-0', extra.span && '@md:col-span-2')}>
      <Field id={`card-${key}`} label={label} icon={icon} hint={extra.hint} error={errors[key]}>
        <Input
          id={`card-${key}`}
          type={extra.type ?? 'text'}
          {...(extra.inputMode ? { inputMode: extra.inputMode } : {})}
          {...(extra.list ? { list: extra.list } : {})}
          value={draft[key]}
          maxLength={extra.max ?? LIMITS.nameMax}
          autoComplete="off"
          placeholder={extra.placeholder}
          className="rounded-xl"
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={
            errors[key] ? `card-${key}-error` : extra.hint ? `card-${key}-hint` : undefined
          }
          onChange={(e) => set(key, e.target.value as never)}
        />
      </Field>
    </div>
  );
  const choice = (
    key: keyof CardDraft,
    label: string,
    icon: ReactNode,
    options: readonly { value: string; label: string }[],
    emptyLabel = 'Non indicato',
    hint?: string,
  ) => (
    <div className="min-w-0">
      <Field id={`card-${key}`} label={label} icon={icon} hint={hint} error={errors[key]}>
        <Select
          id={`card-${key}`}
          value={draft[key]}
          className="rounded-xl"
          aria-invalid={errors[key] ? true : undefined}
          aria-describedby={
            errors[key] ? `card-${key}-error` : hint ? `card-${key}-hint` : undefined
          }
          onChange={(e) => set(key, e.target.value as never)}
        >
          <option value="">{emptyLabel}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
  const area = (
    key: 'requirements' | 'benefits' | 'description',
    label: string,
    icon: ReactNode,
  ) => (
    <Field id={`card-${key}`} label={label} icon={icon} error={errors[key]}>
      <Textarea
        id={`card-${key}`}
        value={draft[key]}
        maxLength={LIMITS.descriptionMax}
        className="min-h-24 rounded-xl"
        onChange={(e) => set(key, e.target.value)}
      />
    </Field>
  );

  const coordinates =
    card.latitude !== null && card.longitude !== null
      ? formatCoordinates({ latitude: card.latitude, longitude: card.longitude })
      : null;
  const fields = custom.fields ?? [];

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 z-10 -mx-1 flex flex-wrap items-center gap-3 bg-surface-muted px-1 py-1 md:-top-6 lg:bg-surface">
        <h2 className="flex-1 text-[17px] font-bold">Dettagli dell’annuncio</h2>
        {archived ? null : editing ? (
          onDone ? (
            <Button variant="secondary" size="sm" className="rounded-xl" onClick={onDone}>
              Fine modifica
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground max-sm:hidden">
              Salva o annulla dalla barra in basso.
            </p>
          )
        ) : (
          <Button variant="secondary" size="sm" className="rounded-xl" onClick={onEdit}>
            <Pencil aria-hidden="true" />
            Modifica
          </Button>
        )}
      </div>

      {editing ? (
        <div className="@container/details grid items-start gap-4">
          <Group icon={<Briefcase />} title="Opportunità">
            <div className={editGrid}>
              {text('title', 'Titolo', <Tag />, { max: LIMITS.titleMax, span: true })}
              {text('company', 'Azienda o ente', <Building2 />)}
              {text('jobTitle', 'Posizione lavorativa', <Briefcase />, {
                hint: 'Il ruolo come scritto nell’annuncio.',
              })}
              {choice(
                'seniority',
                'Livello di esperienza',
                <ChartNoAxesColumn />,
                labelled(SENIORITY_LEVELS, SENIORITY_LABELS),
              )}
              {choice(
                'interest',
                'Il tuo interesse',
                <Heart />,
                ([1, 2, 3, 4, 5] as const).map((v) => ({
                  value: String(v),
                  label: INTEREST_LABELS[v],
                })),
                'Non valutato',
                'Una tua valutazione personale, mai calcolata.',
              )}
            </div>
          </Group>

          <Group icon={<MapPin />} title="Luogo">
            <div className={editGrid}>
              {text('location', 'Sede', <MapPin />)}
              {text('city', 'Città', <Building2 />, {
                max: LIMITS.cityMax,
                placeholder: 'Milano',
                hint: 'Serve al filtro «Città» delle opportunità e della Mappa.',
                list: 'card-city-options',
              })}
              {choice(
                'workMode',
                'Modalità di lavoro',
                <House />,
                labelled(WORK_MODES, WORK_MODE_LABELS),
              )}
              {text('coordinates', 'Coordinate', <Crosshair />, {
                max: LIMITS.urlMax,
                placeholder: '45.4642, 9.19',
                hint: `Della sede di lavoro. ${COORDINATES_HINT} Servono alla vista Mappa delle opportunità.`,
              })}
            </div>
            <datalist id="card-city-options">
              {cities.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </Group>

          <Group icon={<Banknote />} title="Contratto e retribuzione">
            <div className="space-y-4">
              {choice(
                'contractType',
                'Tipo di contratto',
                <FileText />,
                labelled(CONTRACT_TYPES, CONTRACT_LABELS),
              )}
              <fieldset className="space-y-3">
                <legend className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  <Banknote aria-hidden="true" className="size-3.5" />
                  Retribuzione
                </legend>
                <div className="grid gap-3 @md:grid-cols-2">
                  {text('salaryMin', 'Minima', null, {
                    max: 12,
                    inputMode: 'numeric',
                    placeholder: '1800',
                  })}
                  {text('salaryMax', 'Massima', null, {
                    max: 12,
                    inputMode: 'numeric',
                    placeholder: '2200',
                  })}
                </div>
                <div className="grid gap-3 @md:grid-cols-3">
                  {text('currency', 'Valuta', null, { max: 3, placeholder: 'EUR' })}
                  {choice(
                    'salaryPeriod',
                    'Periodicità',
                    null,
                    labelled(SALARY_PERIODS, PERIOD_LABELS),
                    'Non indicata',
                  )}
                  {choice(
                    'salaryBasis',
                    'Lordo o netto',
                    null,
                    labelled(SALARY_BASES, BASIS_LABELS),
                    'Non specificato',
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Importi interi, nella valuta indicata (nessuna conversione). Se non scegli lordo o
                  netto, l’importo non sarà presentato come né l’uno né l’altro.
                </p>
              </fieldset>
            </div>
          </Group>

          <Group icon={<Link2 />} title="Annuncio">
            <div className={editGrid}>
              {text('source', 'Fonte', <Link2 />, {
                hint: 'Dove hai trovato l’annuncio (sito, contatto, passaparola).',
              })}
              {text('sourceUrl', 'Indirizzo dell’annuncio', <ExternalLink />, {
                max: LIMITS.urlMax,
                type: 'url',
                inputMode: 'url',
                placeholder: 'https://',
                hint: 'Link all’offerta originale (http o https).',
              })}
              {text('publishedOn', 'Data di pubblicazione', <CalendarDays />, { type: 'date' })}
              {text('deadlineOn', 'Scadenza dell’annuncio', <Clock />, {
                type: 'date',
                hint: 'Entro quando candidarsi. La data d’invio è nella sezione Candidature.',
              })}
            </div>
          </Group>

          <Group icon={<ListChecks />} title="Requisiti e benefit">
            <div className={editGrid}>
              {area('requirements', 'Requisiti', <ListChecks />)}
              {area('benefits', 'Benefit', <Heart />)}
            </div>
          </Group>

          <Group icon={<NotebookText />} title="Note sull’annuncio">
            {area('description', 'Note', <NotebookText />)}
          </Group>

          <Group icon={<SlidersHorizontal />} title="Campi personalizzati">
            <CustomFieldsBody custom={custom} editing />
          </Group>
        </div>
      ) : (
        <div className="@container/details grid items-start gap-4 @xl/details:grid-cols-2">
          <Group icon={<Briefcase />} title="Opportunità">
            <dl className={viewGrid}>
              <ViewField icon={<Tag />} label="Titolo" span>
                {card.title}
              </ViewField>
              <ViewField icon={<Building2 />} label="Azienda o ente">
                {card.company ? (
                  card.companyId ? (
                    <Link
                      to={`/companies/${card.companyId}`}
                      className="text-primary underline-offset-2 hover:underline"
                    >
                      {card.company}
                    </Link>
                  ) : (
                    card.company
                  )
                ) : null}
              </ViewField>
              <ViewField icon={<Briefcase />} label="Posizione lavorativa">
                {card.jobTitle}
              </ViewField>
              <ViewField icon={<ChartNoAxesColumn />} label="Livello di esperienza">
                {card.seniority ? SENIORITY_LABELS[card.seniority] : null}
              </ViewField>
              <ViewField icon={<Heart />} label="Il tuo interesse">
                {card.interest ? INTEREST_LABELS[card.interest as 1 | 2 | 3 | 4 | 5] : null}
              </ViewField>
            </dl>
          </Group>

          <Group icon={<MapPin />} title="Luogo">
            <dl className={viewGrid}>
              <ViewField icon={<MapPin />} label="Sede" span>
                {card.location}
              </ViewField>
              <ViewField icon={<Building2 />} label="Città">
                {card.city}
              </ViewField>
              <ViewField icon={<House />} label="Modalità di lavoro">
                {card.workMode ? WORK_MODE_LABELS[card.workMode] : null}
              </ViewField>
              <ViewField icon={<Crosshair />} label="Coordinate" span>
                {coordinates ? (
                  <Link
                    to={`/opportunities?layout=map`}
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {coordinates}
                    <span className="sr-only"> (apri la mappa delle opportunità)</span>
                  </Link>
                ) : null}
              </ViewField>
            </dl>
          </Group>

          <Group icon={<Banknote />} title="Contratto e retribuzione">
            <dl className={viewGrid}>
              <ViewField icon={<FileText />} label="Tipo di contratto" span>
                {card.contractType ? CONTRACT_LABELS[card.contractType] : null}
              </ViewField>
              <ViewField icon={<Banknote />} label="Retribuzione" span>
                {formatSalary(card)}
              </ViewField>
            </dl>
          </Group>

          <Group icon={<Link2 />} title="Annuncio">
            <dl className={viewGrid}>
              <ViewField icon={<Link2 />} label="Fonte">
                {card.source}
              </ViewField>
              <ViewField icon={<ExternalLink />} label="Indirizzo dell’annuncio">
                {card.sourceUrl ? (
                  <a
                    href={card.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline-offset-2 hover:underline"
                  >
                    {shortUrl(card.sourceUrl)}
                    <span className="sr-only"> (si apre in una nuova scheda)</span>
                  </a>
                ) : null}
              </ViewField>
              <ViewField icon={<CalendarDays />} label="Pubblicazione">
                {formatCalendarDate(card.publishedOn)}
              </ViewField>
              <ViewField icon={<Clock />} label="Scadenza">
                {formatCalendarDate(card.deadlineOn)}
              </ViewField>
            </dl>
          </Group>

          <Group icon={<ListChecks />} title="Requisiti e benefit" wide>
            <dl className={viewGrid}>
              <ViewField icon={<ListChecks />} label="Requisiti">
                {card.requirements}
              </ViewField>
              <ViewField icon={<Heart />} label="Benefit">
                {card.benefits}
              </ViewField>
            </dl>
          </Group>

          <Group icon={<NotebookText />} title="Note sull’annuncio" wide>
            <dl className={viewGrid}>
              <ViewField icon={<NotebookText />} label="Note" span>
                {card.description}
              </ViewField>
            </dl>
          </Group>

          {fields.length > 0 || custom.loading || custom.failed ? (
            <Group icon={<SlidersHorizontal />} title="Campi personalizzati" wide>
              <CustomFieldsBody custom={custom} editing={false} />
            </Group>
          ) : null}
        </div>
      )}
    </div>
  );
}

function CustomFieldsBody({ custom, editing }: { custom: CustomFieldsState; editing: boolean }) {
  if (custom.loading)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Caricamento dei campi…
      </p>
    );
  if (custom.failed)
    return (
      <p role="alert" className="text-sm text-danger">
        Non riusciamo a caricare i campi.{' '}
        <button type="button" className="underline" onClick={custom.onRetry}>
          Riprova
        </button>
      </p>
    );
  const fields = custom.fields ?? [];
  if (fields.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Questa bacheca non ha campi personalizzati. Puoi crearne dal menu “Azioni della vista” →
        “Campi personalizzati”.
      </p>
    );
  if (!editing)
    return (
      <dl className={viewGrid}>
        {fields.map(({ field, value }) => (
          <ViewField key={field.id} icon={<SlidersHorizontal />} label={field.name}>
            {value === null ? null : displayValue(field, value)}
          </ViewField>
        ))}
      </dl>
    );
  return (
    <div className="grid gap-4 @md:grid-cols-2">
      {fields.map(({ field, value }) => (
        <ValueEditor
          key={field.id}
          field={field}
          draft={custom.drafts[field.id] ?? draftFromValue(field, value)}
          error={custom.errors[field.id]}
          onChange={(next) => custom.onChange(field.id, next)}
        />
      ))}
    </div>
  );
}

const shortUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === '/' ? '' : parsed.pathname;
    const text = `${parsed.hostname.replace(/^www\./, '')}${path}`;
    return text.length > 42 ? `${text.slice(0, 40)}…` : text;
  } catch {
    return url;
  }
};
