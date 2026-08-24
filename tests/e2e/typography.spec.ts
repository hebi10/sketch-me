import { expect, test } from '@playwright/test';

test('사이트 전역에서 Gaegu 손글씨 폰트를 사용한다', async ({ page }) => {
  for (const path of ['/', '/create', '/privacy']) {
    await page.goto(path);
    const fontFamily = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);

    expect(fontFamily).toContain('Gaegu');
  }
});
