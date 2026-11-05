import { LIMITS } from '@meet-roulette/shared';
import { z } from 'zod';
import { calendarDate, colorToken, httpUrl, idSchema, requiredText } from './primitives';

const selectOption = z.object({
  /** Identificativo stabile: rinominare un'opzione non invalida i valori già salvati. */
  id: z.string().min(1).max(64),
  label: requiredText(LIMITS.nameMax),
  color: colorToken.nullable().default(null),
});
export type SelectOption = z.infer<typeof selectOption>;

const optionList = <T extends z.ZodType<{ id?: string | undefined; label: string }>>(option: T) =>
  z
    .array(option)
    .min(1, 'Aggiungi almeno un’opzione')
    .max(LIMITS.customFieldOptionsMax)
    .refine(
      (opts) => new Set(opts.map((o) => o.label.trim().toLowerCase())).size === opts.length,
      'Due opzioni hanno lo stesso nome',
    );

/** Configurazione persistita: ogni opzione ha il suo identificativo stabile. */
const selectConfig = z
  .object({
    options: optionList(selectOption).refine(
      (opts) => new Set(opts.map((o) => o.id)).size === opts.length,
      'ID opzione duplicato',
    ),
  })
  .strict();

/** In creazione/modifica l'`id` di una nuova opzione può mancare: lo assegna il server. */
const selectConfigInput = z
  .object({
    options: optionList(selectOption.extend({ id: selectOption.shape.id.optional() })),
  })
  .strict();

// Le configurazioni sono `strict`: una chiave non prevista per il tipo (es. `options` su una data)
// è un errore, non un dato ignorato in silenzio.
const textConfig = z
  .object({ maxLength: z.number().int().positive().max(10_000).optional() })
  .strict();
const numberConfig = z
  .object({
    min: z.number().optional(),
    max: z.number().optional(),
    integerOnly: z.boolean().default(false),
  })
  .strict()
  .refine((c) => c.min == null || c.max == null || c.min <= c.max, 'Il minimo supera il massimo');
const emptyConfig = z.object({}).strict();

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

/**
 * Definizione come arriva dal client: come `customFieldDefinitionInput`, ma le opzioni nuove non
 * hanno ancora un `id` (lo assegna il server; quelle esistenti lo conservano, così rinominarle
 * non invalida i valori già salvati).
 */
export const createCustomFieldInput = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('text'), config: textConfig.default({}) }).strict(),
  z.object({ ...base, type: z.literal('long_text'), config: textConfig.default({}) }).strict(),
  z
    .object({
      ...base,
      type: z.literal('number'),
      config: numberConfig.default({ integerOnly: false }),
    })
    .strict(),
  z.object({ ...base, type: z.literal('date'), config: emptyConfig.default({}) }).strict(),
  z.object({ ...base, type: z.literal('boolean'), config: emptyConfig.default({}) }).strict(),
  z.object({ ...base, type: z.literal('single_select'), config: selectConfigInput }).strict(),
  z.object({ ...base, type: z.literal('multi_select'), config: selectConfigInput }).strict(),
  z.object({ ...base, type: z.literal('url'), config: emptyConfig.default({}) }).strict(),
]);
export type CreateCustomFieldInput = z.infer<typeof createCustomFieldInput>;

/**
 * Modifica di un campo: nome, configurazione, attivo. Il TIPO non si cambia (evita conversioni
 * con perdita di dati, M2 D-5). La `config` è validata dal servizio con il tipo del campo.
 */
export const updateCustomFieldInput = z
  .object({
    name: requiredText(LIMITS.nameMax),
    config: z.record(z.string(), z.unknown()),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Nessuna modifica indicata');
export type UpdateCustomFieldInput = z.infer<typeof updateCustomFieldInput>;

/** Eliminazione definitiva: con valori salvati richiede `deleteValues` esplicito. */
export const deleteCustomFieldInput = z
  .object({ deleteValues: z.boolean().default(false) })
  .strict();
export type DeleteCustomFieldInput = z.infer<typeof deleteCustomFieldInput>;

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

// ---------------------------------------------------------------------------
// Risposte dell'API
// ---------------------------------------------------------------------------

const fieldMeta = z.object({
  id: idSchema,
  boardId: idSchema,
  position: z.number().int(),
  /** Schede che hanno un valore (anche "svuotato") per questo campo. */
  valueCount: z.number().int().nonnegative(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});

/** La configurazione in uscita è validata per tipo, come in ingresso. */
export const customFieldSchema = z.intersection(customFieldDefinitionInput, fieldMeta);
export type CustomField = z.infer<typeof customFieldSchema>;

export const customFieldValueSchema: z.ZodType<CustomFieldValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

export const putCustomFieldValueInput = z.object({ value: z.unknown() }).strict();

export const customFieldsResponse = z.object({ fields: z.array(customFieldSchema) });
export const customFieldResponse = z.object({ field: customFieldSchema });

/** Un campo di una scheda con il suo valore. `hasValue` distingue "mai compilato" da `null` svuotato. */
export const cardCustomFieldSchema = z.object({
  field: customFieldSchema,
  value: customFieldValueSchema,
  hasValue: z.boolean(),
});
export type CardCustomField = z.infer<typeof cardCustomFieldSchema>;
export const cardCustomFieldsResponse = z.object({ fields: z.array(cardCustomFieldSchema) });
export const cardCustomFieldResponse = z.object({ field: cardCustomFieldSchema });
