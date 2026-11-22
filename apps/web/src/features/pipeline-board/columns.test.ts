import { describe, expect, it } from 'vitest';
import { card } from '@/test/fixtures';
import { columnOf, targetsIn, transitionTo } from './columns';

const withState = (stage: string | null, outcome: string | null = null) =>
  card('k1', 'Tecnico IT', 'c1', 1024, { stage: stage as never, outcome: outcome as never });

describe('bacheca canonica', () => {
  it('colloca ogni opportunità nella colonna del suo stato derivato', () => {
    expect(columnOf(withState(null))).toBe('saved');
    expect(columnOf(withState('applied'))).toBe('applied');
    expect(columnOf(withState('in_contact'))).toBe('screening');
    expect(columnOf(withState('interviewing'))).toBe('interviewing');
    expect(columnOf(withState('closed', 'rejected'))).toBe('closed');
  });

  it('sceglie la transizione meno invasiva: avanzare, poi chiudere, riaprire, correggere', () => {
    expect(transitionTo(withState('applied'), 'interviewing')).toEqual({
      kind: 'advance',
      to: 'interviewing',
    });
    expect(transitionTo(withState('interviewing'), 'applied')?.kind).toBe('correction');
    expect(transitionTo(withState('closed', 'rejected'), 'applied')?.kind).toBe('reopen');
  });

  it('«Chiuse» offre gli esiti ammessi: «Assunta» solo partendo da un’offerta (o correggendo)', () => {
    const fromApplied = targetsIn(withState('applied'), 'closed');
    expect(fromApplied.filter((t) => t.kind === 'close').map((t) => t.to)).toEqual([
      'rejected',
      'withdrawn',
      'no_response',
    ]);
    const fromOffer = targetsIn(withState('offer'), 'closed');
    expect(fromOffer.find((t) => t.to === 'hired')?.kind).toBe('close');
  });
});
