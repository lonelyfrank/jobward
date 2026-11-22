import { z } from 'zod';

export const EXPORT_FORMAT = 'jobward-export';
export const EXPORT_VERSION = 1;

/**
 * Esportazione completa del workspace (H-05). Formato versionato e indipendente dall'interfaccia: ogni
 * collezione è un elenco di record con i nomi di colonna del database. Le note e i documenti eliminati
 * (tombstone) sono esclusi.
 */
export const workspaceExport = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.literal(EXPORT_VERSION),
  exportedAt: z.number().int(),
  workspace: z.record(z.string(), z.unknown()),
  collections: z.record(z.string(), z.array(z.record(z.string(), z.unknown()))),
});
export type WorkspaceExport = z.infer<typeof workspaceExport>;
