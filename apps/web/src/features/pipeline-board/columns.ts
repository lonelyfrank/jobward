import type { Card } from '@jobward/schemas';
import {
  derivePipelineStatus,
  type PipelineStatus,
  type PipelineTransitionKind,
} from '@jobward/shared';
import { pipelineOptions } from '@/features/pipeline/presentation';

/** Colonne della bacheca canonica: gli stati della candidatura; «Chiuse» raccoglie gli esiti. */
export const PIPELINE_COLUMNS = [
  { id: 'saved', title: 'Da candidare', statuses: ['saved'] },
  { id: 'applied', title: 'Inviate', statuses: ['applied'] },
  { id: 'screening', title: 'Primo contatto', statuses: ['screening'] },
  { id: 'interviewing', title: 'Colloqui', statuses: ['interviewing'] },
  { id: 'offer', title: 'Offerta', statuses: ['offer'] },
  { id: 'closed', title: 'Chiuse', statuses: ['hired', 'rejected', 'withdrawn', 'no_response'] },
] as const satisfies readonly { id: string; title: string; statuses: readonly PipelineStatus[] }[];

export type PipelineColumnId = (typeof PIPELINE_COLUMNS)[number]['id'];

export const columnOf = (card: Card): PipelineColumnId => {
  const status = derivePipelineStatus(card);
  return (
    PIPELINE_COLUMNS.find((c) => (c.statuses as readonly string[]).includes(status))?.id ?? 'saved'
  );
};

const KIND_ORDER: PipelineTransitionKind[] = ['advance', 'close', 'reopen', 'correction'];

/** Transizioni possibili verso uno stato: la prima per tipo (avanzare prima di correggere). */
export function transitionTo(
  card: Card,
  to: PipelineStatus,
): { kind: PipelineTransitionKind; to: PipelineStatus } | null {
  for (const kind of KIND_ORDER) {
    if (pipelineOptions(card, kind).includes(to)) return { kind, to };
  }
  return null;
}

/** Destinazioni ammesse dentro una colonna (per «Chiuse» si sceglie l'esito). */
export function targetsIn(card: Card, column: PipelineColumnId) {
  const spec = PIPELINE_COLUMNS.find((c) => c.id === column);
  if (!spec) return [];
  return spec.statuses
    .map((status) => transitionTo(card, status))
    .filter((t): t is NonNullable<typeof t> => t !== null);
}
