import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';
import sharp from 'sharp';

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
    '/_next/image?url=%2Fbrand%2Flanding-sketch-collage.webp&w=640&q=75',
  );
  expect(regularImageResponse.status()).toBe(200);
});

test('모바일 BEST 이미지 제목을 저장하고 다시 방문해도 유지한다', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'mobile-chrome', '모바일 제목 저장 흐름은 모바일 프로젝트에서 한 번만 실행합니다.');

  const uniqueName = `제목테스트${Date.now().toString().slice(-6)}`;
  await page.goto('/create');
  await page.getByLabel('이름 또는 애칭').fill(uniqueName);
  await page.getByLabel('관리용 비밀번호', { exact: true }).fill('1234');
  await page.getByLabel('관리용 비밀번호 확인').fill('1234');
  await page.getByRole('button', { name: '그림 그리기' }).click();
  await drawOnCanvas(page);
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '내 스캐치북 만들기' }).click();

  await expect(page.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '내 스캐치북 관리하기' }).click();
  await expect(page.getByText(`${uniqueName}님의 스케치북`)).toBeVisible();
  const publicId = new URL(page.url()).pathname.split('/')[2];
  await page.goto(`/m/${publicId}/share?mode=best`);

  await page.getByRole('link', { name: '순위 정하러 가기' }).click();
  await expect(page).toHaveURL(`/m/${publicId}#drawing-ranking`);
  await expect(page.getByRole('region', { name: '그림 순위 선택' })).toBeInViewport();
  await page.goto(`/m/${publicId}/share?mode=best`);

  const headingInput = page.getByRole('textbox', { name: '이미지 제목' });
  await expect(headingInput).toHaveValue('친구들이 그린 내 모습');
  await headingInput.fill('우리들의 소중한 추억');
  await expect(page.getByRole('region', { name: 'BEST 공유 이미지 미리보기' })).toContainText('우리들의 소중한 추억');

  const saveResponse = page.waitForResponse((response) => (
    response.request().method() === 'PATCH'
      && response.url().endsWith(`/api/manage/${publicId}/sketchbook`)
  ));
  await page.getByRole('button', { name: '제목 저장하기' }).click();
  expect((await saveResponse).status()).toBe(200);
  await expect(page.getByText('제목을 저장했어요.')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('textbox', { name: '이미지 제목' })).toHaveValue('우리들의 소중한 추억');
  await expect(page.getByRole('region', { name: 'BEST 공유 이미지 미리보기' })).toContainText('우리들의 소중한 추억');
});

