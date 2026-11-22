import { readStorage, writeStorage } from './storage';

/**
 * Profilo dati scelto in Impostazioni → «Dati demo» (solo sviluppo locale). Il server lo legge
 * dall'header e, con `demo`, risponde con un'identità separata: i dati reali non vengono mai mostrati
 * né modificati mentre il profilo demo è attivo. Fuori dallo sviluppo locale l'header è ignorato.
 */
export type DataProfile = 'real' | 'demo';
export const PROFILE_HEADER = 'x-jobward-profile';
const KEY = 'jobward.data-profile.v1';

export function readDataProfile(): DataProfile {
  return readStorage(KEY) === 'demo' ? 'demo' : 'real';
}

export function writeDataProfile(profile: DataProfile): boolean {
  return writeStorage(KEY, profile);
}

/** Ricarica l'app da capo: nessuna cache, stato o URL del profilo precedente sopravvive. */
export function restartApp(): void {
  window.location.assign('/');
}
