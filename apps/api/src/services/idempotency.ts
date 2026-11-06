/**
 * Idempotenza delle creazioni e delle transizioni (D5, docs/m3/plan.md §1.2).
 *
 * Il client genera un ID stabile per l'operazione; il backend lo associa a un FINGERPRINT immutabile
 * della richiesta originale normalizzata (workspace, candidatura e tutti i campi del payload, mai
 * valori generati dal server). Il fingerprint è persistito sulla riga/sull'evento creati e NON si
 * ricalcola dalla versione corrente della risorsa: un replay dopo una modifica resta riconoscibile.
 * La garanzia di unicità è nel database (chiave primaria / indice univoco), non in un SELECT.
 */

/** JSON canonico: chiavi ordinate, `undefined` omesso. Stessi dati → stessa stringa, sempre. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return value === undefined ? 'null' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** SHA-256 esadecimale (64 caratteri) di `[ambito, dati]` in forma canonica. */
export async function requestFingerprint(scope: string, data: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson([scope, data]));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
