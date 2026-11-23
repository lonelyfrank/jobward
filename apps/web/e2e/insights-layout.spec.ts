import { expect, test, type Page } from '@playwright/test';
import { expectNoA11yViolations } from './helpers';

const insights = {
  generatedAt: 1,
  timeZone: 'Europe/Rome',
  totals: {
    opportunities: 10,
    inbox: 2,
    applications: 8,
    activeApplications: 4,
    interviews: 2,
    upcomingInterviews: 1,
    offers: 1,
    hired: 0,
  },
  statusDistribution: [],
  funnel: [
    { step: 'applied', count: 8, rate: null },
    { step: 'in_contact', count: 4, rate: 0.5 },
    { step: 'interviewing', count: 2, rate: 0.5 },
    { step: 'offer', count: 1, rate: 0.5 },
    { step: 'hired', count: 0, rate: 0 },
  ],
  outcomes: [{ outcome: 'rejected', count: 2 }],
  responseTime: { medianDays: 4, sampleSize: 4, awaitingResponse: 3, withoutAppliedOn: 1 },
  weekly: Array.from({ length: 12 }, (_, i) => ({
    weekStart: `2026-09-${String(i + 1).padStart(2, '0')}`,
    count: i === 11 ? 8 : 0,
  })),
  sources: [
    { source: 'LinkedIn', count: 6 },
    { source: 'Sito aziendale', count: 2 },
  ],
  workModes: [{ workMode: 'remote', count: 4 }],
  benefitsRecorded: 3,
};

async function mock(page: Page, sources = insights.sources) {
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith('/me')
      ? {
          user: { id: 'u1', email: 'insights@example.com' },
          workspaces: [
            { id: 'w1', name: 'Ricerca', timezone: 'Europe/Rome', role: 'owner', createdAt: 1 },
          ],
        }
      : path.endsWith('/insights')
        ? { ...insights, sources }
        : { boards: [] };
    await route.fulfill({ json });
  });
  await page.goto('/insights');
  await expect(page.getByRole('heading', { name: 'Funnel delle candidature' })).toBeVisible();
}

for (const width of [320, 768, 1440]) {
  test(`cockpit ${width}: layout, provenienza completa e accessibilità`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({
      colorScheme: width === 1440 ? 'dark' : 'light',
      reducedMotion: 'reduce',
    });
    await mock(page);
    await expect(
      page.getByRole('heading', { name: 'Stato attuale delle candidature' }),
    ).toHaveCount(0);
    const legend = page.getByRole('list', { name: 'Provenienza delle opportunità' });
    await expect(legend).toContainText('LinkedIn6 · 60%');
    await expect(legend).toContainText('Fonte non indicata2 · 20%');
    await expect(page.getByText(/Benefit indicati in 3 su 10/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(
      false,
    );
    const funnel = (await page
      .getByRole('heading', { name: 'Funnel delle candidature' })
      .boundingBox())!;
    const weekly = (await page
      .getByRole('heading', { name: 'Candidature per settimana' })
      .boundingBox())!;
    if (width >= 1024) {
      expect(weekly.y).toBe(funnel.y);
      expect(weekly.x).toBeGreaterThan(funnel.x);
      const values = await page
        .locator('[aria-label="Indicatori dei tempi di risposta"] > div')
        .all();
      // Nella card del carosello le quattro metriche sono una griglia 2×2.
      const positions = await Promise.all(values.map((el) => el.boundingBox()));
      expect(values).toHaveLength(4);
      expect(new Set(positions.map((box) => Math.round(box!.y))).size).toBe(2);
      expect(new Set(positions.map((box) => Math.round(box!.x))).size).toBe(2);
    }
    await page.screenshot({ path: testInfo.outputPath('insights.png'), fullPage: true });
    await expectNoA11yViolations(page, `Insights ${width}`);
  });
}

test('nessuna fonte: istruzione senza torta inventata', async ({ page }) => {
  await mock(page, []);
  await expect(
    page.getByText('Indica la fonte nei dettagli delle opportunità per vedere da dove arrivano.'),
  ).toBeVisible();
  await expect(page.getByRole('list', { name: 'Provenienza delle opportunità' })).toHaveCount(0);
});

test('fonte unica: intera torta, senza categoria mancante', async ({ page }) => {
  await mock(page, [{ source: 'LinkedIn', count: 10 }]);
  const legend = page.getByRole('list', { name: 'Provenienza delle opportunità' });
  await expect(legend).toContainText('10 · 100%');
  await expect(legend.getByRole('listitem')).toHaveCount(1);
});

test('oltre otto fonti: nessuna perdita di dati o overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await mock(
    page,
    Array.from({ length: 10 }, (_, i) => ({
      source: `Fonte ${i} con una descrizione molto lunga`,
      count: 1,
    })),
  );
  await expect(
    page.getByRole('list', { name: 'Provenienza delle opportunità' }).getByRole('listitem'),
  ).toHaveCount(10);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});

