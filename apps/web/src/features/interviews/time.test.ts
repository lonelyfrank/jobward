import { describe, expect, it } from 'vitest';
import {
  formatInterviewDate,
  instantToLocalInput,
  localInputToInstant,
  zoneOffsetMs,
} from './time';

describe('fusi orari dei colloqui', () => {
  it('UTC: nessuno scarto', () => {
    expect(localInputToInstant('2026-11-10T15:30', 'UTC')).toBe(Date.UTC(2026, 10, 10, 15, 30));
    expect(instantToLocalInput(Date.UTC(2026, 10, 10, 15, 30), 'UTC')).toBe('2026-11-10T15:30');
  });

  it('Roma: ora solare (+1) e ora legale (+2)', () => {
    expect(localInputToInstant('2026-01-15T09:00', 'Europe/Rome')).toBe(
      Date.UTC(2026, 0, 15, 8, 0),
    );
    expect(localInputToInstant('2026-07-15T09:00', 'Europe/Rome')).toBe(
      Date.UTC(2026, 6, 15, 7, 0),
    );
    expect(zoneOffsetMs(Date.UTC(2026, 6, 15, 7, 0), 'Europe/Rome')).toBe(2 * 3_600_000);
  });

  it('New York e Tokyo', () => {
    expect(localInputToInstant('2026-01-15T09:00', 'America/New_York')).toBe(
      Date.UTC(2026, 0, 15, 14, 0),
    );
    expect(localInputToInstant('2026-07-15T09:00', 'Asia/Tokyo')).toBe(Date.UTC(2026, 6, 15, 0, 0));
  });

  it("andata e ritorno senza perdite, anche attorno al cambio d'ora", () => {
    for (const local of [
      '2026-03-29T01:30',
      '2026-03-29T03:30',
      '2026-10-25T01:30',
      '2026-10-25T04:00',
      '2026-12-31T23:59',
    ]) {
      const instant = localInputToInstant(local, 'Europe/Rome')!;
      expect(instantToLocalInput(instant, 'Europe/Rome')).toBe(local);
    }
  });

  it('formato non valido → null', () => {
    for (const bad of ['', '2026-11-10', '10/11/2026 15:30', '2026-13-40T99:99x']) {
      expect(localInputToInstant(bad, 'UTC'), bad).toBeNull();
    }
  });

  it('la sigla del fuso compare solo se diverso da quello mostrato', () => {
    const at = Date.UTC(2026, 10, 10, 15, 30);
    expect(formatInterviewDate(at, 'Europe/Rome', 'Europe/Rome')).not.toContain('(');
    expect(formatInterviewDate(at, 'America/New_York', 'Europe/Rome')).toContain(
      '(America/New_York)',
    );
    expect(formatInterviewDate(at, null, 'Europe/Rome', { short: true })).toMatch(/\d{2}:\d{2}/);
  });
});
