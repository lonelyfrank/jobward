import type { SmartFilterConfig, SmartFilterContext } from '@jobward/shared';
import { describe, expect, it } from 'vitest';
import { card } from '@/test/fixtures';
import { emitCardCreated, onCardCreated } from './card-created';
import {
  hiddenCardMessage,
  rejectedFiltersMessage,
  shouldAnnounceHiddenCard,
} from './smart-filter-notice';
import { describeRejectedFilterParams } from './smart-filter-url';

const ROME: SmartFilterContext = { today: '2026-11-09', timeZone: 'Europe/Rome' };
const announce = (
  filters: SmartFilterConfig,
  over: Parameters<typeof card>[4] = {},
  boardId: string | null = 'b1',
  context: SmartFilterContext = ROME,
) =>
  shouldAnnounceHiddenCard({
    card: card('n1', 'Nuova', 'c1', 1024, over),
    boardId: boardId ?? undefined,
    config: filters,
    context,
  });

describe('C1: scheda creata e nascosta dai filtri', () => {
  it('scheda che soddisfa i filtri: nessun avviso', () => {
    expect(announce({ v: 1, priority: ['high'] }, { priority: 'high' })).toBe(false);
    expect(announce({ v: 1, stage: ['applied'] }, { stage: 'applied' })).toBe(false);
  });

  it('scheda che non li soddisfa: avviso', () => {
    expect(announce({ v: 1, priority: ['high'] }, { priority: 'none' })).toBe(true);
    // Una scheda nuova ha quasi tutti i dati vuoti: un filtro positivo la esclude.
    expect(announce({ v: 1, stage: ['applied'] })).toBe(true);
    expect(announce({ v: 1, company: ['Acme'] })).toBe(true);
  });

  it('«non indicata» include i dati mancanti: nessun avviso per una scheda vuota', () => {
    expect(announce({ v: 1, stage: ['none'] })).toBe(false);
    expect(announce({ v: 1, workMode: ['none'] })).toBe(false);
  });

  it('filtri inattivi (anche quelli che si normalizzano a vuoto): nessun avviso', () => {
    expect(announce({ v: 1 })).toBe(false);
    expect(announce({ v: 1, priority: [], stage: [], location: '   ' })).toBe(false);
  });

  it('bacheca differente o sconosciuta: nessun avviso', () => {
    expect(announce({ v: 1, priority: ['high'] }, {}, 'altra')).toBe(false);
    expect(announce({ v: 1, priority: ['high'] }, {}, null)).toBe(false);
  });

  describe('confini temporali (Europe/Rome)', () => {
    const today: SmartFilterConfig = { v: 1, created: { preset: 'today', offset: 0 } };
    // 2026-11-09 è ora solare (UTC+1): il giorno locale va da 2026-11-08T23:00Z a 2026-11-09T23:00Z.
    it('mezzanotte locale: l’ultimo millisecondo del giorno prima è fuori, il primo di oggi è dentro', () => {
      expect(announce(today, { createdAt: Date.parse('2026-11-08T22:59:59.999Z') })).toBe(true);
      expect(announce(today, { createdAt: Date.parse('2026-11-08T23:00:00.000Z') })).toBe(false);
    });

    it('fine giornata locale: 23:59:59.999 è dentro, mezzanotte successiva è fuori', () => {
      expect(announce(today, { createdAt: Date.parse('2026-11-09T22:59:59.999Z') })).toBe(false);
      expect(announce(today, { createdAt: Date.parse('2026-11-09T23:00:00.000Z') })).toBe(true);
    });

    it('giorno di 25 ore (fine dell’ora legale, 25 ottobre 2026)', () => {
      const dst: SmartFilterContext = { today: '2026-10-25', timeZone: 'Europe/Rome' };
      // Il giorno va da 2026-10-24T22:00Z a 2026-10-25T23:00Z (esclusa).
      expect(
        announce(today, { createdAt: Date.parse('2026-10-24T21:59:59.999Z') }, 'b1', dst),
      ).toBe(true);
      expect(
        announce(today, { createdAt: Date.parse('2026-10-24T22:00:00.000Z') }, 'b1', dst),
      ).toBe(false);
      expect(
        announce(today, { createdAt: Date.parse('2026-10-25T22:59:59.999Z') }, 'b1', dst),
      ).toBe(false);
      expect(
        announce(today, { createdAt: Date.parse('2026-10-25T23:00:00.000Z') }, 'b1', dst),
      ).toBe(true);
    });

    it('lo stesso istante cade in giorni diversi in fusi diversi', () => {
      const createdAt = Date.parse('2026-11-09T23:30:00Z'); // 10 nov a Roma, 9 nov a Londra
      const rome = announce(today, { createdAt }, 'b1', ROME);
      const london = announce(today, { createdAt }, 'b1', { today: '2026-11-09', timeZone: 'UTC' });
      expect(rome).toBe(true);
      expect(london).toBe(false);
    });
  });

  it('il titolo molto lungo nell’avviso viene accorciato', () => {
    expect(hiddenCardMessage('  Cuoco  ')).toBe(
      'Scheda “Cuoco” creata, ma non è visibile con i filtri attivi.',
    );
    const long = hiddenCardMessage('x'.repeat(200));
    expect(long.length).toBeLessThan(110); // 40 caratteri di titolo al massimo, più la frase
    expect(long).toContain('…');
  });

  it('il canale di creazione notifica gli iscritti e si può disiscrivere', () => {
    const seen: string[] = [];
    const off = onCardCreated((c) => seen.push(c.id));
    emitCardCreated(card('a', 'A', 'c1', 1));
    off();
    emitCardCreated(card('b', 'B', 'c1', 2));
    expect(seen).toEqual(['a']);
  });
});

