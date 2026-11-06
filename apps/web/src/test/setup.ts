import '@testing-library/jest-dom/vitest';
import * as matchers from '@testing-library/jest-dom/matchers';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, beforeEach, expect, vi } from 'vitest';

// `findBy*`/`waitFor` aspettano al massimo 1 s per impostazione predefinita: con le rotte caricate in
// modo pigro e la CPU occupata (es. `pnpm -r test` in parallelo) non basta. È solo un tetto massimo:
// in condizioni normali i test non rallentano.
configure({ asyncUtilTimeout: 5000 });

// Registra esplicitamente sull'istanza del runner anche con risoluzione workspace/Vite.
expect.extend(matchers);

// jsdom non implementa alcune API del browser usate da Radix e dal tema.
beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.className = '';
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
    onchange: null,
  }));
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
  window.scrollTo = () => {};
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
