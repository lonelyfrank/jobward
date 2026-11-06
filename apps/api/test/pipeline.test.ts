import { env } from 'cloudflare:workers';
import { pipelineTransitionResponse } from '@jobward/schemas';
import { describe, expect, it } from 'vitest';
import { clientFor, newUser } from './kanban-helpers';
import {
  cardState,
  countOf,
  dbEvents,
  eventTypes,
  exec,
  setupCard,
  transition,
  uid,
} from './m3-helpers';

describe('POST /cards/:id/pipeline — transizioni ordinarie', () => {
  it('avanzamento Salvata → Inviata: fase/esito canonici, data di invio, eventi con chiave di deduplica', async () => {
    const c = await setupCard('pl-advance@example.com');
    const id = uid();
    const res = await c.api.post(`/cards/${c.card.id}/pipeline`, {
      id,
      to: 'applied',
      kind: 'advance',
      expectedFrom: 'saved',
      appliedOn: '2026-11-01',
    });
    expect(res.status).toBe(200);
    const body = pipelineTransitionResponse.parse(res.body);
    expect(body).toMatchObject({
      replayed: false,
      cancelledInterviews: 0,
      transition: { id, kind: 'advance', from: 'saved', to: 'applied' },
    });
    expect(await cardState(c.api, c.card.id)).toEqual({
      stage: 'applied',
      outcome: 'pending',
      appliedOn: '2026-11-01',
    });
    const events = (await dbEvents(c.card.id)).filter((e) => e.operation_id === id);
    expect(events.map((e) => e.type).sort()).toEqual(['application_submitted', 'stage_changed']);
    for (const e of events) {
      expect(e.request_fingerprint).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.parse(e.dedupe_key!)).toEqual([e.type, 'card', c.card.id, id]);
    }
    const submitted = events.find((e) => e.type === 'application_submitted')!;
    expect(JSON.parse(submitted.metadata)).toMatchObject({
      appliedOn: '2026-11-01',
      toStatus: 'applied',
    });
  });

  it('la data di invio già presente non viene sovrascritta', async () => {
    const c = await setupCard('pl-appliedon@example.com');
    await c.api.patch(`/cards/${c.card.id}`, { appliedOn: '2026-10-01' });
    const res = await transition(c.api, c.card.id, {
      to: 'applied',
      kind: 'advance',
      appliedOn: '2026-11-05',
    });
    expect(res.status).toBe(200);
    expect((await cardState(c.api, c.card.id)).appliedOn).toBe('2026-10-01');
  });

  it('chiusura: Rifiutata/Ritirata/Nessuna risposta da uno stato aperto; Assunto/a solo da Offerta', async () => {
    const c = await setupCard('pl-close@example.com');
    expect((await transition(c.api, c.card.id, { to: 'hired', kind: 'close' })).status).toBe(409);
    const closed = await transition(c.api, c.card.id, { to: 'no_response', kind: 'close' });
    expect(closed.status).toBe(200);
    expect(await cardState(c.api, c.card.id)).toMatchObject({
      stage: 'closed',
      outcome: 'no_response',
    });
    expect(await eventTypes(c.card.id)).toContain('application_closed');

    const d = await setupCard('pl-hire@example.com');
    expect((await transition(d.api, d.card.id, { to: 'offer', kind: 'advance' })).status).toBe(200);
    const hired = await transition(d.api, d.card.id, { to: 'hired', kind: 'close' });
    expect(hired.status).toBe(200);
    expect(await cardState(d.api, d.card.id)).toMatchObject({
      stage: 'closed',
      outcome: 'accepted',
    });
  });

  it('transizioni non consentite o inutili: 409 e nessuna scrittura', async () => {
    const c = await setupCard('pl-invalid@example.com');
    await transition(c.api, c.card.id, { to: 'interviewing', kind: 'advance' });
    const before = (await dbEvents(c.card.id)).length;
    // all'indietro con «advance», stesso stato, chiusura con kind sbagliato
    for (const body of [
      { to: 'applied', kind: 'advance' },
      { to: 'interviewing', kind: 'advance' },
      { to: 'rejected', kind: 'advance' },
      { to: 'screening', kind: 'reopen' },
    ]) {
      const res = await transition(c.api, c.card.id, body);
      expect(res.status, JSON.stringify(body)).toBe(409);
      expect(res.body.error.code).toBe('conflict');
    }
    expect((await dbEvents(c.card.id)).length).toBe(before);
    expect(await cardState(c.api, c.card.id)).toMatchObject({ stage: 'interviewing' });
  });

  it('controllo ottimistico: expectedFrom diverso dallo stato attuale → 409', async () => {
    const c = await setupCard('pl-expected@example.com');
    const res = await transition(c.api, c.card.id, {
      to: 'applied',
      kind: 'advance',
      expectedFrom: 'interviewing',
    });
    expect(res.status).toBe(409);
    expect(await cardState(c.api, c.card.id)).toMatchObject({ stage: null });
  });

  it('validazione: ID mancante o malformato, archiviazione come destinazione, cancel senza chiusura', async () => {
    const c = await setupCard('pl-validate@example.com');
    const post = (body: unknown) => c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect((await post({ to: 'applied', kind: 'advance' })).status).toBe(400);
    expect((await post({ id: 'corto', to: 'applied', kind: 'advance' })).status).toBe(400);
    expect((await post({ id: uid(), to: 'archived', kind: 'advance' })).status).toBe(400);
    expect(
      (await post({ id: uid(), to: 'applied', kind: 'advance', futureInterviews: 'cancel' }))
        .status,
    ).toBe(400);
    expect(
      (await post({ id: uid(), to: 'rejected', kind: 'close', appliedOn: '2026-01-01' })).status,
    ).toBe(400);
    expect((await post({ id: uid(), to: 'applied', kind: 'advance', extra: 1 })).status).toBe(400);
  });

  it('candidatura archiviata: sola lettura (409)', async () => {
    const c = await setupCard('pl-archived@example.com');
    await c.api.post(`/cards/${c.card.id}/archive`, {});
    const res = await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/archiviata/);
  });
});