describe('C2: parametri di filtro rifiutati', () => {
  const rejected = (qs: string, known?: string[]) =>
    describeRejectedFilterParams(
      new URLSearchParams(qs),
      known ? { knownLabelIds: new Set(known) } : {},
    );

  describe('vocabolari', () => {
    it('elenca solo i valori fuori vocabolario e conserva gli altri', () => {
      expect(rejected('fase=xyz&priorita=high')).toEqual([
        { param: 'fase', value: 'xyz', reason: 'invalid' },
      ]);
      expect(rejected('fase=applied,xyz,offer&priorita=urgenza&modalita=ufficio')).toEqual([
        { param: 'fase', value: 'xyz', reason: 'invalid' },
        { param: 'priorita', value: 'urgenza', reason: 'invalid' },
        { param: 'modalita', value: 'ufficio', reason: 'invalid' },
      ]);
    });

    it('«non indicata» è un valore valido di fase, modalità e contratto', () => {
      expect(rejected('fase=none&modalita=none&contratto=none')).toEqual([]);
      // …ma non della priorità (la priorità ha già «nessuna»).
      expect(rejected('priorita=none')).toEqual([]);
      expect(rejected('contratto=altro')).toEqual([
        { param: 'contratto', value: 'altro', reason: 'invalid' },
      ]);
    });

    it('lo stesso valore rifiutato compare una volta sola', () => {
      expect(rejected('fase=xyz,xyz&fase=xyz')).toHaveLength(1);
    });
  });

  describe('date', () => {
    it('data non valida: rifiutata; intervallo con estremi invertiti: rifiutato', () => {
      expect(rejected('creata=ieri')).toEqual([
        { param: 'creata', value: 'ieri', reason: 'invalid' },
      ]);
      expect(rejected('inviata=2026-13-45..2026-01-01&aggiornata=2026-02-01..2026-01-01')).toEqual([
        { param: 'inviata', value: '2026-13-45..2026-01-01', reason: 'invalid' },
        { param: 'aggiornata', value: '2026-02-01..2026-01-01', reason: 'invalid' },
      ]);
    });

    it('preset oltre il limite di spostamento: rifiutato', () => {
      expect(rejected('creata=week-99999')).toHaveLength(1);
    });

    it('periodi validi (preset, spostati, intervalli anche aperti): nessun rifiuto', () => {
      expect(rejected('creata=week&inviata=month-2&aggiornata=2026-01-01..')).toEqual([]);
      expect(rejected('creata=..2026-02-01&inviata=2026-01-01..2026-02-01')).toEqual([]);
    });
  });

  describe('testo troncato e limiti', () => {
    it('località e azienda oltre il limite di caratteri: troncate', () => {
      expect(rejected(`localita=${'a'.repeat(121)}`)).toEqual([
        { param: 'localita', value: '', reason: 'truncated' },
      ]);
      expect(rejected(`azienda=${'b'.repeat(121)}`)).toEqual([
        { param: 'azienda', value: '', reason: 'truncated' },
      ]);
    });

    it('esattamente al limite: nessun rifiuto', () => {
      expect(rejected(`localita=${'a'.repeat(120)}&azienda=${'b'.repeat(120)}`)).toEqual([]);
    });

    it('troppe aziende o troppe etichette: il resto è ignorato', () => {
      const companies = Array.from({ length: 31 }, (_, i) => `azienda=A${i}`).join('&');
      expect(rejected(companies)).toEqual([{ param: 'azienda', value: '', reason: 'truncated' }]);
      const labels = Array.from({ length: 21 }, (_, i) => `l${i}`).join(',');
      expect(rejected(`etichetta=${labels}`)).toEqual([
        { param: 'etichetta', value: '', reason: 'truncated' },
      ]);
    });
  });

  describe('etichette', () => {
    it('identificativo malformato: non valido', () => {
      expect(rejected('etichetta=ok1,<script>,a b')).toEqual([
        { param: 'etichetta', value: '<script>', reason: 'invalid' },
        { param: 'etichetta', value: 'a b', reason: 'invalid' },
      ]);
    });

    it('etichetta inesistente: segnalata solo se l’elenco è noto', () => {
      expect(rejected('etichetta=l1,l2')).toEqual([]); // elenco non ancora caricato
      expect(rejected('etichetta=l1,l2', ['l1'])).toEqual([
        { param: 'etichetta', value: '', reason: 'unknown' },
      ]);
      expect(rejected('etichetta=l1', ['l1', 'l9'])).toEqual([]);
    });

    it('più etichette inesistenti: una sola voce', () => {
      expect(rejected('etichetta=x1,x2,x3', ['l1'])).toHaveLength(1);
    });
  });

  describe('indirizzi canonici e variazioni solo cosmetiche', () => {
    it('indirizzo canonico, vuoto o con parametri estranei: nessun rifiuto', () => {
      expect(rejected('')).toEqual([]);
      expect(rejected('fase=applied&priorita=high,low&x=1&tab=y')).toEqual([]);
      expect(rejected('azienda=Acme&azienda=Beta&localita=Roma&etichetta=l1', ['l1'])).toEqual([]);
    });

    it('duplicati, spazi, valori vuoti, maiuscole nelle aziende e parametri vuoti non contano', () => {
      expect(rejected('priorita=high,high')).toEqual([]);
      expect(rejected('priorita=%20high%20,%20low')).toEqual([]);
      expect(rejected('fase=&priorita=,,&azienda=&azienda=%20%20&localita=')).toEqual([]);
      expect(rejected('azienda=Acme&azienda=ACME&azienda=acme')).toEqual([]);
      expect(rejected('creata=week-0')).toEqual([]); // equivalente a «week»
    });

    it('ordine dei parametri diverso da quello canonico: nessun rifiuto', () => {
      expect(rejected('priorita=high&fase=applied')).toEqual([]);
    });
  });

  describe('messaggio', () => {
    it('un solo messaggio con le voci elencate', () => {
      const message = rejectedFiltersMessage(rejected('fase=xyz'));
      expect(message).toBe(
        'Alcuni filtri del link non erano validi e sono stati ignorati. Fase: “xyz” non valido.',
      );
    });

    it('mostra al massimo tre voci e riassume le altre', () => {
      const message = rejectedFiltersMessage(
        rejected('fase=a&priorita=b&modalita=c&contratto=d&creata=e'),
      );
      expect(message).toContain('altri 2');
      expect(message.match(/non valido/g)).toHaveLength(3);
    });

    it('non mostra identificativi opachi e accorcia i valori lunghi', () => {
      const unknown = rejectedFiltersMessage(rejected('etichetta=abc123', ['l1']));
      expect(unknown).toContain('Etichetta: non esiste più');
      expect(unknown).not.toContain('abc123');
      const long = rejectedFiltersMessage(rejected(`fase=${'z'.repeat(80)}`));
      expect(long).toContain('…');
      expect(long.length).toBeLessThan(140);
    });

    it('i limiti superati citano il limite', () => {
      expect(rejectedFiltersMessage(rejected(`localita=${'a'.repeat(200)}`))).toContain(
        'oltre il limite di 120',
      );
    });
  });
});
