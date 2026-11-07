import {
  allowedTransitions,
  derivePipelineStatus,
  evaluatePipelineTransition,
  type PipelineState,
  type PipelineStatus,
  type PipelineTransitionKind,
} from '@jobward/shared';
import type { Card } from '@jobward/schemas';

export const STATUS_LABELS: Record<PipelineStatus, string> = {
  saved: 'Salvata',
  applied: 'Inviata',
  screening: 'Primo contatto',
  interviewing: 'In colloquio',
  offer: 'Offerta ricevuta',
  hired: 'Assunta',
  rejected: 'Rifiutata',
  withdrawn: 'Ritirata',
  no_response: 'Nessuna risposta',
  archived: 'Archiviata',
};
export const KIND_LABELS: Record<PipelineTransitionKind, string> = {
  advance: 'Avanza nel processo',
  close: 'Registra un esito',
  reopen: 'Riapri candidatura',
  correction: 'Correggi stato',
};
export const WARNING_TEXT: Record<string, string> = {
  consider_interviewing: 'Ci sono colloqui: valuta il passaggio a «In colloquio».',
  future_interviews_on_closed: 'La candidatura è chiusa ma ha colloqui futuri ancora programmati.',
  manage_future_interviews: 'Ci sono colloqui futuri: scegli se conservarli o annullarli.',
  interviewing_without_rounds: 'La candidatura è in colloquio ma non ha round registrati.',
  interview_overdue: 'Un colloquio ha una data trascorsa: aggiornalo.',
  interview_needs_feedback: 'Un colloquio completato attende il feedback.',
  interview_needs_schedule: 'Un colloquio è ancora da programmare.',
};

export const statusLabel = (state: PipelineState) => STATUS_LABELS[derivePipelineStatus(state)];

/** Nessun grafo frontend: ogni opzione passa dalla decisione del dominio condiviso. */
export function pipelineOptions(card: Card, kind: PipelineTransitionKind) {
  return allowedTransitions(derivePipelineStatus(card), kind).filter(
    (to) =>
      evaluatePipelineTransition({
        current: card,
        to,
        kind,
        cardId: card.id,
        operationId: 'preview',
        interviews: { summary: card.interviewSummary },
      }).allowed,
  );
}
