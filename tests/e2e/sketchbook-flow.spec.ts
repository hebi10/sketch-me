import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { expect, test } from '@playwright/test';

async function drawOnCanvas(page: import('@playwright/test').Page) {
  const canvas = page.locator('canvas').first();
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('그림 캔버스를 찾을 수 없습니다.');
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.65, { steps: 12 });
  await page.mouse.up();
  const hasInk = await canvas.evaluate((element: HTMLCanvasElement) => {
    const pixels = element.getContext('2d')?.getImageData(0, 0, element.width, element.height).data;
    return pixels ? pixels.some((value, index) => index % 4 === 3 && value > 0) : false;
  });
  expect(hasInk).toBe(true);
}

function expectPngSize(buffer: Buffer, width: number, height: number) {
  expect(buffer.subarray(1, 4).toString('ascii')).toBe('PNG');
  expect(buffer.readUInt32BE(16)).toBe(width);
  expect(buffer.readUInt32BE(20)).toBe(height);
}

test('모바일에서 생성부터 BEST 스토리 저장까지 완료한다', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'mobile-chrome', '전체 모바일 흐름은 모바일 프로젝트에서 한 번만 실행합니다.');

  const ownerContext = await browser.newContext();
  const ownerPage = await ownerContext.newPage();
  const uniqueName = `해비${Date.now().toString().slice(-6)}`;

  await ownerPage.goto('/create');
  await ownerPage.getByLabel('이름 또는 애칭').fill(uniqueName);
  await ownerPage.locator('#reference-image').setInputFiles(path.resolve('public/brand/sketchbook-favicon-source.png'));
  await expect(ownerPage.getByAltText('그림 참고 사진')).toBeVisible();
  await drawOnCanvas(ownerPage);
  await ownerPage.getByRole('button', { name: '내 스캐치북 만들기' }).click();

  await expect(ownerPage.getByRole('heading', { name: '관리 복구 링크를 보관해 주세요' })).toBeVisible();
  const recoveryUrl = await ownerPage.getByRole('textbox', { name: '관리 복구 링크', exact: true }).inputValue();
  await ownerPage.getByRole('button', { name: '내 스캐치북 관리하기' }).click();
  await expect(ownerPage.getByRole('heading', { name: `${uniqueName}님의 그림 모음` })).toBeVisible();
  const publicPath = await ownerPage.getByRole('link', { name: '친구 페이지 보기' }).getAttribute('href');
  expect(publicPath).toMatch(/^\/s\//);

  const friendContext = await browser.newContext();
  const friendPage = await friendContext.newPage();
  await friendPage.goto(publicPath!);
  await expect(friendPage.getByRole('heading', { name: `${uniqueName}님을 그려주세요` })).toBeVisible();
  await expect(friendPage.getByAltText(`${uniqueName}님이 직접 그린 모습`)).toBeVisible();
  await friendPage.getByRole('link', { name: '친구 스케치 하기' }).click();
  await expect(friendPage.getByRole('button', { name: '참고사진' })).toBeEnabled();
  await drawOnCanvas(friendPage);
  await friendPage.getByLabel('내 이름').fill('모바일 친구');
  await friendPage.getByLabel('한마디 (선택)').fill('멋진 스케치북이야');
  await friendPage.getByRole('button', { name: '그림 남기기' }).click();
  await expect(friendPage.getByText('그림을 남겼어요. 고마워요!')).toBeVisible();

  const recoveredContext = await browser.newContext();
  const recoveredPage = await recoveredContext.newPage();
  await recoveredPage.goto(recoveryUrl);
  const recoveryLocation = new URL(recoveryUrl);
  const recoveryPublicId = recoveryLocation.pathname.split('/')[2];
  const recoveryToken = recoveryLocation.searchParams.get('token');
  const managementCookie = (await recoveredContext.cookies(recoveredPage.url())).find((cookie) => cookie.name === 'sketchbook_manage_token');
  expect(managementCookie?.value).toBe(`${recoveryPublicId}.${recoveryToken}`);
  await expect(recoveredPage).toHaveURL(/\/m\/[^/]+$/);
  await expect(recoveredPage.getByText('모바일 친구')).toBeVisible();
  await recoveredPage.getByText('그림 관리').click();
  await Promise.all([
    recoveredPage.waitForNavigation(),
    recoveredPage.locator('.best-actions button').first().click(),
  ]);
  await expect(recoveredPage.locator('.best-badge')).toHaveText('BEST 1');

  await recoveredPage.getByRole('link', { name: '스토리 이미지 만들기' }).click();
  await expect(recoveredPage).toHaveURL(/\/share$/);
  await expect(recoveredPage.getByAltText('BEST 1 그림')).toBeVisible();
  const downloadPromise = recoveredPage.waitForEvent('download', { timeout: 15_000 });
  await recoveredPage.getByRole('button', { name: 'PNG로 저장하기' }).click();
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('다운로드된 PNG 경로를 찾을 수 없습니다.');
  expectPngSize(await readFile(downloadPath), 1080, 1920);

  await recoveredPage.goto(`/m/${recoveryPublicId}`);
  await recoveredPage.getByRole('button', { name: '스케치북 전체 삭제' }).click();
  await recoveredPage.getByRole('button', { name: '정말 삭제하기' }).click();
  await expect(recoveredPage).toHaveURL('/');
  await friendPage.goto(publicPath!);
  await expect(friendPage.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible();

  await friendContext.close();
  await recoveredContext.close();
  await ownerContext.close();
});
