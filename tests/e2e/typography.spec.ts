import { expect, test } from '@playwright/test';

test('사이트 전역에서 Gaegu 손글씨 폰트를 사용한다', async ({ page }) => {
  for (const path of ['/', '/create', '/privacy']) {
    await page.goto(path);
    const fontFamily = await page.locator('body').evaluate((body) => getComputedStyle(body).fontFamily);

    expect(fontFamily).toContain('Gaegu');
  }
});

test('기본 글자 크기를 브라우저 기준의 1.3배로 표시한다', async ({ page }) => {
  await page.goto('/');

  const rootFontSize = await page.locator('html').evaluate((root) => getComputedStyle(root).fontSize);
  expect(rootFontSize).toBe('20.8px');
});
