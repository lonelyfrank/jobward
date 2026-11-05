import type { CardCustomField } from '@jobward/schemas';
import { DetailSection } from '@/features/cards/detail-section';
import { ValueEditor } from './value-editor';
import { draftFromValue, type FieldDraft } from './values';

/**
 * Campi personalizzati della bacheca sulla scheda. Presentazionale: bozze ed errori vivono nel
 * modulo di dettaglio, che salva tutto insieme con un solo "Salva". I campi disattivati non
 * compaiono (il server non li restituisce) ma i loro valori restano conservati.
 */
export function CardFieldsSection({
  fields,
  drafts,
  errors,
  loading,
  failed,
  disabled,
  onChange,
  onRetry,
}: {
  fields: CardCustomField[] | undefined;
  /** Solo i campi modificati dall'utente: gli altri mostrano il valore salvato. */
  drafts: Record<string, FieldDraft>;
  errors: Record<string, string>;
  loading: boolean;
  failed: boolean;
  disabled: boolean;
  onChange: (fieldId: string, draft: FieldDraft) => void;
  onRetry: () => void;
}) {
  const filled = (fields ?? []).filter((f) => f.hasValue && f.value !== null).length;
  const summary = loading
    ? 'Caricamento…'
    : failed
      ? 'Non disponibili'
      : fields?.length
        ? `${filled} di ${fields.length} compilati`
        : 'Nessun campo';

  return (
    <DetailSection
      title="Campi personalizzati"
      summary={summary}
      defaultOpen={filled > 0}
      hasError={Object.keys(errors).length > 0}
    >
      {loading ? (
        <p role="status" className="text-sm text-muted-foreground">
          Caricamento dei campi…
        </p>
      ) : failed ? (
        <p role="alert" className="text-sm text-danger">
          Non riusciamo a caricare i campi.{' '}
          <button type="button" className="underline" onClick={onRetry}>
            Riprova
          </button>
        </p>
      ) : !fields || fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Questa bacheca non ha campi personalizzati. Puoi crearne dal menu “Azioni bacheca” →
          “Campi personalizzati”.
        </p>
      ) : (
        fields.map(({ field, value }) => (
          <ValueEditor
            key={field.id}
            field={field}
            draft={drafts[field.id] ?? draftFromValue(field, value)}
            error={errors[field.id]}
            disabled={disabled}
            onChange={(draft) => onChange(field.id, draft)}
          />
        ))
      )}
    </DetailSection>
  );
}
