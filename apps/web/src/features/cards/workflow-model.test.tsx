import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { clientIdSchema, type TimelineEntryDto } from '@jobward/schemas';
import { card } from '@/test/fixtures';
import { ApiRequestError } from '@/lib/api';
import { pipelineOptions, statusLabel } from '@/features/pipeline/presentation';
import { uniqueEntries } from '@/features/timeline/api';
import { describeTimelineEntry } from '@/features/timeline/timeline-tab';
import { CARD_TABS, hashFromTab, tabFromHash } from './workspace-tabs';
import { useCreationOperation } from './creation-operation';

describe('workflow: stato, azioni, hash e timeline', () => {
  it('sei schede canoniche in ordine e alias legacy', () => {
    expect(CARD_TABS.map((t) => t.id)).toEqual([
      'overview',
      'interviews',
      'timeline',
      'notes',
      'documents',
      'details',
    ]);
    for (const tab of CARD_TABS) expect(tabFromHash(hashFromTab(tab.id))).toBe(tab.id);
    expect(tabFromHash('#cronologia')).toBe('timeline');
    expect(tabFromHash('#colloqui')).toBe('interviews');
    expect(tabFromHash('#dettagli')).toBe('details');
    expect(tabFromHash('#panoramica')).toBe('overview');
    expect(tabFromHash('#unknown')).toBe('overview');
  });
  it('stati chiusi precedono la fase e l’archivio precede tutto; azioni dal dominio', () => {
    const c = card('k', 'Titolo', 'c', 1, { stage: 'interviewing', outcome: 'rejected' });
    expect(statusLabel(c)).toBe('Rifiutata');
    expect(pipelineOptions(c, 'advance')).toEqual([]);
    expect(pipelineOptions(c, 'reopen')).toContain('applied');
    expect(statusLabel({ ...c, archivedAt: 1 })).toBe('Archiviata');
    expect(pipelineOptions({ ...c, archivedAt: 1 }, 'correction')).toEqual([]);
    expect(pipelineOptions({ ...c, stage: 'saved', outcome: null }, 'close')).not.toContain(
      'hired',
    );
    expect(pipelineOptions({ ...c, stage: 'closed', outcome: null }, 'close')).toEqual([]);
    expect(pipelineOptions({ ...c, stage: 'closed', outcome: null }, 'correction')).toContain(
      'rejected',
    );
  });
  it('dedupe per fonte e ID senza riordinare né perdere note con ID uguale a un evento', () => {
    const e: TimelineEntryDto = {
      id: 'e',
      source: 'system',
      kind: 'application_reopened',
      occurredAt: 1,
      entity: null,
      data: {},
    };
    const n: TimelineEntryDto = {
      id: 'e',
      source: 'note',
      kind: 'note',
      occurredAt: 1,
      entity: { type: 'note', id: 'e' },
      data: { body: 'testo' },
    };
    expect(uniqueEntries([{ entries: [e] }, { entries: [e, n] }])).toEqual([e, n]);
    expect(describeTimelineEntry(e, 'UTC')).toBe('Candidatura riaperta');
    expect(describeTimelineEntry(n, 'UTC')).toBe('Nota aggiunta');
  });
});

describe('ID e payload immutabili della creazione', () => {
  it('genera un ID valido all’apertura, conserva entrambi dopo risposta persa, nuovo ID solo al reset esplicito', () => {
    const { result } = renderHook(() => useCreationOperation<{ id: string; body: string }>());
    const id = result.current.id;
    expect(clientIdSchema.safeParse(id).success).toBe(true);
    let first!: { id: string; body: string };
    act(() => {
      first = result.current.capture({ id, body: 'originale' });
    });
    act(() => result.current.failed(new ApiRequestError(0, 'network_error', 'Rete')));
    let retry!: typeof first;
    act(() => {
      retry = result.current.capture({ id: 'diverso', body: 'modificato' });
    });
    expect(retry).toEqual(first);
    expect(result.current.id).toBe(id);
    expect(result.current.locked).toBe(true);
    act(() => result.current.restart());
    expect(result.current.id).not.toBe(id);
    expect(result.current.locked).toBe(false);
  });
  it('400 permette la correzione, 409 richiede una nuova operazione consapevole', () => {
    const { result } = renderHook(() => useCreationOperation<{ id: string; body: string }>());
    act(() => {
      result.current.capture({ id: result.current.id, body: 'a' });
    });
    act(() => result.current.failed(new ApiRequestError(400, 'validation_error', 'Dati')));
    expect(result.current.locked).toBe(false);
    act(() => {
      result.current.capture({ id: result.current.id, body: 'b' });
    });
    act(() => result.current.failed(new ApiRequestError(409, 'conflict', 'Cambiata')));
    expect(result.current.conflict).toBe(true);
    expect(result.current.locked).toBe(true);
  });
});
