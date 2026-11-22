import './lib/zod-config'; // deve precedere qualunque import che crea schemi Zod
import '@fontsource-variable/inter';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { Providers } from './app/providers';
import { createAppRouter } from './app/router';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root non trovato');

createRoot(root).render(
  <StrictMode>
    <Providers>
      <RouterProvider router={createAppRouter()} />
    </Providers>
  </StrictMode>,
);
