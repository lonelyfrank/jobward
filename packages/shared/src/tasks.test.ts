import { describe, expect, it } from 'vitest';
import {
  addDays,
  classifyDue,
  compareTasks,
  completedLate,
  dayNumber,
  daysBetween,
  isCalendarDate,
  localDate,
  startOfLocalDay,
  summarizeTasks,
  taskStatus,
  TASK_SOON_DAYS,
  type TaskOrderKey,
} from './tasks';

const at = (iso: string) => Date.parse(iso);

describe('date di calendario', () => {
  it('riconosce solo giorni che esistono', () => {
    for (const ok of ['2026-02-28', '2028-02-29', '2026-12-31', '2026-01-01'])
      expect(isCalendarDate(ok), ok).toBe(true);
    for (const bad of [
      '2026-02-30',
      '2027-02-29',
      '2026-13-01',
      '2026-00-10',
      '2026-1-1',
      '10/11/2026',
      '',
    ])
      expect(isCalendarDate(bad), bad).toBe(false);
    expect(dayNumber('1970-01-01')).toBe(0);
  });

  it('addDays/daysBetween: mesi, bisestile, cambio d’anno, zero e negativi', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2026-11-07', 0)).toBe('2026-11-07');
    expect(daysBetween('2026-11-07', '2026-11-10')).toBe(3);
    expect(daysBetween('2026-11-10', '2026-11-07')).toBe(-3);
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2); // ora legale: sempre 2 giorni di calendario
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError);
  });

  it('non dipende dal fuso del processo', () => {
    // Le funzioni usano solo Date.UTC: stesso risultato qualunque sia process.env.TZ.
    expect(daysBetween('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('localDate — mezzanotte, DST e fusi estremi', () => {
  it('Europe/Rome: confine di mezzanotte (CET, UTC+1)', () => {
    expect(localDate(at('2026-01-15T22:59:59.999Z'), 'Europe/Rome')).toBe('2026-01-15');
    expect(localDate(at('2026-01-15T23:00:00.000Z'), 'Europe/Rome')).toBe('2026-01-16');
  });
  it('Europe/Rome: ora legale estiva (CEST, UTC+2) e passaggi del 2026', () => {
    expect(localDate(at('2026-07-15T21:59:59.999Z'), 'Europe/Rome')).toBe('2026-07-15');
    expect(localDate(at('2026-07-15T22:00:00.000Z'), 'Europe/Rome')).toBe('2026-07-16');
    // 29 marzo 2026: alle 02:00 locali si salta a 03:00 (01:00Z)
    expect(localDate(at('2026-03-29T00:59:59.999Z'), 'Europe/Rome')).toBe('2026-03-29');
    expect(localDate(at('2026-03-28T23:00:00.000Z'), 'Europe/Rome')).toBe('2026-03-29');
    // 25 ottobre 2026: le 02:00–03:00 locali si ripetono, la data non retrocede
    expect(localDate(at('2026-10-24T22:00:00.000Z'), 'Europe/Rome')).toBe('2026-10-25');
    expect(localDate(at('2026-10-25T00:30:00.000Z'), 'Europe/Rome')).toBe('2026-10-25');
    expect(localDate(at('2026-10-25T01:30:00.000Z'), 'Europe/Rome')).toBe('2026-10-25');
    expect(localDate(at('2026-10-25T22:59:59.999Z'), 'Europe/Rome')).toBe('2026-10-25');
    expect(localDate(at('2026-10-25T23:00:00.000Z'), 'Europe/Rome')).toBe('2026-10-26');
  });
  it('fusi con offset non interi o estremi', () => {
    expect(localDate(at('2026-06-01T18:29:59.999Z'), 'Asia/Kolkata')).toBe('2026-06-01');
    expect(localDate(at('2026-06-01T18:30:00.000Z'), 'Asia/Kolkata')).toBe('2026-06-02');
    expect(localDate(at('2026-06-01T09:59:59.999Z'), 'Pacific/Kiritimati')).toBe('2026-06-01');
    expect(localDate(at('2026-06-01T10:00:00.000Z'), 'Pacific/Kiritimati')).toBe('2026-06-02');
    expect(localDate(at('2026-06-01T10:59:59.999Z'), 'Pacific/Pago_Pago')).toBe('2026-05-31');
    expect(localDate(at('2026-06-01T11:00:00.000Z'), 'Pacific/Pago_Pago')).toBe('2026-06-01');
  });
  it('America/New_York, UTC, anno bisestile e cambio d’anno', () => {
    expect(localDate(at('2026-01-01T04:59:59.999Z'), 'America/New_York')).toBe('2025-12-31');
    expect(localDate(at('2026-01-01T05:00:00.000Z'), 'America/New_York')).toBe('2026-01-01');
    expect(localDate(at('2028-02-29T23:59:59.999Z'), 'UTC')).toBe('2028-02-29');
    expect(localDate(at('2028-03-01T00:00:00.000Z'), 'UTC')).toBe('2028-03-01');
  });
  it('un fuso non valido solleva un errore', () => {
    expect(() => localDate(0, 'Mars/Olympus')).toThrow();
  });
});

describe('startOfLocalDay', () => {
  it('è il primo istante della data locale (round-trip con localDate)', () => {
    const cases: [string, string][] = [
      ['2026-01-15', 'Europe/Rome'],
      ['2026-03-29', 'Europe/Rome'], // giorno dell'ora legale
      ['2026-10-25', 'Europe/Rome'],
      ['2026-06-02', 'Asia/Kolkata'],
      ['2026-06-02', 'Pacific/Kiritimati'],
      ['2026-06-01', 'Pacific/Pago_Pago'],
      ['2026-11-07', 'UTC'],
    ];
    for (const [date, tz] of cases) {
      const t = startOfLocalDay(date, tz);
      expect(localDate(t, tz), `${date} ${tz}`).toBe(date);
      expect(localDate(t - 60_000, tz), `${date} ${tz} −1 min`).not.toBe(date);
    }
    expect(startOfLocalDay('2026-01-15', 'Europe/Rome')).toBe(at('2026-01-14T23:00:00.000Z'));
    expect(startOfLocalDay('2026-07-15', 'UTC')).toBe(at('2026-07-15T00:00:00.000Z'));
  });
});

describe('classifyDue', () => {
  const today = '2026-11-07';
  it('classifica ogni confine', () => {
    expect(classifyDue('2026-11-06', 'open', today)).toBe('overdue');
    expect(classifyDue('2026-11-07', 'open', today)).toBe('today');
    expect(classifyDue('2026-11-08', 'open', today)).toBe('soon');
    expect(classifyDue(addDays(today, TASK_SOON_DAYS), 'open', today)).toBe('soon');
    expect(classifyDue(addDays(today, TASK_SOON_DAYS + 1), 'open', today)).toBe('later');
    expect(classifyDue(null, 'open', today)).toBe('none');
  });
  it('completate e annullate non hanno condizione temporale', () => {
    expect(classifyDue('2020-01-01', 'done', today)).toBe('none');
    expect(classifyDue('2020-01-01', 'cancelled', today)).toBe('none');
  });
  it('data di oggi impossibile → errore, non un risultato silenzioso', () => {
    expect(() => classifyDue('2026-11-07', 'open', '2026-02-30')).toThrow(RangeError);
  });
  it('a mezzanotte locale una task di ieri diventa in ritardo', () => {
    const due = '2026-01-15';
    const before = localDate(at('2026-01-15T22:59:59.999Z'), 'Europe/Rome');
    const after = localDate(at('2026-01-15T23:00:00.000Z'), 'Europe/Rome');
    expect(classifyDue(due, 'open', before)).toBe('today');
    expect(classifyDue(due, 'open', after)).toBe('overdue');
  });
});

describe('taskStatus e completedLate', () => {
  it('stato dai timestamp', () => {
    expect(taskStatus({ completedAt: null, cancelledAt: null })).toBe('open');
    expect(taskStatus({ completedAt: 1, cancelledAt: null })).toBe('done');
    expect(taskStatus({ completedAt: null, cancelledAt: 2 })).toBe('cancelled');
    expect(taskStatus({ completedAt: 1, cancelledAt: 2 })).toBe('cancelled'); // dati incoerenti: il CHECK li impedisce
  });
  it('completata in ritardo: stesso giorno, giorno dopo, mezzanotte nel fuso del workspace', () => {
    const tz = 'Europe/Rome';
    expect(completedLate('2026-01-15', at('2026-01-15T22:59:59.999Z'), tz)).toBe(false);
    expect(completedLate('2026-01-15', at('2026-01-15T23:00:00.000Z'), tz)).toBe(true);
    expect(completedLate('2026-01-15', at('2026-01-10T10:00:00.000Z'), tz)).toBe(false);
    expect(completedLate(null, at('2026-01-10T10:00:00.000Z'), tz)).toBe(false);
    expect(completedLate('2026-01-15', null, tz)).toBe(false);
  });
});

describe('compareTasks', () => {
  const t = (over: Partial<TaskOrderKey>): TaskOrderKey => ({
    dueOn: null,
    priority: 'none',
    createdAt: 1,
    id: 'a',
    ...over,
  });
  it('ordine operativo: scadenza, senza data per ultime, priorità, creazione, id', () => {
    const rows = [
      t({ id: 'nodate' }),
      t({ id: 'later', dueOn: '2026-12-01' }),
      t({ id: 'today-low', dueOn: '2026-11-07', priority: 'low' }),
      t({ id: 'today-urgent', dueOn: '2026-11-07', priority: 'urgent' }),
      t({ id: 'overdue', dueOn: '2026-11-01' }),
      t({ id: 'today-low-old', dueOn: '2026-11-07', priority: 'low', createdAt: 0 }),
      t({ id: 'b-tie', dueOn: '2026-11-07', priority: 'low', createdAt: 5 }),
      t({ id: 'a-tie', dueOn: '2026-11-07', priority: 'low', createdAt: 5 }),
    ];
    const sorted = [...rows].sort(compareTasks).map((r) => r.id);
    expect(sorted).toEqual([
      'overdue',
      'today-urgent',
      'today-low-old',
      'today-low',
      'a-tie',
      'b-tie',
      'later',
      'nodate',
    ]);
  });
  it('è un ordine totale: antisimmetrico e indipendente dall’ordine d’ingresso (seme fisso)', () => {
    let seed = 42;
    const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const priorities = ['none', 'low', 'medium', 'high', 'urgent'] as const;
    const rows: TaskOrderKey[] = Array.from({ length: 60 }, (_, i) => ({
      dueOn: rnd() < 0.2 ? null : addDays('2026-11-01', Math.floor(rnd() * 5)),
      priority: priorities[Math.floor(rnd() * 5)]!,
      createdAt: Math.floor(rnd() * 4),
      id: `id-${i}`,
    }));
    const shuffled = [...rows].sort(() => rnd() - 0.5);
    expect([...rows].sort(compareTasks)).toEqual([...shuffled].sort(compareTasks));
    for (const a of rows.slice(0, 20))
      for (const b of rows.slice(0, 20))
        expect(Math.sign(compareTasks(a, b)) + Math.sign(compareTasks(b, a))).toBe(0);
  });
});

describe('summarizeTasks', () => {
  it('zero task', () => {
    expect(summarizeTasks([], '2026-11-07')).toEqual({
      open: 0,
      today: 0,
      overdue: 0,
      noDue: 0,
      done: 0,
    });
  });
  it('mix di stati: le annullate non contano; le future non sono né oggi né ritardo', () => {
    const rows = [
      { dueOn: '2026-11-01', status: 'open' as const },
      { dueOn: '2026-11-07', status: 'open' as const },
      { dueOn: '2026-11-07', status: 'open' as const },
      { dueOn: '2026-11-20', status: 'open' as const },
      { dueOn: null, status: 'open' as const },
      { dueOn: '2026-11-01', status: 'done' as const },
      { dueOn: '2026-11-01', status: 'cancelled' as const },
    ];
    expect(summarizeTasks(rows, '2026-11-07')).toEqual({
      open: 5,
      today: 2,
      overdue: 1,
      noDue: 1,
      done: 1,
    });
  });
});
