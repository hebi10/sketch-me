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

test('public image API를 Next optimizer로 직접 우회할 수 없다', async ({ request }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chrome', '모바일 보안 경계는 모바일 프로젝트에서 한 번만 확인합니다.');

  const blockedResponse = await request.get(
    '/_next/image?url=%2Fapi%2Fsketchbooks%2Fpublic-1%2Fowner%2Fimage&w=640&q=75',
  );
  expect(blockedResponse.status()).toBe(404);
  expect(blockedResponse.headers()['cache-control']).toBe('private, no-store');

  const regularImageResponse = await request.get(
    '/_next/image?url=%2Fbrand%2Fsketchbook-favicon-source.png&w=640&q=75',
  );
  expect(regularImageResponse.status()).toBe(200);
});

test('모바일에서 생성부터 BEST 스토리 저장까지 완료한다', async ({ browser }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'mobile-chrome', '전체 모바일 흐름은 모바일 프로젝트에서 한 번만 실행합니다.');

  const uniqueName = `해비${Date.now().toString().slice(-6)}`;
  const testIp = `10.1.${Math.floor(Math.random() * 200) + 20}.${Math.floor(Math.random() * 200) + 20}`;
  const ownerContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': testIp } });
  const ownerPage = await ownerContext.newPage();

  await ownerPage.goto('/create');
  await ownerPage.getByLabel('이름 또는 애칭').fill(uniqueName);
  await ownerPage.getByLabel('관리 비밀번호').fill('1234');
  await ownerPage.locator('#reference-image').setInputFiles(path.resolve('public/brand/sketchbook-favicon-source.png'));
  await expect(ownerPage.getByRole('button', { name: '다른 사진 선택' })).toBeVisible();
  await ownerPage.getByRole('button', { name: '그림 그리기' }).click();
  await expect(ownerPage.getByAltText('그림 참고 사진')).toBeVisible();
  await drawOnCanvas(ownerPage);
  await ownerPage.getByRole('button', { name: '확인' }).click();
  await ownerPage.getByRole('button', { name: '내 스캐치북 만들기' }).click();

  await expect(ownerPage.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible({ timeout: 15_000 });
  await ownerPage.getByRole('button', { name: '내 스캐치북 관리하기' }).click();
  await expect(ownerPage.getByText(`${uniqueName}님의 스케치북`)).toBeVisible();
  await expect(ownerPage.getByRole('heading', { name: '친구들이 그린 나' }).first()).toBeVisible();
  await ownerPage.getByRole('button', { name: '저장 공간 확장하기' }).click();
  await expect(ownerPage.getByRole('dialog', { name: '저장 공간 확장하기' })).toBeVisible();
  await ownerPage.getByRole('radio', { name: /50명 추가.*3,900원/ }).check();
  await ownerPage.getByRole('button', { name: '3,900원 모의 결제하기' }).click();
  await expect(ownerPage.getByText('모의 결제가 완료되어 친구 그림 50개가 추가됐어요.')).toBeVisible();
  await expect(ownerPage.locator('.manage-summary p')).toContainText(/친구 그림\s*0\s*\/\s*70/);
  const managePath = new URL(ownerPage.url()).pathname;
  const managementPublicId = managePath.split('/')[2];
  const publicPath = `/s/${managementPublicId}`;

  const friendContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': testIp } });
  const friendPage = await friendContext.newPage();
  await friendPage.goto(publicPath!);
  await expect(friendPage.getByRole('heading', { name: `${uniqueName}님을 그려주세요` })).toBeVisible();
  await friendPage.getByRole('link', { name: '✎ 그림 남기기' }).click();
  await friendPage.getByRole('button', { name: '그림 그리기' }).click();
  await friendPage.getByRole('button', { name: '그리기 도구 열기' }).click();
  await expect(friendPage.getByRole('button', { name: '참고사진' })).toBeEnabled();
  await drawOnCanvas(friendPage);
  await friendPage.getByRole('button', { name: '확인' }).click();
  await expect(friendPage.getByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
  await friendPage.getByLabel('내 이름').fill('모바일 친구');
  await friendPage.getByLabel('한마디 (선택)').fill('멋진 스케치북이야');
  await friendPage.getByRole('button', { name: '그림 남기기' }).click();
  await expect(friendPage.getByText('그림을 남겼어요. 고마워요!')).toBeVisible();
  const publicDrawingImage = friendPage.getByRole('img', { name: '모바일 친구님의 그림' });
  await expect(publicDrawingImage).toHaveAttribute('src', /\/api\/sketchbooks\/[^/]+\/drawings\/[^/]+\/image$/);
  const publicDrawingImagePath = await publicDrawingImage.getAttribute('src');
  const publicDrawingImageResponse = await friendPage.request.get(
    new URL(publicDrawingImagePath!, friendPage.url()).href,
  );
  expect(publicDrawingImageResponse.headers()['cache-control']).toBe('private, no-store');
  const optimizedPublicDrawingResponse = await friendPage.request.get(
    `/_next/image?url=${encodeURIComponent(publicDrawingImagePath!)}&w=640&q=75`,
  );
  expect(optimizedPublicDrawingResponse.status()).toBe(404);
  expect(optimizedPublicDrawingResponse.headers()['cache-control']).toBe('private, no-store');

  const managerContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': testIp } });
  const managerPage = await managerContext.newPage();
  await managerPage.goto(`/m/${managementPublicId}`);
  await expect(managerPage.getByRole('heading', { name: '관리 비밀번호를 입력해 주세요' })).toBeVisible();
  await managerPage.getByLabel('관리 비밀번호', { exact: true }).fill('1234');
  await managerPage.getByRole('button', { name: '관리 페이지 열기' }).click();
  await expect(managerPage).toHaveURL(`/m/${managementPublicId}`);
  await expect(managerPage.getByText('모바일 친구')).toBeVisible();
  await managerPage.getByText('그림 관리').click();
  await Promise.all([
    managerPage.waitForNavigation(),
    managerPage.locator('.best-actions button').first().click(),
  ]);
  await expect(managerPage.locator('.best-badge')).toHaveText('BEST 1');

  await managerPage.getByLabel('메뉴', { exact: true }).click();
  await managerPage.getByLabel('메뉴 항목').getByRole('link', { name: '스토리 이미지 만들기' }).click();
  await expect(managerPage).toHaveURL(/\/share$/);
  await expect(managerPage.getByAltText('BEST 1 그림')).toBeVisible();
  const storyPreview = managerPage.getByRole('region', { name: '스토리 이미지 미리보기' });
  await expect(storyPreview).toHaveCSS('background-image', /sketchbook-share-background\.webp/);
  await expect(storyPreview.getByText('나도 스케치북에 그림 남기기')).toBeVisible();
  const previewRatio = await storyPreview.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  });
  expect(previewRatio).toBeCloseTo(3 / 4, 2);
  const downloadPromise = managerPage.waitForEvent('download', { timeout: 15_000 });
  await managerPage.getByRole('button', { name: 'PNG로 저장하기' }).click({ force: true });
  const download = await downloadPromise;
  const downloadPath = await download.path();
  if (!downloadPath) throw new Error('다운로드된 PNG 경로를 찾을 수 없습니다.');
  expectPngSize(await readFile(downloadPath), 1080, 1440);

  await managerPage.goto(`/m/${managementPublicId}`);
  await managerPage.getByRole('button', { name: '스케치북 전체 삭제' }).click();
  await managerPage.getByRole('button', { name: '정말 삭제하기' }).click();
  await expect(managerPage).toHaveURL('/');
  await friendPage.goto(publicPath!);
  await expect(friendPage.getByRole('heading', { name: '페이지를 찾을 수 없어요' })).toBeVisible();

  await friendContext.close();
  await managerContext.close();
  await ownerContext.close();
});
