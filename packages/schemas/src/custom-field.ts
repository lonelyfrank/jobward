import { LIMITS } from '@meet-roulette/shared';
import { z } from 'zod';
import { calendarDate, colorToken, httpUrl, requiredText } from './primitives';

const selectOption = z.object({
  /** Identificativo stabile: rinominare un'opzione non invalida i valori già salvati. */
  id: z.string().min(1).max(64),
  label: requiredText(LIMITS.nameMax),
  color: colorToken.nullable().default(null),
});
export type SelectOption = z.infer<typeof selectOption>;

const selectConfig = z.object({
  options: z
    .array(selectOption)
    .min(1, 'Aggiungi almeno un’opzione')
    .max(100)
    .refine((opts) => new Set(opts.map((o) => o.id)).size === opts.length, 'ID opzione duplicato'),
});

const textConfig = z.object({ maxLength: z.number().int().positive().max(10_000).optional() });
const numberConfig = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    integerOnly: z.boolean().default(false),
  })
  .refine((c) => c.min == null || c.max == null || c.min <= c.max, 'Il minimo supera il massimo');
const emptyConfig = z.object({});

const base = {
  name: requiredText(LIMITS.nameMax),
  isActive: z.boolean().default(true),
};

/**
 * Definizione di un campo personalizzato, discriminata dal tipo: la
 * configurazione ammessa dipende dal tipo e viene validata di conseguenza.
 */
export const customFieldDefinitionInput = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), config: textConfig.default({}) }),
  z.object({ ...base, type: z.literal('long_text'), config: textConfig.default({}) }),
  z.object({
    ...base,
    type: z.literal('number'),
    config: numberConfig.default({ integerOnly: false }),
  }),
  z.object({ ...base, type: z.literal('date'), config: emptyConfig.default({}) }),
  z.object({ ...base, type: z.literal('boolean'), config: emptyConfig.default({}) }),
  z.object({ ...base, type: z.literal('single_select'), config: selectConfig }),
  z.object({ ...base, type: z.literal('multi_select'), config: selectConfig }),
  z.object({ ...base, type: z.literal('url'), config: emptyConfig.default({}) }),
]);
export type CustomFieldDefinitionInput = z.infer<typeof customFieldDefinitionInput>;

/** Valori ammessi. `null` significa "campo svuotato". */
export type CustomFieldValue = string | number | boolean | string[] | null;

/**
 * Costruisce lo schema che un valore deve rispettare per la definizione data.
 * Il tipo del dato non cambia mai in persistenza: numeri restano numeri,
 * booleani restano booleani, selezioni multiple restano array di ID.
 */
export function valueSchemaFor(
  definition: CustomFieldDefinitionInput,
): z.ZodType<CustomFieldValue> {
  switch (definition.type) {
    case 'text':
    case 'long_text': {
      const max =
        definition.config.maxLength ??
        (definition.type === 'text' ? LIMITS.shortTextMax : LIMITS.descriptionMax);
      return z.string().max(max).nullable();
    }
    case 'number': {
      const { min, max, integerOnly } = definition.config;
      let schema = z.number().finite();
      if (integerOnly) schema = schema.int();
      if (min != null) schema = schema.min(min);
      if (max != null) schema = schema.max(max);
      return schema.nullable();
    }
    case 'date':
      return calendarDate.nullable();
    case 'boolean':
      return z.boolean().nullable();
    case 'url':
      return httpUrl.nullable();
    case 'single_select': {
      const ids = new Set(definition.config.options.map((o) => o.id));
      return z
        .string()
        .refine((v) => ids.has(v), 'Opzione non valida')
        .nullable();
    }
    case 'multi_select': {
      const ids = new Set(definition.config.options.map((o) => o.id));
      return z
        .array(z.string().refine((v) => ids.has(v), 'Opzione non valida'))
        .refine((v) => new Set(v).size === v.length, 'Opzioni duplicate')
        .nullable();
    }
  }
}

export type ValueValidation =
  { success: true; value: CustomFieldValue } | { success: false; message: string };

export function validateCustomFieldValue(
  definition: CustomFieldDefinitionInput,
  raw: unknown,
): ValueValidation {
  const result = valueSchemaFor(definition).safeParse(raw);
  return result.success
    ? { success: true, value: result.data }
    : { success: false, message: result.error.issues[0]?.message ?? 'Valore non valido' };
}

/** Serializzazione per la colonna JSON del database, con round-trip senza perdita di tipo. */
export function serializeCustomFieldValue(value: CustomFieldValue): string {
  return JSON.stringify(value);
}

export function parseStoredCustomFieldValue(stored: string): CustomFieldValue {
  return JSON.parse(stored) as CustomFieldValue;
}
