import { expect, test } from '@playwright/test';

test('랜딩에서 스캐치북 생성으로 이동한다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '친구들은 나를 어떻게 그리고 있을까?' })).toBeVisible();
  await page.getByRole('link', { name: '내 스캐치북 만들기' }).click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole('heading', { name: '내 스캐치북 만들기' })).toBeVisible();
});
