import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readSmartFilter, writeSmartFilter } from '@/features/kanban/smart-filter-url';
import { boardDetail, card, column } from '@/test/fixtures';
import { mockApi, renderApp, withWorkspace } from '@/test/utils';
import { readTableState, toApiQuery, writeTableState } from './table-state';

/**
 * Vincolo SW.3 → SW.8: l'API accetta `where` (query v2), ma NESSUNA vista del frontend lo espone
 * ancora. Quindi nessun filtro avanzato può essere applicato senza essere visibile:
 *  - il frontend non invia mai `where`;
 *  - un `where` presente nell'indirizzo non viene letto né interpretato da Tabella e Kanban;
 *  - la ricerca globale non lo accetta.
 * Quando SW.8 introdurrà il pannello dei filtri avanzati, questi test vanno aggiornati INSIEME
 * alla UI: un `where` applicato deve avere contrassegni rimovibili e un contatore.
 */

const HIDDEN = JSON.stringify({
  v: 2,
  where: { field: 'stage', op: 'in', value: ['saved'] }, // escluderebbe quasi tutte le schede
});
const encoded = encodeURIComponent(HIDDEN);

const EMPTY_LIST = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 0 };

function server() {
  const detail = {
    ...boardDetail(),
    columns: [column('c1', 'Salvate', 1024, { cardCount: 2, category: 'saved' })],
    cards: [
      card('k1', 'Barista', 'c1', 1024, { stage: 'applied' }),
      card('k2', 'Cuoco', 'c1', 2048, { stage: null }),
    ],
  };
  return {
    ...withWorkspace(),
    'GET /boards': () => ({ body: { boards: [] } }),
    'GET /boards/b1': () => ({ body: detail }),
    'GET /labels': () => ({ body: { labels: [] } }),
    'GET /opportunities': () => ({ body: EMPTY_LIST }),
  };
}

const listRequests = (calls: { method: string; path: string }[]) =>
  // Solo l'elenco (`/opportunities?…`): `/opportunities/cities` e simili non portano filtri.
  calls.filter((c) => c.method === 'GET' && /^\/opportunities(\?|$)/.test(c.path));

describe('`where` non esposto: Tabella', () => {
  it('l’elenco Opportunità non invia `where` anche se è nell’indirizzo, e i filtri storici restano', async () => {
    const calls = mockApi(server());
    renderApp(`/opportunities?priority=high&where=${encoded}`);
    await screen.findByText('0 risultati');
    const requests = listRequests(calls);
    expect(requests.length).toBeGreaterThan(0);
    for (const request of requests) {
      const params = new URL(request.path, 'http://x').searchParams;
      expect(params.has('where'), request.path).toBe(false);
      expect(params.get('priority')).toBe('high');
    }
  });

  it('la vista Tabella di una bacheca si comporta allo stesso modo', async () => {
    const calls = mockApi(server());
    renderApp(`/boards/b1/table?stage=applied&where=${encoded}`);
    await waitFor(() => expect(listRequests(calls).length).toBeGreaterThan(0));
    for (const request of listRequests(calls)) {
      const params = new URL(request.path, 'http://x').searchParams;
      expect(params.has('where'), request.path).toBe(false);
      expect(params.get('boardId')).toBe('b1');
      expect(params.get('stage')).toBe('applied');
    }
  });

  it('lo stato della Tabella non legge né scrive `where`', () => {
    const state = readTableState(new URLSearchParams(`priority=high&where=${encoded}`));
    expect(toApiQuery(state)).not.toHaveProperty('where');
    // riscrivendo l'indirizzo il parametro estraneo cade: nessun effetto nascosto che sopravviva
    expect(writeTableState(state).has('where')).toBe(false);
    expect(Object.keys(state)).not.toContain('where');
  });
});

describe('`where` non esposto: Kanban', () => {
  it('un `where` nell’indirizzo non filtra nulla e non compare tra i filtri', async () => {
    mockApi(server());
    renderApp(`/boards/b1?where=${encoded}`);
    await screen.findByRole('list', { name: 'Schede in Salvate' });
    const titles = () =>
      [...document.querySelectorAll('li[data-card-id]')].map((li) =>
        li.getAttribute('data-card-id'),
      );
    await waitFor(() => expect(titles()).toEqual(['k1', 'k2']));
    expect(screen.queryByTestId('smart-filter-bar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Filtri' })).toBeInTheDocument(); // nessun contatore
  });

  it('i filtri visibili si applicano da soli, `where` resta inerte e viene preservato', () => {
    const params = new URLSearchParams(`fase=applied&where=${encoded}`);
    const config = readSmartFilter(params);
    expect(config).toEqual({ v: 1, stage: ['applied'] });
    expect(writeSmartFilter(params, config).get('where')).toBe(HIDDEN);
  });
});

describe('`where` non esposto: ricerca globale e sorgenti del frontend', () => {
  it('nessun file sorgente del frontend costruisce un parametro `where` per l’API', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.(ts|tsx)$/.test(name) && !/\.test\.|\/test\//.test(path)) files.push(path);
      }
    };
    walk(join(import.meta.dirname, '../..'));
    expect(files.length).toBeGreaterThan(50);
    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /['"`]where['"`]/.test(source) ||
        /[?&]where=/.test(source) ||
        /smartQueryJson|smartQuerySchema|opportunitiesQuery/.test(source)
      );
    });
    expect(offenders).toEqual([]);
  });

  it('i chiamanti di `useOpportunities` passano solo chiavi note', () => {
    const picker = readFileSync(join(import.meta.dirname, '../tasks/card-picker.tsx'), 'utf8');
    expect(picker).toContain("useOpportunities({ q: query, pageSize: '6', archived: 'exclude' })");
  });
});