test('모바일에서 소유자 그림 수정과 첫 친구 그림 자동 BEST를 확인한다', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  test.skip(testInfo.project.name !== 'mobile-chrome', '소유자 그림 관리 흐름은 모바일 프로젝트에서 한 번만 실행합니다.');

  const uniqueName = `그림관리${Date.now().toString().slice(-6)}`;
  await page.goto('/create');
  await page.getByLabel('이름 또는 애칭').fill(uniqueName);
  await page.getByLabel('관리용 비밀번호', { exact: true }).fill('1234');
  await page.getByLabel('관리용 비밀번호 확인').fill('1234');
  await page.getByRole('button', { name: '그림 그리기' }).click();
  await drawOnCanvas(page);
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByRole('button', { name: '내 스캐치북 만들기' }).click();

  await expect(page.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: '내 스캐치북 관리하기' }).click();
  await expect(page.getByText(`${uniqueName}님의 스케치북`)).toBeVisible();
  const publicId = new URL(page.url()).pathname.split('/')[2];
  const ownerImagePath = `/api/sketchbooks/${publicId}/owner/image`;
  const originalOwnerImage = await page.request.get(ownerImagePath);
  expect(originalOwnerImage.status()).toBe(200);
  const originalOwnerBytes = await originalOwnerImage.body();

  await page.goto(`/s/${publicId}`);
  await expect(page.getByRole('heading', { name: '내가 그린 나' })).toBeVisible();
  await expect(page.getByRole('img', { name: `${uniqueName}님이 직접 그린 모습` })).toBeVisible();
  await page.getByRole('link', { name: '첫 그림 남기기' }).click();
  await page.getByRole('button', { name: '그림 그리기' }).click();
  await drawOnCanvas(page);
  await page.getByRole('button', { name: '확인' }).click();
  await page.getByLabel('내 이름').fill('첫 번째 친구');
  await page.getByRole('button', { name: '그림 남기기' }).click();
  await expect(page.getByRole('img', { exact: true, name: '첫 번째 친구님의 그림' })).toHaveCount(0);
  await expect(page.getByRole('img', { name: 'BEST 1, 첫 번째 친구님의 그림' })).toBeVisible();
  await expect(page.getByText('선정 전')).toHaveCount(0);

  await page.goto(`/m/${publicId}`);
  const ownerDrawingCard = page.locator('article.owner-original-card');
  await ownerDrawingCard.getByText('순위 선택', { exact: true }).click();
  await ownerDrawingCard.getByRole('link', { name: '내 그림 수정하기' }).click();
  await expect(page).toHaveURL(`/m/${publicId}/owner/edit`);
  await page.getByRole('button', { name: '그림 편집 열기' }).click();
  await drawOnCanvas(page);
  await page.getByRole('button', { name: '확인' }).click();
  const updateResponse = page.waitForResponse((response) => (
    response.request().method() === 'PUT'
      && response.url().endsWith(`/api/manage/${publicId}/owner/image`)
  ));
  await page.getByRole('button', { name: '변경 저장하기' }).click();
  expect((await updateResponse).status()).toBe(200);
  await expect(page).toHaveURL(`/m/${publicId}`);

  const updatedOwnerImage = await page.request.get(ownerImagePath);
  expect(updatedOwnerImage.status()).toBe(200);
  expect(await updatedOwnerImage.body()).not.toEqual(originalOwnerBytes);
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
  await ownerPage.getByLabel('관리용 비밀번호', { exact: true }).fill('1234');
  await ownerPage.getByLabel('관리용 비밀번호 확인').fill('1234');
  await ownerPage.getByRole('button', { name: '내 스캐치북 만들기' }).click();

  await expect(ownerPage.getByRole('heading', { name: '스캐치북이 완성됐어요' })).toBeVisible({ timeout: 15_000 });
  await ownerPage.getByRole('button', { name: '내 스캐치북 관리하기' }).click();
  await expect(ownerPage.getByText(`${uniqueName}님의 스케치북`)).toBeVisible();
  await expect(ownerPage.getByRole('heading', { name: '친구들이 그린 나' }).first()).toBeVisible();
  await ownerPage.getByRole('button', { name: '저장 공간 추가하기' }).click();
  await expect(ownerPage.getByRole('dialog', { name: '상품 선택하기' })).toBeVisible();
  await ownerPage.getByRole('radio', { name: /50명 추가.*4,490원/ }).check();
  await ownerPage.getByLabel('결제용 휴대전화번호').fill('010-1234-5678');
  const capacityPurchaseButton = ownerPage.getByRole('button', { name: '4,490원 결제하기' });
  await expect(capacityPurchaseButton).toBeDisabled();
  await ownerPage.getByRole('checkbox', { name: /결제 완료 즉시 디지털 혜택 제공/ }).check();
  await expect(capacityPurchaseButton).toBeEnabled();
  await ownerPage.getByRole('button', { name: '결제창 닫기' }).click();
  await expect(ownerPage.locator('.manage-summary p')).toContainText(/친구 그림\s*0\s*\/\s*10/);
  const managePath = new URL(ownerPage.url()).pathname;
  const managementPublicId = managePath.split('/')[2];
  const publicPath = `/s/${managementPublicId}`;

  const friendContext = await browser.newContext({ extraHTTPHeaders: { 'x-forwarded-for': testIp } });
  const friendPage = await friendContext.newPage();
  await friendPage.goto(publicPath!);
  await expect(friendPage.getByRole('heading', { name: `${uniqueName}님을 그려주세요` })).toBeVisible();
  await friendPage.getByRole('link', { name: '첫 그림 남기기' }).click();
  const importedDrawing = await sharp({
    create: {
      background: { alpha: 1, b: 160, g: 100, r: 60 },
      channels: 4,
      height: 12,
      width: 8,
    },
  }).png().toBuffer();
  await friendPage.getByLabel('이미지로 가져오기').setInputFiles({
    buffer: importedDrawing,
    mimeType: 'image/png',
    name: 'mobile-friend.png',
  });
  await expect(friendPage.getByRole('img', { name: '그린 그림 미리보기' })).toBeVisible();
  await expect(friendPage.getByRole('status')).toHaveText('이미지를 그림으로 가져왔어요.');
  await friendPage.getByLabel('내 이름').fill('모바일 친구');
  await friendPage.getByLabel('한마디 (선택)').fill('멋진 스케치북이야');
  await friendPage.getByRole('button', { name: '그림 남기기' }).click();
  await expect(friendPage.getByText('그림을 남겼어요. 고마워요!')).toBeVisible();
  await expect(friendPage.getByRole('img', { name: 'BEST 1, 모바일 친구님의 그림' })).toBeVisible();
  await expect(friendPage.getByText('선정 전')).toHaveCount(0);
  const publicDrawingImage = friendPage.getByRole('img', { name: 'BEST 1, 모바일 친구님의 그림' });
  await expect(publicDrawingImage).toHaveAttribute('src', /\/api\/sketchbooks\/[^/]+\/drawings\/[^/]+\/thumbnail\?v=[^&]+$/);
  const publicDrawingImagePath = await publicDrawingImage.getAttribute('src');
  const publicDrawingImageResponse = await friendPage.request.get(
    new URL(publicDrawingImagePath!, friendPage.url()).href,
  );
  expect(publicDrawingImageResponse.headers()['cache-control']).toBe('public, max-age=300, s-maxage=300, stale-while-revalidate=60');
  expect(publicDrawingImageResponse.headers()['content-type']).toBe('image/webp');
  expect(await sharp(await publicDrawingImageResponse.body()).metadata()).toMatchObject({
    format: 'webp',
    height: 320,
    width: 320,
  });
  const optimizedPublicDrawingResponse = await friendPage.request.get(
    `/_next/image?url=${encodeURIComponent(publicDrawingImagePath!)}&w=640&q=75`,
  );
  expect(optimizedPublicDrawingResponse.status()).toBe(404);
  expect(optimizedPublicDrawingResponse.headers()['cache-control']).toBe('private, no-store');

  const managerPage = ownerPage;
  await managerPage.goto(`/m/${managementPublicId}`);
  await expect(managerPage.getByText('모바일 친구', { exact: true })).toBeVisible();
  const friendDrawingCard = managerPage.locator('article.manage-drawing-card').filter({ hasText: '모바일 친구' });
  await friendDrawingCard.getByText('순위 선택').click();
  await friendDrawingCard.getByRole('button', { name: '그림 삭제' }).click();
  const deleteDrawingDialog = managerPage.getByRole('dialog', { name: '친구 그림 삭제' });
  await expect(deleteDrawingDialog).toBeVisible();
  await expect(deleteDrawingDialog.getByRole('checkbox', { name: /1회 복구/ })).not.toBeChecked();
  await deleteDrawingDialog.getByRole('button', { name: '취소' }).click();
  await expect(deleteDrawingDialog).toBeHidden();
  await Promise.all([
    managerPage.waitForResponse((response) => (
      response.request().method() === 'PATCH'
        && response.url().includes(`/api/manage/${managementPublicId}/drawings/`)
    )),
    friendDrawingCard.locator('.best-actions button').first().click(),
  ]);
  await expect(managerPage.locator('.best-badge')).toHaveText('BEST 1');

  await managerPage.getByLabel('메뉴', { exact: true }).click();
  await managerPage.getByLabel('메뉴 항목').getByRole('button', { name: '이미지 제작' }).click();
  const singleChooser = managerPage.getByRole('dialog', { name: '이미지 제작 방식 선택' });
  await singleChooser.getByRole('link', { name: /그림 하나 제작하기/ }).click();
  await expect(managerPage).toHaveURL(/\/share\?mode=single$/);

  const singleHeading = managerPage.getByRole('textbox', { name: '이미지 제목' });
  await expect(singleHeading).toHaveValue('친구가 그린 나');
  await singleHeading.fill('한 장의 소중한 기억');
  const singleSaveResponse = managerPage.waitForResponse((response) => (
    response.request().method() === 'PATCH'
      && response.url().endsWith(`/api/manage/${managementPublicId}/sketchbook`)
  ));
  await managerPage.getByRole('button', { name: '제목 저장하기' }).click();
  expect((await singleSaveResponse).status()).toBe(200);
  await managerPage.getByRole('searchbox', { name: '그린 사람 이름' }).fill('모바일 친구');
  await managerPage.getByRole('button', { name: '모바일 친구님의 그림 선택' }).click();
  const singlePreview = managerPage.getByRole('region', { name: '정사각형 공유 이미지 미리보기' });
  await expect(singlePreview).toContainText('한 장의 소중한 기억');
  await expect(singlePreview).toContainText('그린 사람 · 모바일 친구');
  await expect(managerPage.getByText('1080 × 1080 · 1:1 공유 이미지')).toBeVisible();
  const singleDownloadPromise = managerPage.waitForEvent('download', { timeout: 15_000 });
  await managerPage.getByRole('button', { name: 'PNG로 저장하기' }).click();
  const singleDownload = await singleDownloadPromise;
  expect(singleDownload.suggestedFilename()).toMatch(/-sketchbook-single\.png$/);
  const singleDownloadPath = await singleDownload.path();
  if (!singleDownloadPath) throw new Error('다운로드된 정사각형 PNG 경로를 찾을 수 없습니다.');
  expectPngSize(await readFile(singleDownloadPath), 1080, 1080);

  await managerPage.goto(`/m/${managementPublicId}`);
  await managerPage.getByLabel('메뉴', { exact: true }).click();
  await managerPage.getByLabel('메뉴 항목').getByRole('button', { name: '이미지 제작' }).click();
  const bestChooser = managerPage.getByRole('dialog', { name: '이미지 제작 방식 선택' });
  await bestChooser.getByRole('link', { name: /BEST 이미지 제작하기/ }).click();
  await expect(managerPage).toHaveURL(/\/share\?mode=best$/);
  await expect(managerPage.getByAltText('BEST 1 그림')).toBeVisible();
  const storyPreview = managerPage.getByRole('region', { name: 'BEST 공유 이미지 미리보기' });
  await expect(storyPreview).toHaveCSS('background-image', /sketchbook-share-background\.webp/);
  await expect(storyPreview.getByText('나도 스케치북에 그림 남기기')).toHaveCount(0);
  await expect(managerPage.getByRole('img', { name: '스캐치북 워터마크' })).toBeVisible();
  const previewRatio = await storyPreview.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return bounds.width / bounds.height;
  });
  expect(previewRatio).toBeCloseTo(3 / 4, 2);
  const watermarkTrigger = managerPage.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' });
  await watermarkTrigger.focus();
  await watermarkTrigger.press('Enter');
  const watermarkDialog = managerPage.getByRole('dialog', { name: '워터마크 없이 저장하기' });
  await expect(watermarkDialog).toBeVisible();
  await watermarkDialog.getByLabel('결제용 휴대전화번호').fill('010-1234-5678');
  const watermarkPurchaseButton = watermarkDialog.getByRole('button', { name: '1,000원 결제하기' });
  await expect(watermarkPurchaseButton).toBeDisabled();
  await watermarkDialog.getByRole('checkbox', { name: /결제 완료 즉시 디지털 혜택 제공/ }).check();
  await expect(watermarkPurchaseButton).toBeEnabled();
  await managerPage.keyboard.press('Escape');
  await expect(watermarkDialog).toBeHidden();
  await expect(managerPage.getByRole('img', { name: '스캐치북 워터마크' })).toBeVisible();
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
  await ownerContext.close();
});