describe('riapertura e correzione', () => {
  it('chiusura → riapertura: evento dedicato; una nuova chiusura/riapertura produce un nuovo evento', async () => {
    const c = await setupCard('pl-reopen@example.com');
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    await transition(c.api, c.card.id, { to: 'rejected', kind: 'close' });

    const reopenId = uid();
    const body = { id: reopenId, to: 'applied', kind: 'reopen', expectedFrom: 'rejected' };
    const first = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(first.status).toBe(200);
    expect(first.body.transition).toMatchObject({
      from: 'rejected',
      to: 'applied',
      kind: 'reopen',
    });
    expect(await cardState(c.api, c.card.id)).toMatchObject({
      stage: 'applied',
      outcome: 'pending',
    });
    const reopened = (await dbEvents(c.card.id)).filter((e) => e.type === 'application_reopened');
    expect(reopened).toHaveLength(1);
    expect(JSON.parse(reopened[0]!.metadata)).toMatchObject({
      outcome: 'rejected',
      kind: 'reopen',
    });
    expect(JSON.parse(reopened[0]!.dedupe_key!)).toEqual([
      'application_reopened',
      'card',
      c.card.id,
      reopenId,
    ]);

    // retry: un solo evento
    const retry = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(retry.status).toBe(200);
    expect(retry.body.replayed).toBe(true);
    expect(await countOf('application_reopened', c.card.id)).toBe(1);

    // nuovo ciclo chiusura → riapertura con nuovi ID: nuovo evento
    await transition(c.api, c.card.id, { to: 'withdrawn', kind: 'close' });
    expect((await transition(c.api, c.card.id, { to: 'screening', kind: 'reopen' })).status).toBe(
      200,
    );
    expect(await countOf('application_reopened', c.card.id)).toBe(2);
  });

  it('il modulo Dettagli (PATCH) che riporta un esito conclusivo a «in corso» registra lo stesso evento', async () => {
    const c = await setupCard('pl-patch-reopen@example.com');
    await c.api.patch(`/cards/${c.card.id}`, { stage: 'closed', outcome: 'rejected' });
    expect(await countOf('application_reopened', c.card.id)).toBe(0);
    const res = await c.api.patch(`/cards/${c.card.id}`, { outcome: 'pending' });
    expect(res.status).toBe(200);
    expect(await countOf('application_reopened', c.card.id)).toBe(1);
    // il dettaglio della scheda continua a validarsi con il nuovo tipo di evento
    const detail = await c.api.get(`/cards/${c.card.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.history.map((e: { type: string }) => e.type)).toContain(
      'application_reopened',
    );
  });

  it('stato legacy (fase «Chiusa» senza esito): solo «correction»; la correzione lascia l’evento e non cancella la storia', async () => {
    const c = await setupCard('pl-legacy@example.com');
    await c.api.patch(`/cards/${c.card.id}`, { stage: 'closed' });
    const refused = await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    expect(refused.status).toBe(409);
    expect(refused.body.error.message).toMatch(/Correggi stato/);

    const before = await eventTypes(c.card.id);
    const fixed = await transition(c.api, c.card.id, { to: 'applied', kind: 'correction' });
    expect(fixed.status).toBe(200);
    const after = await eventTypes(c.card.id);
    expect(after.length).toBeGreaterThan(before.length);
    expect(before.every((t) => after.includes(t))).toBe(true);
    const ev = (await dbEvents(c.card.id)).filter(
      (e) => e.operation_id === fixed.body.transition.id,
    );
    expect(JSON.parse(ev[0]!.metadata).kind).toBe('correction');
  });
});

describe('idempotenza della transizione', () => {
  it('stesso ID e stessa richiesta: replay 200, nessun secondo evento, anche dopo altre modifiche', async () => {
    const c = await setupCard('pl-replay@example.com');
    const body = { id: uid(), to: 'applied', kind: 'advance' as const };
    const first = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(first.body.replayed).toBe(false);
    const n = (await dbEvents(c.card.id)).length;

    const second = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(second.status).toBe(200);
    expect(second.body.replayed).toBe(true);
    expect(second.body.transition).toEqual(first.body.transition);
    expect(second.body.card.updatedAt).toBe(first.body.card.updatedAt);
    expect((await dbEvents(c.card.id)).length).toBe(n);

    // lo stato va avanti (anche con un'altra transizione): il retry tardivo non riapplica nulla
    await transition(c.api, c.card.id, { to: 'interviewing', kind: 'advance' });
    const late = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(late.body.replayed).toBe(true);
    expect(await cardState(c.api, c.card.id)).toMatchObject({ stage: 'interviewing' });
  });

  it('stesso ID e richiesta diversa: 409 senza modificare risorsa o cronologia', async () => {
    const c = await setupCard('pl-mismatch@example.com');
    const id = uid();
    await c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'applied', kind: 'advance' });
    const events = await dbEvents(c.card.id);
    const state = await cardState(c.api, c.card.id);
    for (const other of [
      { id, to: 'interviewing', kind: 'advance' },
      { id, to: 'applied', kind: 'correction' },
      { id, to: 'applied', kind: 'advance', appliedOn: '2026-01-01' },
      { id, to: 'applied', kind: 'advance', expectedFrom: 'saved' },
    ]) {
      const res = await c.api.post(`/cards/${c.card.id}/pipeline`, other);
      expect(res.status, JSON.stringify(other)).toBe(409);
    }
    expect(await dbEvents(c.card.id)).toEqual(events);
    expect(await cardState(c.api, c.card.id)).toEqual(state);
  });

  it('lo stesso ID su un’altra candidatura è 409 (il fingerprint include la scheda)', async () => {
    const c = await setupCard('pl-othercard@example.com');
    const other = await c.api.post('/cards', { columnId: c.columnIds[0], title: 'Altra' });
    const id = uid();
    expect(
      (await c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'applied', kind: 'advance' }))
        .status,
    ).toBe(200);
    const res = await c.api.post(`/cards/${other.body.card.id}/pipeline`, {
      id,
      to: 'applied',
      kind: 'advance',
    });
    expect(res.status).toBe(409);
    expect(await cardState(c.api, other.body.card.id)).toMatchObject({ stage: null });
  });

  it('«assente» e «keep» per futureInterviews sono la stessa richiesta (fingerprint normalizzato)', async () => {
    const c = await setupCard('pl-normalized@example.com');
    const id = uid();
    await c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'rejected', kind: 'close' });
    const res = await c.api.post(`/cards/${c.card.id}/pipeline`, {
      id,
      to: 'rejected',
      kind: 'close',
      futureInterviews: 'keep',
    });
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(true);
  });

  it('richieste concorrenti identiche: una sola scrittura, una sola serie di eventi, risposte convergenti', async () => {
    const c = await setupCard('pl-race-same@example.com');
    const body = { id: uid(), to: 'applied', kind: 'advance', appliedOn: '2026-11-02' };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => c.api.post(`/cards/${c.card.id}/pipeline`, body)),
    );
    expect(results.map((r) => r.status)).toEqual(Array(6).fill(200));
    expect(results.filter((r) => !r.body.replayed)).toHaveLength(1);
    const mine = (await dbEvents(c.card.id)).filter((e) => e.operation_id === body.id);
    expect(mine.map((e) => e.type).sort()).toEqual(['application_submitted', 'stage_changed']);
  });

  it('richieste concorrenti con lo stesso ID e payload diverso: una vince, le altre 409', async () => {
    const c = await setupCard('pl-race-diff@example.com');
    const id = uid();
    const results = await Promise.all([
      c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'applied', kind: 'advance' }),
      c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'interviewing', kind: 'advance' }),
      c.api.post(`/cards/${c.card.id}/pipeline`, { id, to: 'offer', kind: 'advance' }),
    ]);
    const ok = results.filter((r) => r.status === 200);
    expect(ok).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    const stage = (await cardState(c.api, c.card.id)).stage;
    expect(stage).toBe(
      { applied: 'applied', interviewing: 'interviewing', offer: 'offer' }[
        ok[0]!.body.transition.to as 'applied'
      ],
    );
    const ops = new Set(
      (await dbEvents(c.card.id))
        .filter((e) => e.operation_id === id)
        .map((e) => e.request_fingerprint),
    );
    expect(ops.size).toBe(1);
  });

  it('operazioni diverse concorrenti sullo stesso stato di partenza: una sola applicata, le altre 409 (stato cambiato)', async () => {
    const c = await setupCard('pl-race-ops@example.com');
    const results = await Promise.all(
      ['rejected', 'withdrawn', 'no_response'].map((to) =>
        transition(c.api, c.card.id, { to, kind: 'close', expectedFrom: 'saved' }),
      ),
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await countOf('application_closed', c.card.id)).toBe(1);
  });

  it('la stessa transizione con ID uguali in workspace diversi è indipendente (isolamento)', async () => {
    const a = await setupCard('pl-iso-a@example.com');
    const b = await setupCard('pl-iso-b@example.com');
    const id = uid();
    expect(
      (await a.api.post(`/cards/${a.card.id}/pipeline`, { id, to: 'applied', kind: 'advance' }))
        .status,
    ).toBe(200);
    const res = await b.api.post(`/cards/${b.card.id}/pipeline`, {
      id,
      to: 'applied',
      kind: 'advance',
    });
    expect(res.status).toBe(200);
    expect(res.body.replayed).toBe(false);
  });

  it('una scheda altrui o inesistente è 404; il vero proprietario non ne risente', async () => {
    const a = await setupCard('pl-own-a@example.com');
    const b = await newUser('pl-own-b@example.com');
    const id = uid();
    const body = { id, to: 'applied', kind: 'advance' };
    // B usa il proprio workspace con la scheda di A
    expect((await b.api.post(`/cards/${a.card.id}/pipeline`, body)).status).toBe(404);
    // B tenta di entrare nel workspace di A
    expect(
      (
        await clientFor('pl-own-b@example.com', a.workspaceId).post(
          `/cards/${a.card.id}/pipeline`,
          body,
        )
      ).status,
    ).toBe(404);
    expect(await cardState(a.api, a.card.id)).toMatchObject({ stage: null });
    expect((await a.api.post(`/cards/${a.card.id}/pipeline`, body)).status).toBe(200);
  });
});

describe('colloqui futuri e coerenza con M2.5', () => {
  const FUTURE = () => Date.now() + 5 * 24 * 3_600_000;

  async function withInterviews(email: string) {
    const c = await setupCard(email);
    const future = (
      await c.api.post(`/cards/${c.card.id}/interviews`, { title: 'Futuro', scheduledAt: FUTURE() })
    ).body.interview;
    const unscheduled = (
      await c.api.post(`/cards/${c.card.id}/interviews`, { title: 'Da fissare' })
    ).body.interview;
    return { ...c, future, unscheduled };
  }

  it('«keep» (predefinito): i colloqui restano; la risposta avvisa di gestirli', async () => {
    const c = await withInterviews('pl-keep@example.com');
    const res = await transition(c.api, c.card.id, { to: 'rejected', kind: 'close' });
    expect(res.status).toBe(200);
    expect(res.body.cancelledInterviews).toBe(0);
    expect(res.body.warnings.map((w: { code: string }) => w.code)).toContain(
      'manage_future_interviews',
    );
    const list = (await c.api.get(`/cards/${c.card.id}/interviews`)).body.interviews;
    expect(list.map((i: { status: string }) => i.status).sort()).toEqual([
      'scheduled',
      'to_schedule',
    ]);
    expect(await countOf('interview_cancelled', c.card.id)).toBe(0);
  });

  it('«cancel»: annulla solo i colloqui programmati futuri, con un evento ciascuno, nella stessa operazione', async () => {
    const c = await withInterviews('pl-cancel@example.com');
    const past = (
      await c.api.post(`/cards/${c.card.id}/interviews`, {
        title: 'Passato',
        scheduledAt: Date.now() - 86_400_000,
      })
    ).body.interview;
    const body = { id: uid(), to: 'rejected', kind: 'close', futureInterviews: 'cancel' };
    const res = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(res.status).toBe(200);
    expect(res.body.cancelledInterviews).toBe(1);
    const status = async (id: string) =>
      (await c.api.get(`/cards/${c.card.id}/interviews`)).body.interviews.find(
        (i: { id: string }) => i.id === id,
      ).status;
    expect(await status(c.future.id)).toBe('cancelled');
    expect(await status(c.unscheduled.id)).toBe('to_schedule');
    expect(await status(past.id)).toBe('scheduled');
    const cancelled = (await dbEvents(c.card.id)).filter((e) => e.type === 'interview_cancelled');
    expect(cancelled).toHaveLength(1);
    expect(JSON.parse(cancelled[0]!.metadata)).toMatchObject({ interviewId: c.future.id });
    expect(cancelled[0]!.operation_id).toBe(body.id);

    // retry: nessun secondo annullamento, nessun secondo evento
    const retry = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(retry.body.replayed).toBe(true);
    expect(retry.body.cancelledInterviews).toBe(1);
    expect(await countOf('interview_cancelled', c.card.id)).toBe(1);
  });

  it('«cancel» senza colloqui futuri: nessun effetto', async () => {
    const c = await setupCard('pl-cancel-none@example.com');
    const res = await transition(c.api, c.card.id, {
      to: 'rejected',
      kind: 'close',
      futureInterviews: 'cancel',
    });
    expect(res.status).toBe(200);
    expect(res.body.cancelledInterviews).toBe(0);
  });

  it('suggerimento (non automatismo): con colloqui programmati su «Inviata» lo stato non cambia da solo', async () => {
    const c = await withInterviews('pl-suggest@example.com');
    const res = await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    expect(res.body.warnings).toContainEqual(
      expect.objectContaining({ code: 'consider_interviewing', suggestedStatus: 'interviewing' }),
    );
    expect((await cardState(c.api, c.card.id)).stage).toBe('applied');
  });
});

describe('atomicità e rollback', () => {
  it('un errore nell’inserimento di un evento annulla tutta la transizione (nessuna scrittura parziale)', async () => {
    const c = await setupCard('pl-rollback@example.com');
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    const future = Date.now() + 86_400_000 * 3;
    await c.api.post(`/cards/${c.card.id}/interviews`, { title: 'Futuro', scheduledAt: future });
    const snapshot = {
      state: await cardState(c.api, c.card.id),
      events: await dbEvents(c.card.id),
      interviews: (await c.api.get(`/cards/${c.card.id}/interviews`)).body.interviews,
    };

    // La chiusura scrive stage_changed (ok), annulla il colloquio (ok) e poi application_closed: guasto.
    await exec(`CREATE TRIGGER fail_closed BEFORE INSERT ON activity_events WHEN NEW.type = 'application_closed'
      BEGIN SELECT RAISE(ABORT, 'guasto simulato'); END`);
    const id = uid();
    const body = { id, to: 'rejected', kind: 'close', futureInterviews: 'cancel' };
    let failed;
    try {
      failed = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    } finally {
      await exec('DROP TRIGGER fail_closed');
    }
    expect(failed.status).toBeGreaterThanOrEqual(400);
    expect({
      state: await cardState(c.api, c.card.id),
      events: await dbEvents(c.card.id),
      interviews: (await c.api.get(`/cards/${c.card.id}/interviews`)).body.interviews,
    }).toEqual(snapshot);

    // Nessun residuo del claim: lo stesso ID, a guasto risolto, riesce come prima operazione.
    const ok = await c.api.post(`/cards/${c.card.id}/pipeline`, body);
    expect(ok.status).toBe(200);
    expect(ok.body.replayed).toBe(false);
    expect(await countOf('application_closed', c.card.id)).toBe(1);
  });

  it('le colonne di idempotenza non compaiono mai nella cronologia della scheda', async () => {
    const c = await setupCard('pl-nolealk@example.com');
    await transition(c.api, c.card.id, { to: 'applied', kind: 'advance' });
    const text = JSON.stringify((await c.api.get(`/cards/${c.card.id}`)).body);
    expect(text).not.toMatch(/dedupe|fingerprint|operation/i);
    void env;
  });
});
