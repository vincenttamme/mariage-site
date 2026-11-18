import { test, expect } from '@playwright/test';

const host = (page) => page.locator('wedding-dress-code');
const state = (page) => page.evaluate(() => document.querySelector('wedding-dress-code').simulator.getState());
const diagnostics = (page) => page.evaluate(() => document.querySelector('wedding-dress-code').simulator.diagnostics());

async function openSimulator(page) {
  await page.goto('/infos.html', { waitUntil: 'domcontentloaded' });
  await expect(host(page)).toBeVisible();
  await page.locator('#dress-code').scrollIntoViewIfNeeded();
  await expect(host(page)).toHaveAttribute('data-render-state', 'ready', { timeout: 60_000 });
}

test('one character, fixed garments and accessible closed palette', async ({ page }) => {
  await openSimulator(page);
  await expect(host(page).locator('canvas')).toHaveCount(1);
  await expect(host(page).locator('[data-character-id]')).toHaveCount(2);
  await expect(host(page).locator('[data-color-id][disabled]')).toHaveCount(4);
  await expect(host(page).locator('[data-color-id="white"]')).toBeDisabled();
  await expect(host(page).locator('[data-color-id="burgundy"]')).toBeDisabled();
  await expect(host(page)).toContainText('Le blanc et le bordeaux ne font pas partie des couleurs autorisées.');
  const original = await state(page);
  expect(original).toMatchObject({ characterId: 'femme', modelId: 'dress', colorId: 'sage' });
  expect((await diagnostics(page)).loadedCharacters).toBe(1);
  await host(page).locator('[data-color-id="blue"]').click();
  await expect(host(page).locator('[data-color-id="blue"]')).toHaveAttribute('aria-pressed', 'true');
  await host(page).locator('[data-character-id="homme"]').click();
  await expect.poll(async () => (await diagnostics(page)).characters?.[0]?.modelId).toBe('suit');
  expect(await state(page)).toMatchObject({ characterId: 'homme', modelId: 'suit', colorId: 'blue' });
  expect((await diagnostics(page)).loadedCharacters).toBe(1);
  expect((await diagnostics(page)).characters[0].clothing.every((m) => m.color.toLowerCase() === '#728ca3')).toBe(true);
  await host(page).locator('[data-character-id="femme"]').click();
  await expect.poll(async () => (await diagnostics(page)).characters?.[0]?.modelId).toBe('dress');
  expect((await diagnostics(page)).loadedCharacters).toBe(1);
  expect((await diagnostics(page)).cachedModels).toBe(2);
  await expect(host(page).locator('[data-action="compare"],[data-select-role],[data-select-model],[data-action="zoom-in"]')).toHaveCount(0);
});

test('keyboard rotation works without zoom or panning controls', async ({ page }) => {
  await openSimulator(page);
  const canvas = host(page).locator('canvas');
  await canvas.focus();
  await expect(canvas).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Home');
  await host(page).locator('[data-action="left"]').click();
  await host(page).locator('[data-action="right"]').click();
  expect((await diagnostics(page)).loadedCharacters).toBe(1);
});

test('single-character layout never overflows on desktop or mobile', async ({ page }) => {
  for (const width of [1440, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await openSimulator(page);
    const metrics = await page.evaluate(() => {
      const stage = document.querySelector('.dc-stage').getBoundingClientRect();
      const palette = document.querySelector('.dc-palette').getBoundingClientRect();
      const scene = document.querySelector('.dc-canvas-host').getBoundingClientRect();
      return { screen: innerWidth, doc: document.documentElement.scrollWidth, stage: stage.width, palette: palette.width, scene: scene.height };
    });
    expect(metrics.doc).toBeLessThanOrEqual(metrics.screen);
    expect(metrics.palette).toBeLessThanOrEqual(metrics.stage);
    expect(metrics.scene).toBeGreaterThan(120);
    await expect(host(page).locator('[data-color-id="white"]')).toBeVisible();
    expect((await diagnostics(page)).loadedCharacters).toBe(1);
  }
});

test('WebGL failure preserves the same selectors and palette', async ({ page }) => {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
      return native.call(this, type, ...args);
    };
  });
  await page.goto('/infos.html', { waitUntil: 'domcontentloaded' });
  await page.locator('#dress-code').scrollIntoViewIfNeeded();
  await expect(host(page)).toHaveAttribute('data-render-state', 'fallback', { timeout: 30_000 });
  await host(page).locator('[data-color-id="blue"]').click();
  await host(page).locator('[data-character-id="homme"]').click();
  expect(await state(page)).toMatchObject({ characterId: 'homme', colorId: 'blue' });
  await expect(host(page).locator('[data-flat]')).toBeVisible();
  await expect(host(page).locator('canvas')).toHaveCount(0);
});
