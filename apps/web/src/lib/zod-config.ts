import { z } from 'zod';

/**
 * Zod 4 prova a compilare i parser con `new Function(...)` (JIT) e ripiega se è vietato.
 * La nostra CSP vieta `unsafe-eval`: il tentativo produce una violazione CSP a ogni avvio.
 * `jitless` lo disabilita (modalità supportata, costo trascurabile per i nostri payload).
 *
 * La configurazione che conta è in `@jobward/schemas` (`zod-setup.ts`), valutata prima di
 * qualunque schema anche con il code splitting; questa resta per gli schemi creati direttamente
 * nell'app e va importata per prima in main.tsx.
 */
z.config({ jitless: true });
