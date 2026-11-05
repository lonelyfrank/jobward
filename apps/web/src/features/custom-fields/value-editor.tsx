import type { CustomField } from '@meet-roulette/schemas';
import { LIMITS } from '@meet-roulette/shared';
import { Field } from '@/components/ui/field';
import { Input, Select } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { FieldDraft } from './values';

/**
 * Controllo di un campo personalizzato, scelto dal tipo. Usato dal pannello di dettaglio e
 * dall'anteprima del configuratore, così ciò che l'utente vede mentre configura è ciò che avrà.
 */
export function ValueEditor({
  field,
  draft,
  onChange,
  error,
  disabled = false,
  idPrefix = 'cf',
}: {
  field: CustomField;
  draft: FieldDraft;
  onChange: (draft: FieldDraft) => void;
  error?: string | undefined;
  disabled?: boolean;
  idPrefix?: string;
}) {
  const id = `${idPrefix}-${field.id}`;
  const text = typeof draft === 'string' ? draft : '';
  const describedBy = error ? `${id}-error` : undefined;
  const invalid = error ? true : undefined;

  if (field.type === 'multi_select') {
    const selected = Array.isArray(draft) ? draft : [];
    return (
      <fieldset
        className="space-y-1.5"
        disabled={disabled}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      >
        <legend className="text-sm font-medium">{field.name}</legend>
        <ul className="space-y-0.5">
          {field.config.options.map((option) => (
            <li key={option.id}>
              <label className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-md px-1 hover:bg-surface-muted max-md:min-h-11">
                <input
                  type="checkbox"
                  className="size-4"
                  checked={selected.includes(option.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked
                        ? [...selected, option.id]
                        : selected.filter((v) => v !== option.id),
                    )
                  }
                />
                <span className="text-sm">{option.label}</span>
              </label>
            </li>
          ))}
        </ul>
        {error ? (
          <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
            {error}
          </p>
        ) : null}
      </fieldset>
    );
  }

  let control;
  switch (field.type) {
    case 'long_text':
      control = (
        <Textarea
          id={id}
          value={text}
          disabled={disabled}
          maxLength={field.config.maxLength ?? LIMITS.descriptionMax}
          className="min-h-24"
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
      break;
    case 'boolean':
      control = (
        <Select
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Non indicato</option>
          <option value="true">Sì</option>
          <option value="false">No</option>
        </Select>
      );
      break;
    case 'single_select':
      control = (
        <Select
          id={id}
          value={text}
          disabled={disabled}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Non indicato</option>
          {field.config.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      );
      break;
    default:
      control = (
        <Input
          id={id}
          type={field.type === 'date' ? 'date' : field.type === 'url' ? 'url' : 'text'}
          inputMode={field.type === 'number' ? 'decimal' : field.type === 'url' ? 'url' : undefined}
          value={text}
          disabled={disabled}
          autoComplete="off"
          maxLength={
            field.type === 'url'
              ? LIMITS.urlMax
              : field.type === 'text'
                ? (field.config.maxLength ?? LIMITS.shortTextMax)
                : undefined
          }
          placeholder={field.type === 'url' ? 'https://' : undefined}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <Field id={id} label={field.name} error={error}>
      {control}
    </Field>
  );
}
