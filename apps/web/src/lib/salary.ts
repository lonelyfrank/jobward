import type { Card } from '@meet-roulette/schemas';
import { BASIS_LABELS, PERIOD_LABELS } from './labels';

type SalaryFields = Pick<
  Card,
  'salaryMin' | 'salaryMax' | 'currency' | 'salaryPeriod' | 'salaryBasis'
>;

const number = (value: number, currency: string | null) => {
  try {
    return currency
      ? new Intl.NumberFormat('it-IT', {
          style: 'currency',
          currency,
          maximumFractionDigits: 0,
        }).format(value)
      : new Intl.NumberFormat('it-IT').format(value);
  } catch {
    // Codice valuta ben formato ma sconosciuto al runtime: si mostra come testo, senza simbolo.
    return `${new Intl.NumberFormat('it-IT').format(value)} ${currency ?? ''}`.trim();
  }
};

/**
 * Retribuzione leggibile: "1.800 € – 2.200 € al mese, netto". Restituisce `null` senza importi.
 * Periodo e natura (lordo/netto) compaiono SOLO se l'utente li ha registrati: nessuna deduzione,
 * nessuna conversione di valuta.
 */
export function formatSalary(s: SalaryFields): string | null {
  const { salaryMin: min, salaryMax: max } = s;
  if (min === null && max === null) return null;
  const amount =
    min !== null && max !== null
      ? min === max
        ? number(min, s.currency)
        : `${number(min, s.currency)} – ${number(max, s.currency)}`
      : min !== null
        ? `da ${number(min, s.currency)}`
        : `fino a ${number(max as number, s.currency)}`;
  const parts = [s.salaryPeriod ? `${amount} ${PERIOD_LABELS[s.salaryPeriod]}` : amount];
  if (s.salaryBasis) parts.push(BASIS_LABELS[s.salaryBasis]);
  return parts.join(', ');
}
