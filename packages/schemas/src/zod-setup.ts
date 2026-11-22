import { z } from 'zod';

/**
 * Zod 4 prova a compilare i parser con `new Function(...)` (JIT) alla CREAZIONE di ogni schema e
 * ripiega se è vietato. La CSP del frontend vieta `unsafe-eval`: ogni tentativo è una violazione
 * (`script-src eval`), anche se gestita. `jitless` lo disabilita (modalità supportata, costo
 * trascurabile per questi payload; su Cloudflare Workers `eval` è comunque vietato).
 *
 * Il flag va impostato PRIMA che si crei il primo schema. Con il code splitting un modulo di un
 * chunk condiviso viene valutato prima del corpo dell'entry (difetto M2-08, visto dalla suite di
 * anteprima sotto CSP reale): per questo vive qui, importato per primo da `index.ts`, invece che
 * nell'entry dell'applicazione web.
 */
z.config({ jitless: true });
