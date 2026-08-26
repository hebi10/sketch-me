import { expect, test } from '@playwright/test';

import {
  createAdminEmulatorSession,
  exchangeAdminIdToken,
  readFirebaseIdTokenClaims,
  signInAdminWithPassword,
} from './admin-auth-helper';
import { ADMIN_E2E, seedAdminScenario } from './admin-fixture';

const publicDrawingImage = `/api/sketchbooks/${ADMIN_E2E.publicId}/drawings/${ADMIN_E2E.drawingId}/image`;
const publicOwnerImage = `/api/sketchbooks/${ADMIN_E2E.publicId}/owner/image`;
const validDrawingPayload = {
  authorName: '차단 확인 친구',
  imageDataUrl: 'data:image/webp;base64,UklGRgQAAABXRUJQ',
  message: '',
  usedReferenceImage: false,
};

test.beforeEach(async () => {
  await seedAdminScenario();
});

test('비밀번호 공급자 ID 토큰은 관리자 세션으로 교환되지 않는다', async ({ page }) => {
  const { idToken, localId } = await signInAdminWithPassword(page);
  const claims = readFirebaseIdTokenClaims(idToken);

  expect(localId).toBe(ADMIN_E2E.uid);
  expect(claims.firebase?.sign_in_provider).toBe('password');
  expect((await exchangeAdminIdToken(page, idToken)).status()).toBe(403);
});

test('관리자가 공개 노출을 차단하고 복구한 뒤 로그아웃한다', async ({ page }) => {
  await createAdminEmulatorSession(page);

  await page.goto('/admin');
  await expect(page.getByText('전체 스케치북')).toBeVisible();

  await page.getByRole('link', { name: '스케치북', exact: true }).click();
  const fixtureBook = page.getByRole('article').filter({ hasText: '관리자 E2E' });
  await fixtureBook.getByRole('link', { name: '관리자 E2E 상세 보기' }).click();
  await expect(page.getByRole('heading', { name: '관리자 E2E' })).toBeVisible();
  expect((await page.request.get(`/s/${ADMIN_E2E.publicId}`)).status()).toBe(200);
  expect((await page.request.get(publicOwnerImage)).status()).toBe(200);
  expect((await page.request.get(publicDrawingImage)).status()).toBe(200);

  await page.getByRole('button', { name: '서비스에서 비활성화' }).click();
  await page.getByRole('button', { name: '비활성화하기' }).click();
  await expect(page.locator('.admin-status')).toHaveText('비활성화');

  const blockedPublicPage = await page.request.get(`/s/${ADMIN_E2E.publicId}`);
  expect(blockedPublicPage.status()).toBe(200);
  expect(await blockedPublicPage.text()).toContain('현재 이용할 수 없는 스케치북이에요');
  expect((await page.request.post(`/api/sketchbooks/${ADMIN_E2E.publicId}/drawings`, {
    data: validDrawingPayload,
  })).status()).toBe(404);
  expect((await page.request.get(publicOwnerImage)).status()).toBe(404);
  expect((await page.request.get(publicDrawingImage)).status()).toBe(404);

  await page.getByRole('button', { name: '비활성화 해제' }).click();
  await page.getByRole('button', { name: '비활성화 해제하기' }).click();
  await expect(page.locator('.admin-status')).toHaveText('정상');
  expect((await page.request.get(`/s/${ADMIN_E2E.publicId}/draw`)).status()).toBe(200);
  expect((await page.request.post(`/api/sketchbooks/${ADMIN_E2E.publicId}/drawings`, {
    data: validDrawingPayload,
  })).status()).toBe(400);
  expect((await page.request.get(publicOwnerImage)).status()).toBe(200);
  expect((await page.request.get(publicDrawingImage)).status()).toBe(200);

  await page.getByRole('link', { name: '그림', exact: true }).click();
  const fixtureDrawing = page.getByRole('article', { name: '친구1님의 그림' });
  const adminImagePath = await fixtureDrawing.getByRole('img', { name: '친구1님의 그림' }).getAttribute('src');
  expect(adminImagePath).not.toBeNull();
  expect((await page.request.get(adminImagePath!)).status()).toBe(200);

  await fixtureDrawing.getByRole('button', { name: '서비스에서 숨기기' }).click();
  await page.getByRole('button', { name: '숨기기', exact: true }).click();
  await expect(fixtureDrawing.getByText('운영자 숨김').first()).toBeVisible();
  expect((await page.request.get(adminImagePath!)).status()).toBe(200);
  expect((await page.request.get(publicDrawingImage)).status()).toBe(404);

  await fixtureDrawing.getByRole('button', { name: '숨김 해제' }).click();
  await page.getByRole('button', { name: '숨김 해제하기' }).click();
  await expect(fixtureDrawing.getByText('운영 정상').first()).toBeVisible();
  expect((await page.request.get(publicDrawingImage)).status()).toBe(200);

  await page.getByRole('link', { name: '결제', exact: true }).click();
  const fixturePayment = page.getByRole('article', { name: 'ADMIN-E2E-ORDER 결제' });
  await expect(fixturePayment.getByText('모의 결제')).toBeVisible();
  await expect(fixturePayment.getByText('4,490원')).toBeVisible();
  await expect(fixturePayment.getByRole('button')).toHaveCount(0);

  await page.getByRole('button', { name: '로그아웃' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});
