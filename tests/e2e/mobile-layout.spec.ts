import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

test('핵심 진입 화면이 모바일 뷰포트에서 넘치지 않는다', async ({ page }) => {
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const path of ['/', '/create']) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({ clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
      const primary = page.locator('.button--primary').first();
      if (await primary.count()) expect((await primary.boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(44);
    }
  }
});
