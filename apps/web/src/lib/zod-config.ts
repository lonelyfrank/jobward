import { z } from 'zod';

/**
 * Zod 4 prova a compilare i parser con `new Function(...)` (JIT) e ripiega se è vietato.
 * La nostra CSP vieta `unsafe-eval`: il tentativo produce una violazione CSP a ogni avvio.
 * `jitless` lo disabilita (modalità supportata, costo trascurabile per i nostri payload).
 *
 * Va importato PER PRIMO in main.tsx: il flag è letto alla creazione degli schemi.
 */
z.config({ jitless: true });
