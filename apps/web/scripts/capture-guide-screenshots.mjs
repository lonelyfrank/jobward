#!/usr/bin/env node
/**
 * Schermate della guida utente (docs/user/images) dal profilo **Dati demo**.
 *
 * Richiede `pnpm dev` avviato. Rigenera i dati demo (solo l'identità demo: i dati reali non
 * vengono letti né modificati), poi apre le pagine principali in Chromium e salva un JPEG
 * per ciascuna. Uso: `pnpm docs:screenshots` dalla radice della repository.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '../../../docs/user/images');
const APP = process.env.JOBWARD_APP_URL ?? 'http://localhost:5174';
const API = process.env.JOBWARD_API_URL ?? 'http://localhost:8787';
const DEMO = { 'x-jobward-profile': 'demo', 'content-type': 'application/json' };

async function api(path, init = {}) {
  const response = await fetch(`${API}/api/v1${path}`, { ...init, headers: DEMO });
  if (!response.ok) throw new Error(`${init.method ?? 'GET'} ${path}: HTTP ${response.status}`);
  return response.json();
}

const { workspace } = await api('/demo/reset', { method: 'POST', body: '{}' });
const { boards } = await api(`/boards?workspaceId=${workspace.id}`);
const main = boards.find((board) => board.name === 'Ricerca 2026') ?? boards[0];

/** Pagine da fotografare: nome del file, percorso, testo da attendere, azione facoltativa. */
const SHOTS = [
  { file: 'overview', path: '/', ready: 'Brera Digital' },
  { file: 'opportunities', path: '/opportunities', ready: 'Nordlight Software' },
  { file: 'board', path: `/boards/${main.id}`, ready: 'Orbita Labs' },
  {
    file: 'application-detail',
    path: `/boards/${main.id}`,
    ready: 'Brera Digital',
    open: 'Full Stack Engineer',
  },
  { file: 'pipeline', path: '/pipeline', ready: 'Fintech Navigli' },
  { file: 'tasks', path: '/tasks', ready: 'Rispondere all’offerta di Brera Digital' },
  { file: 'calendar', path: '/calendar', ready: 'Colloquio tecnico' },
  { file: 'insights', path: '/insights', ready: 'Insights' },
  { file: 'settings-demo', path: '/settings', ready: 'Dati demo', scrollTo: 'Dati demo' },
];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  colorScheme: 'light',
  locale: 'it-IT',
  timezoneId: 'Europe/Rome',
});
// Eseguito nel browser prima dell'app: profilo demo e tema chiaro.
await context.addInitScript({
  content: `localStorage.setItem('jobward.data-profile.v1', 'demo');
    localStorage.setItem('jobward-theme', 'light');`,
});
const page = await context.newPage();

for (const shot of SHOTS) {
  await page.goto(`${APP}${shot.path}`);
  await page.getByText(shot.ready).first().waitFor({ timeout: 15_000 });
  if (shot.open) {
    await page.getByText(shot.open, { exact: true }).first().click();
    await page.getByRole('dialog').waitFor({ timeout: 15_000 });
  }
  if (shot.scrollTo) {
    await page.getByRole('heading', { name: shot.scrollTo }).scrollIntoViewIfNeeded();
  }
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(400); // fine delle transizioni
  const path = resolve(OUT, `${shot.file}.jpg`);
  await page.screenshot({ path, type: 'jpeg', quality: 80 });
  console.log(`✓ ${shot.file}.jpg`);
}

await browser.close();
