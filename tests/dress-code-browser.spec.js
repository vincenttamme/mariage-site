import { expect, test } from '@playwright/test';

const host = (page) => page.locator('wedding-dress-code');
const state = (page) => page.evaluate(() => document.querySelector('wedding-dress-code').simulator.getState());
const diagnostics = (page) => page.evaluate(() => document.querySelector('wedding-dress-code').simulator.diagnostics());

async function openModule(page, scroll = true) {
  await page.goto('/infos.html', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => Boolean(document.querySelector('wedding-dress-code')?.simulator));
  if (scroll) await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
}

async function waitForGroup(page) {
  await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
  await expect(host(page)).toHaveAttribute('data-render-state', 'ready', { timeout: 60_000 });
  await expect.poll(async () => (await diagnostics(page)).loadedCharacters, { timeout: 60_000 }).toBe(6);
  await expect(host(page).locator('canvas')).toHaveCount(1);
  await waitForPaint(page);
}

async function waitForPaint(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

function deferred() {
  let release;
  const promise = new Promise((resolve) => { release = resolve; });
  return { promise, release: () => release() };
}

async function expectVisibleFigures(page, png, evidence = {}) {
  const coverage = await page.evaluate(async (base64) => {
    const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
    const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const surface = new OffscreenCanvas(image.width, image.height);
    const context = surface.getContext('2d');
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    let dark = 0;
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (Math.max(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 205) dark += 1;
    }
    image.close();
    return dark / (pixels.length / 4);
  }, png.toString('base64'));
  if (coverage <= 0.01) {
    const layout = await page.evaluate(() => {
      const canvas = document.querySelector('wedding-dress-code canvas');
      const rectangle = canvas?.getBoundingClientRect();
      return { hiddenDocument: document.hidden, canvasWidth: canvas?.width, canvasHeight: canvas?.height, rectangle: rectangle?.toJSON(), viewport: { width: innerWidth, height: innerHeight } };
    });
    await test.info().attach('blank-stage-diagnostics.json', { body: JSON.stringify({ coverage, ...evidence, layout }, null, 2), contentType: 'application/json' });
  }
  // A loaded renderer can still produce a blank screenshot. Figures must actually
  // occupy pixels; the empty studio background and its labels do not meet this bound.
  expect(coverage, 'The stage capture must contain visible figures, not just an empty studio.').toBeGreaterThan(0.01);
}

test.beforeEach(async ({ page }) => {
  // Tests are self-contained and never send a form response or depend on a CDN.
  await page.route(/https?:\/\/(?!127\.0\.0\.1(?::|\/)|localhost(?::|\/))/, (route) => route.abort());
});

test('lazy 3D loading, material isolation, composition, keyboard controls, idle rendering and context-loss fallback', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 600 });
  const errors = [];
  const modelRequests = [];
  let engineRequests = 0;
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().endsWith('.glb')) modelRequests.push(request.url());
    if (request.url().endsWith('/scene.bundle.js')) engineRequests += 1;
  });
  await openModule(page, false);
  await expect.poll(() => host(page).locator('[data-stage]').evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(750);
  await page.waitForTimeout(150); // Allow the initial IntersectionObserver delivery.
  expect(modelRequests).toEqual([]);
  expect(engineRequests).toBe(0);

  await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
  await waitForGroup(page);
  expect(new Set(modelRequests).size).toBe(4);
  expect(modelRequests).toHaveLength(4);
  expect(engineRequests).toBe(1);
  const original = await state(page);
  const configBefore = await page.evaluate(async () => JSON.stringify((await import('/dress-code/config.js')).dressCodeConfig));
  const initial = await diagnostics(page);
  const materials = initial.characters.flatMap((character) => character.clothing.map((material) => material.materialId));
  expect(new Set(materials).size).toBe(materials.length);
  expect(initial.cachedModels).toBe(4);

  await host(page).locator('[data-select-person]').selectOption('vincent');
  await host(page).locator('[data-color-id="white"]').focus();
  await page.keyboard.press('Enter');
  await expect(host(page).locator('[data-compliance]')).toContainText('Interdite');
  await expect.poll(async () => (await diagnostics(page)).characters.find((character) => character.id === 'vincent').clothing.every((material) => material.color.toLowerCase() === '#ffffff')).toBe(true);
  const changed = await diagnostics(page);
  for (const character of initial.characters.filter((character) => character.id !== 'vincent')) {
    expect(changed.characters.find((entry) => entry.id === character.id).clothing).toEqual(character.clothing);
  }
  await host(page).locator('[data-select-role]').selectOption('invites');
  await expect(host(page).locator('[data-compliance]')).toContainText('Interdite');
  expect((await state(page)).composition.find((person) => person.id === 'vincent').role).toBe('invites');
  const edited = await state(page);

  await host(page).locator('[data-action="compare"]').click();
  await expect.poll(async () => (await diagnostics(page)).splitComparison).toBe(true);
  await expect(host(page).locator('canvas')).toHaveCount(1);
  await expect(host(page).locator('[data-compare-labels]')).toBeVisible();
  expect((await state(page)).composition).toEqual(edited.composition);
  await host(page).locator('[data-action="compare"]').click();
  expect((await state(page)).composition).toEqual(edited.composition);

  const canvas = host(page).locator('canvas');
  await canvas.focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(canvas).toBeFocused();
  expect(await canvas.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none');
  const beforeKey = (await diagnostics(page)).renderedFrames;
  await page.keyboard.press('ArrowRight');
  await expect.poll(async () => (await diagnostics(page)).renderedFrames).toBeGreaterThan(beforeKey);
  await page.keyboard.press('+');
  await page.keyboard.press('Home');
  await waitForPaint(page);
  const idleFrames = (await diagnostics(page)).renderedFrames;
  await page.waitForTimeout(250); // A stationary scene must not keep animating.
  expect((await diagnostics(page)).renderedFrames).toBe(idleFrames);

  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => host(page).locator('[data-stage]').evaluate((element) => element.getBoundingClientRect().top)).toBeGreaterThan(750);
  await page.waitForTimeout(150);
  const offscreenFrames = (await diagnostics(page)).renderedFrames;
  await host(page).locator('[data-color-id="blue"]').evaluate((element) => element.click());
  await page.waitForTimeout(200);
  expect((await diagnostics(page)).renderedFrames).toBe(offscreenFrames);
  await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await diagnostics(page)).renderedFrames).toBeGreaterThan(offscreenFrames);

  await host(page).locator('[data-action="reset"]').click();
  await waitForGroup(page);
  expect((await state(page)).composition).toEqual(original.composition);
  expect(await page.evaluate(async () => JSON.stringify((await import('/dress-code/config.js')).dressCodeConfig))).toBe(configBefore);
  await testInfo.attach('renderer-diagnostics.json', { body: JSON.stringify(await diagnostics(page), null, 2), contentType: 'application/json' });

  const beforeLoss = await state(page);
  const canLoseContext = await canvas.evaluate((element) => {
    const context = element.getContext('webgl2');
    const extension = context?.getExtension('WEBGL_lose_context');
    extension?.loseContext();
    return Boolean(extension);
  });
  expect(canLoseContext, 'The test browser must provide genuine WEBGL_lose_context support.').toBe(true);
  await expect(host(page)).toHaveAttribute('data-render-state', 'fallback');
  await expect(host(page).locator('canvas')).toHaveCount(0);
  await expect(host(page).locator('[data-flat]')).toBeVisible();
  expect((await state(page)).composition).toEqual(beforeLoss.composition);
  await host(page).locator('[data-color-id="burgundy"]').click();
  await expect(host(page).locator('[data-compliance]')).toContainText('Interdite');
  await host(page).locator('[data-action="compare"]').click();
  await expect(host(page).locator('[data-flat]')).toContainText('Couleurs conformes');
  await expect(host(page).locator('[data-flat]')).toContainText('Couleurs à éviter');
  expect(errors).toEqual([]);
});

