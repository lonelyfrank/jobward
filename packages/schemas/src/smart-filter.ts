import {
  CONTRACT_TYPES,
  isCalendarDate,
  isValidDateFilter,
  NONE,
  PERIODIC_PRESETS,
  PRIORITIES,
  SMART_FILTER_LIMITS,
  SMART_FILTER_VERSION,
  STAGES,
  WORK_MODES,
  type SmartFilterConfig,
} from '@jobward/shared';
import { z } from 'zod';
import { idSchema } from './primitives';

/**
 * Configurazione dei filtri intelligenti (M5-SW.1), VERSIONATA: `v` permette di far evolvere il
 * formato (es. gruppi OR nella v2) senza rompere indirizzi o viste salvate. Il contratto è `strict`:
 * un campo sconosciuto, un valore fuori vocabolario o un intervallo incoerente sono un errore.
 *
 * Semantica (v1): AND tra campi diversi, OR tra i valori dello stesso campo.
 */

const calendarDay = z.string().refine(isCalendarDate, 'Data non valida');

const periodicDateFilter = z
  .object({
    preset: z.enum(PERIODIC_PRESETS),
    /** 0 = periodo corrente, −1 = precedente, … (nessun periodo futuro). */
    offset: z.number().int().min(-SMART_FILTER_LIMITS.maxOffset).max(0).default(0),
  })
  .strict();

const customDateFilter = z
  .object({
    preset: z.literal('custom'),
    from: calendarDay.nullable().default(null),
    to: calendarDay.nullable().default(null),
  })
  .strict()
  .refine(
    (filter) => isValidDateFilter(filter),
    'Indica almeno una data; la data iniziale non può seguire quella finale',
  );

export const smartDateFilter = z.discriminatedUnion('preset', [
  periodicDateFilter,
  customDateFilter,
]);

/** Elenco non vuoto, senza duplicati. */
const set = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .min(1)
    .max(max)
    .refine((values) => new Set(values).size === values.length, 'Valori duplicati');

export const smartFilterConfig = z
  .object({
    v: z.literal(SMART_FILTER_VERSION),
    created: smartDateFilter.optional(),
    applied: smartDateFilter.optional(),
    updated: smartDateFilter.optional(),
    stage: set(z.enum([...STAGES, NONE]), STAGES.length + 1).optional(),
    company: set(
      z.string().trim().min(1).max(SMART_FILTER_LIMITS.textMax),
      SMART_FILTER_LIMITS.maxCompanies,
    ).optional(),
    priority: set(z.enum(PRIORITIES), PRIORITIES.length).optional(),
    workMode: set(z.enum([...WORK_MODES, NONE]), WORK_MODES.length + 1).optional(),
    contractType: set(z.enum([...CONTRACT_TYPES, NONE]), CONTRACT_TYPES.length + 1).optional(),
    labelIds: set(idSchema, SMART_FILTER_LIMITS.maxLabels).optional(),
    location: z.string().trim().min(1).max(SMART_FILTER_LIMITS.textMax).optional(),
  })
  .strict();

/** Il tipo del dominio condiviso e quello dello schema devono restare identici. */
export type SmartFilterConfigInput = z.infer<typeof smartFilterConfig>;
const _compatible = (value: SmartFilterConfigInput): SmartFilterConfig => value;
void _compatible;

/** Configurazione valida o `null`: chi legge da una fonte esterna (indirizzo, storage) non lancia. */
export function parseSmartFilter(input: unknown): SmartFilterConfig | null {
  const parsed = smartFilterConfig.safeParse(input);
  return parsed.success ? parsed.data : null;
}
