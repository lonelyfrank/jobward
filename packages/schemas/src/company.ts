import { OUTCOMES, STAGES } from '@jobward/shared';
import { z } from 'zod';
import { cardSchema } from './card';
import { httpUrl, idSchema } from './primitives';

export const companySchema = z.object({
  id: idSchema,
  name: z.string(),
  website: z.string().nullable(),
  notes: z.string().nullable(),
  /** Opportunità attive collegate. */
  opportunities: z.number().int().nonnegative(),
  /** Tutte le candidature (anche chiuse o di opportunità archiviate). */
  applications: z.number().int().nonnegative(),
  activeApplications: z.number().int().nonnegative(),
  lastActivityAt: z.number().int().nullable(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
});
export type Company = z.infer<typeof companySchema>;

export const companiesResponse = z.object({ companies: z.array(companySchema) });
export type CompaniesResponse = z.infer<typeof companiesResponse>;

export const companyDetailResponse = z.object({
  company: companySchema,
  opportunities: z.array(cardSchema.extend({ boardName: z.string().nullable() })),
});
export type CompanyDetailResponse = z.infer<typeof companyDetailResponse>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable();

export const updateCompanyInput = z
  .object({
    name: z.string().trim().min(1).max(120),
    website: httpUrl.nullable(),
    notes: optionalText(4000),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Nessuna modifica indicata');
export type UpdateCompanyInput = z.infer<typeof updateCompanyInput>;

export const companyResponse = z.object({ company: companySchema });

export const duplicatesQuery = z
  .object({
    title: z.string().trim().min(1).max(200),
    company: z.string().trim().max(120).optional(),
    sourceUrl: z.string().trim().max(2000).optional(),
    excludeId: idSchema.optional(),
  })
  .strict();
export type DuplicatesQuery = z.infer<typeof duplicatesQuery>;

export const duplicatesResponse = z.object({
  duplicates: z.array(
    z.object({
      id: idSchema,
      reason: z.enum(['same_url', 'same_company_similar_title', 'same_title']),
      title: z.string(),
      company: z.string().nullable(),
      boardId: idSchema.nullable(),
      stage: z.enum(STAGES).nullable(),
      outcome: z.enum(OUTCOMES).nullable(),
      archived: z.boolean(),
    }),
  ),
});
export type DuplicatesResponse = z.infer<typeof duplicatesResponse>;