test('responsive 3D and comparison stay accessible without horizontal overflow, with visual QA screenshots', async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  await openModule(page);
  await waitForGroup(page);
  const original = (await state(page)).composition;
  for (const width of [1440, 768, 720, 390, 375, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
    await waitForPaint(page);
    const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth }));
    expect(dimensions.document, `Document overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.body, `Body overflow at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    const beforeStage = await diagnostics(page);
    const stageCapture = await host(page).locator('[data-stage]').screenshot({ path: testInfo.outputPath(`stage-${width}.png`) });
    await expectVisibleFigures(page, stageCapture, { before: beforeStage, after: await diagnostics(page) });

    await host(page).locator('[data-action="compare"]').click();
    await waitForPaint(page);
    const stageWidth = await host(page).locator('[data-stage]').evaluate((element) => element.clientWidth);
    const compact = stageWidth <= 700;
    await expect.poll(async () => (await diagnostics(page)).splitComparison).toBe(!compact);
    await expect(host(page).locator('canvas')).toHaveCount(1);
    if (compact) {
      await expect(host(page).locator('[data-comparison-tabs]')).toBeVisible();
      await host(page).locator('[data-side="alternative"]').focus();
      await page.keyboard.press('Enter');
      await expect(host(page).locator('[data-side="alternative"]')).toHaveAttribute('aria-pressed', 'true');
      expect((await state(page)).comparisonSide).toBe('alternative');
      await expect(host(page).locator('[data-compare-labels]')).toBeHidden();
    } else {
      await expect(host(page).locator('[data-comparison-tabs]')).toBeHidden();
      await expect(host(page).locator('[data-compare-labels]')).toBeVisible();
    }
    if ([1440, 768, 390, 320].includes(width)) {
      await host(page).locator('[data-stage]').scrollIntoViewIfNeeded();
      await waitForPaint(page);
      const beforeComparison = await diagnostics(page);
      const comparisonCapture = await host(page).locator('[data-stage]').screenshot({ path: testInfo.outputPath(`comparison-stage-${width}.png`) });
      await expectVisibleFigures(page, comparisonCapture, { before: beforeComparison, after: await diagnostics(page) });
    }
    expect((await state(page)).composition).toEqual(original);
    await host(page).locator('[data-action="compare"]').click();
    expect((await state(page)).composition).toEqual(original);
  }
});

