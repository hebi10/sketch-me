import { expect, test } from '@playwright/test';

test('랜딩에서 스캐치북 생성으로 이동한다', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '친구들이 보는 내 모습은?' })).toBeVisible();
  await expect(page.getByRole('img', { name: '친구들이 손으로 그린 네 장의 초상화 카드' })).toHaveAttribute(
    'src',
    /landing-sketch-collage-v2\.png/,
  );
  const image = page.getByRole('img', { name: '친구들이 손으로 그린 네 장의 초상화 카드' });
  const cta = page.getByRole('link', { name: '내 스캐치북 만들기' });
  const [imageBox, ctaBox] = await Promise.all([image.boundingBox(), cta.boundingBox()]);
  expect(imageBox).not.toBeNull();
  expect(ctaBox).not.toBeNull();
  expect(ctaBox!.y - (imageBox!.y + imageBox!.height)).toBeGreaterThanOrEqual(16);
  await cta.click();

  await expect(page).toHaveURL(/\/create$/);
  await expect(page.getByRole('heading', { name: '내 스캐치북 만들기' })).toBeVisible();
});

test('320×568 첫 화면에서 CTA와 개인정보 안내 링크를 바로 사용할 수 있다', async ({ page }) => {
  await page.setViewportSize({ height: 568, width: 320 });
  await page.goto('/');

  await expect(page.getByRole('link', { name: '내 스캐치북 만들기' })).toBeInViewport({ ratio: 1 });
  const footerLink = page.getByRole('link', { name: '개인정보 처리방침' }).last();
  await expect(footerLink).toBeVisible();
  expect((await footerLink.boundingBox())?.height).toBeGreaterThanOrEqual(44);
});