for (const width of [1024, 1366, 1920]) {
  test(`carosello ${width}: due card uniformi, navigazione e pagina senza scroll`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 768 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await mock(page);
    const viewport = page.locator('.insights-carousel-viewport');
    const slides = page.locator('.insights-slide');
    const boxes = await Promise.all((await slides.all()).map((el) => el.boundingBox()));
    for (const box of boxes) {
      expect(box!.width).toBeCloseTo(boxes[0]!.width, 0);
      expect(box!.height).toBeCloseTo(boxes[0]!.height, 0);
    }
    const controls = (await page.locator('.insights-carousel-controls').boundingBox())!;
    const viewportBox = (await viewport.boundingBox())!;
    expect(controls.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height - 1);
    expect(controls.x + controls.width / 2).toBeCloseTo(viewportBox.x + viewportBox.width / 2, 0);
    await expect(page.locator('.insights-carousel [aria-live]')).toHaveClass('sr-only');
    await expect(slides.nth(0)).toBeInViewport({ ratio: 0.99 });
    await expect(slides.nth(1)).toBeInViewport({ ratio: 0.99 });
    await expect(slides.nth(2)).not.toBeInViewport();
    // Carosello circolare: «precedenti» a inizio corsa porta alla fine, «successive» alla fine riparte.
    await page.getByRole('button', { name: 'Metriche precedenti' }).click();
    await expect(slides.nth(5)).toBeInViewport({ ratio: 0.99 });
    await page.getByRole('button', { name: 'Metriche successive' }).click();
    await expect(slides.nth(0)).toBeInViewport({ ratio: 0.99 });
    await page.getByRole('button', { name: 'Metriche successive' }).click();
    await expect(slides.nth(2)).toBeInViewport({ ratio: 0.99 });
    await page.getByRole('button', { name: 'Mostra metriche da 4' }).click();
    await expect(slides.nth(4)).toBeInViewport({ ratio: 0.99 });
    // «Tempi di risposta» è l'ultima card del carosello.
    await page.getByRole('button', { name: 'Mostra metriche da 5' }).click();
    await expect(slides.nth(5)).toBeInViewport({ ratio: 0.99 });
    await expect(slides.nth(5).getByRole('heading', { name: 'Tempi di risposta' })).toBeVisible();
    expect(
      await page.locator('.insights-page').evaluate((el) => el.scrollHeight - el.clientHeight),
    ).toBeLessThanOrEqual(1);
    await expect(page.getByRole('link', { name: 'Impostazioni', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'Mostra metriche da 1' }).focus();
    await page.keyboard.press('Enter');
    await expect(slides.nth(0)).toBeInViewport({ ratio: 0.99 });
    await page.screenshot({ path: testInfo.outputPath('carousel.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await viewport.scrollIntoViewIfNeeded();
    await expect(slides.nth(0)).toBeInViewport({ ratio: 0.99 });
    await expect(slides.nth(1)).not.toBeInViewport();
    await page.getByRole('button', { name: 'Mostra metriche da 5' }).click();
    await expect(slides.nth(4)).toBeInViewport({ ratio: 0.99 });
    await page.setViewportSize({ width, height: 768 });
    await expect(slides.nth(4)).toBeInViewport({ ratio: 0.99 });
    expect(
      await viewport.evaluate((el) => el.scrollLeft + el.clientWidth <= el.scrollWidth + 1),
    ).toBe(true);
  });
}

test('fonti lunghe: scorre solo il contenuto, titolo fermo', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await mock(
    page,
    Array.from({ length: 40 }, (_, i) => ({ source: `Fonte ${i}`, count: 1 })),
  );
  await page.getByRole('button', { name: 'Mostra metriche da 4' }).click();
  const title = page.getByRole('heading', { name: 'Da dove arrivano le opportunità' });
  const before = await title.boundingBox();
  const body = page.getByRole('region', { name: 'Da dove arrivano le opportunità', exact: true });
  await body.focus();
  await page.keyboard.press('End');
  await expect.poll(() => body.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await title.boundingBox()).toEqual(before);
  expect(await page.locator('.insights-page').evaluate((el) => el.scrollTop)).toBe(0);
});