test('rapid garment changes during delayed progressive loading keep the newest model and all six participants', async ({ page }) => {
  const firstModel = deferred();
  const changedModel = deferred();
  let firstRequested = false;
  await page.route('**/dress-code/models/long-dress.glb', async (route) => {
    firstRequested = true;
    await firstModel.promise;
    await route.continue();
  });
  await page.route('**/dress-code/models/short-dress.glb', async (route) => {
    await changedModel.promise;
    await route.continue();
  });
  try {
    await openModule(page);
    await expect.poll(() => firstRequested).toBe(true);
    await host(page).locator('[data-select-person]').selectOption('vincent');
    await host(page).locator('[data-select-model]').selectOption('tailored-suit');
    await host(page).locator('[data-select-model]').selectOption('suit');
    await host(page).locator('[data-select-model]').selectOption('short-dress');
    await host(page).locator('[data-color-id="blue"]').click();
    firstModel.release();
    await expect.poll(async () => (await diagnostics(page)).loadedCharacters).toBeGreaterThan(0);
    await page.waitForTimeout(150); // Let a superseded initial-load iterator resume.
    changedModel.release();
    await waitForGroup(page);
    await expect.poll(async () => (await diagnostics(page)).characters.find((character) => character.id === 'vincent')?.modelId).toBe('short-dress');
    expect((await state(page)).composition.find((person) => person.id === 'vincent')).toMatchObject({ modelId: 'short-dress', colorId: 'blue' });
    expect((await diagnostics(page)).characters.find((character) => character.id === 'vincent').clothing.every((material) => material.color.toLowerCase() === '#728ca3')).toBe(true);
    await host(page).locator('[data-select-model]').selectOption('suit');
    await expect.poll(async () => (await diagnostics(page)).characters.find((character) => character.id === 'vincent')?.modelId).toBe('suit');
    expect((await diagnostics(page)).loadedCharacters).toBe(6);
  } finally {
    firstModel.release();
    changedModel.release();
  }
});

test('without WebGL the shared color/role/comparison logic stays functional, including configured exceptions', async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return String(type).toLowerCase().includes('webgl') ? null : original.call(this, type, ...args);
    };
  });
  await openModule(page);
  await expect(host(page)).toHaveAttribute('data-render-state', 'fallback');
  await expect(host(page).locator('canvas')).toHaveCount(0);
  await host(page).locator('[data-color-id="white"]').click();
  await expect(host(page).locator('[data-compliance]')).toContainText('Interdite');
  const saved = (await state(page)).composition;
  await host(page).locator('[data-action="compare"]').click();
  await expect(host(page).locator('[data-flat]')).toContainText('Couleurs conformes');
  await host(page).locator('[data-action="compare"]').click();
  expect((await state(page)).composition).toEqual(saved);

  await page.evaluate(async () => {
    const { dressCodeConfig } = await import('/dress-code/config.js');
    const element = document.querySelector('wedding-dress-code');
    const parent = element.parentElement;
    const config = structuredClone(dressCodeConfig);
    config.roles.find((role) => role.id === 'maries').rules.exceptions.push({ familyId: 'white', status: 'allowed', message: 'Le blanc est autorisé pour ce rôle dans cet essai.' });
    element.remove();
    element.configuration = config;
    parent.append(element);
  });
  await host(page).locator('[data-color-id="white"]').click();
  await expect(host(page).locator('[data-compliance]')).toContainText('Autorisée');
  await expect(host(page).locator('[data-compliance]')).toContainText('Le blanc est autorisé pour ce rôle');
  await host(page).locator('[data-select-role]').selectOption('invites');
  await expect(host(page).locator('[data-compliance]')).toContainText('Interdite');
  await host(page).locator('[data-action="reset"]').click();
  expect((await state(page)).composition[0]).toMatchObject({ role: 'maries', colorId: 'rose' });
});

test('model network failure preserves the palette and retry restores the 3D group', async ({ page }) => {
  const failModel = (route) => route.fulfill({ status: 503, body: 'Modèle momentanément indisponible.' });
  await page.route('**/dress-code/models/*.glb', failModel);
  await openModule(page);
  await expect(host(page)).toHaveAttribute('data-render-state', 'fallback');
  await expect(host(page).locator('[data-engine-status]')).toContainText('Un personnage n’a pas pu être chargé');
  await host(page).locator('[data-color-id="blue"]').click();
  const saved = (await state(page)).composition;
  await page.unroute('**/dress-code/models/*.glb', failModel);
  await host(page).locator('[data-action="retry"]').click();
  await waitForGroup(page);
  expect((await state(page)).composition).toEqual(saved);
  expect((await diagnostics(page)).characters.find((character) => character.id === saved[0].id).clothing.every((material) => material.color.toLowerCase() === '#728ca3')).toBe(true);
});

test('disconnecting during a delayed model request removes the scene without stale callbacks', async ({ page }) => {
  const pendingModel = deferred();
  let requested = false;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/dress-code/models/*.glb', async (route) => {
    requested = true;
    await pendingModel.promise;
    await route.continue().catch(() => {});
  });
  try {
    await openModule(page);
    await expect.poll(() => requested).toBe(true);
    await host(page).evaluate((element) => element.remove());
    pendingModel.release();
    await page.waitForTimeout(200);
    await expect(page.locator('canvas.dress-code-canvas')).toHaveCount(0);
    expect(errors).toEqual([]);
  } finally {
    pendingModel.release();
  }
});

test('existing mobile navigation and RSVP fields remain usable without submitting a response', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const submissions = [];
  page.on('request', (request) => { if (request.method() === 'POST') submissions.push(request.url()); });
  await page.goto('/infos.html', { waitUntil: 'domcontentloaded' });
  await page.locator('.nav-toggle').click();
  await expect(page.locator('.nav-toggle')).toHaveAttribute('aria-expanded', 'true');
  await page.locator('.mobile-nav [data-nav-page="programme"]').click();
  await expect(page).toHaveURL(/programme\.html$/);
  await page.locator('.nav-toggle').click();
  await page.locator('.mobile-nav-cta').click();
  await expect(page).toHaveURL(/rsvp\.html$/);
  await expect(page.locator('#rsvp-form')).toBeVisible();
  await page.locator('[name="prenom"]').fill('Essai');
  await page.locator('[name="nom"]').fill('Local');
  await page.locator('[name="email"]').fill('essai@example.invalid');
  await page.locator('.rsvp-choice').filter({ has: page.locator('[name="presence_choice"][value="partiel"]') }).click();
  await expect(page.locator('[name="presence_choice"][value="partiel"]')).toBeChecked();
  await expect(page.locator('#presence-details')).toBeVisible();
  await page.locator('[name="jours[]"][value="vendredi"]').check();
  await expect(page.locator('#rsvp-submit')).toBeEnabled();
  expect(submissions).toEqual([]);
});
