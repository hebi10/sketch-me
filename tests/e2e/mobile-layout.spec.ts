import { expect, test } from '@playwright/test';

import { createAdminEmulatorSession } from './admin-auth-helper';

const viewports = [
  { width: 280, height: 700 },
  { width: 320, height: 700 },
  { width: 390, height: 667 },
  { width: 390, height: 844 },
  { width: 650, height: 900 },
];

test('화면은 650px 모바일 캔버스 안에 중앙 정렬되고 바깥 배경은 투명하다', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 900 });

  for (const path of ['/', '/create']) {
    await page.goto(path);
    const layout = await page.locator('main').evaluate((main) => {
      const rect = main.getBoundingClientRect();
      return {
        width: rect.width,
        left: rect.left,
        right: window.innerWidth - rect.right,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
      };
    });

    expect(layout.width).toBeLessThanOrEqual(650);
    expect(Math.abs(layout.left - layout.right)).toBeLessThanOrEqual(1);
    expect(layout.bodyBackground).toBe('rgba(0, 0, 0, 0)');
  }
});

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

test('이미지 제작 유형과 두 편집 화면이 모바일 너비에서 넘치지 않는다', async ({ page }) => {
  const createResponse = await page.request.post('/api/sketchbooks', {
    data: {
      managePin: '1234',
      name: `레이아웃${Date.now().toString().slice(-6)}`,
    },
    headers: { 'x-forwarded-for': `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
  });
  expect(createResponse.status()).toBe(200);
  const { manageUrl } = await createResponse.json() as { manageUrl: string };

  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    for (const suffix of ['/share', '/share?mode=single', '/share?mode=best']) {
      await page.goto(`${manageUrl}${suffix}`);
      const dimensions = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    }
  }
});

test('관리자 화면은 지원 모바일 너비에서 넘치지 않고 메뉴를 유지한다', async ({ page }) => {
  await createAdminEmulatorSession(page);

  for (const width of [320, 390, 650]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/admin');
    const dimensions = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));
    expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
    await expect(page.getByRole('navigation', { name: '관리자 메뉴' })).toBeVisible();
  }
});

test('좁은 화면에서도 주요 제목에 한 글자만 남는 줄이 생기지 않는다', async ({ page }) => {
  for (const width of [280, 320]) {
    await page.setViewportSize({ width, height: 700 });
    for (const path of ['/', '/create']) {
      await page.goto(path);
      const headings = page.locator('h1');
      for (let headingIndex = 0; headingIndex < await headings.count(); headingIndex += 1) {
        const lines = await headings.nth(headingIndex).evaluate((heading) => {
        const textNode = heading.firstChild;
        if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return [];
        const rows = new Map<number, string>();
        const text = textNode.textContent ?? '';
        for (let index = 0; index < text.length; index += 1) {
          const range = document.createRange();
          range.setStart(textNode, index);
          range.setEnd(textNode, index + 1);
          const top = Math.round(range.getBoundingClientRect().top);
          rows.set(top, `${rows.get(top) ?? ''}${text[index]}`);
        }
        return [...rows.values()].map((line) => line.trim()).filter(Boolean);
        });

        expect(lines.every((line) => [...line].length > 1), `${width}px ${path} 제목 줄: ${lines.join(' / ')}`).toBe(true);
      }
    }
  }
});

test('좁은 화면에서 한글 단어가 음절 중간에 끊기지 않는다', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 700 });

  for (const path of ['/', '/create']) {
    await page.goto(path);
    const splitWords = await page.locator('main').evaluate((main) => {
      const broken: string[] = [];
      main.querySelectorAll('h1, h2, p').forEach((element) => {
        const textNode = [...element.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        const text = textNode?.textContent ?? '';
        for (const match of text.matchAll(/\S+/g)) {
          const start = match.index ?? 0;
          const word = match[0];
          const wordRange = document.createRange();
          wordRange.setStart(textNode!, start);
          wordRange.setEnd(textNode!, start + word.length);
          if (wordRange.getBoundingClientRect().width > element.clientWidth) continue;
          const rows = new Set<number>();
          for (let index = start; index < start + word.length; index += 1) {
            const characterRange = document.createRange();
            characterRange.setStart(textNode!, index);
            characterRange.setEnd(textNode!, index + 1);
            rows.add(Math.round(characterRange.getBoundingClientRect().top));
          }
          if (rows.size > 1) broken.push(word);
        }
      });
      return broken;
    });

    expect(splitWords, `${path}에서 중간이 끊긴 단어`).toEqual([]);
  }
});

test('브랜드 로고 묶음은 단순 헤더의 가운데에 정렬된다', async ({ page }) => {
  await page.setViewportSize({ width: 280, height: 700 });

  for (const path of ['/create', '/privacy']) {
    await page.goto(path);
    const alignment = await page.locator('.simple-header').evaluate((header) => {
      const mark = header.querySelector('.wordmark-mark');
      const label = header.querySelector('.wordmark span');
      if (!mark || !label) return null;
      const headerRect = header.getBoundingClientRect();
      const markRect = mark.getBoundingClientRect();
      const labelRect = label.getBoundingClientRect();
      const contentCenter = (Math.min(markRect.left, labelRect.left) + Math.max(markRect.right, labelRect.right)) / 2;

      return {
        centerDelta: Math.abs(contentCenter - (headerRect.left + headerRect.width / 2)),
        markSize: markRect.width,
      };
    });

    expect(alignment).not.toBeNull();
    expect(alignment?.centerDelta ?? Infinity).toBeLessThanOrEqual(1);
    expect(alignment?.markSize).toBe(32);
  }
});

test('그리기 캔버스는 모바일에서도 정사각형이다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');
  await page.getByRole('button', { name: '그림 그리기' }).click();

  const canvas = page.getByLabel('내 모습을 그리는 캔버스');
  await expect(canvas).toHaveAttribute('width', '720');
  await expect(canvas).toHaveAttribute('height', '720');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(1, 2);
});

test('320px 모바일에서 가이드 중앙선을 조작한다', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto('/create');
  await page.getByRole('button', { name: '그림 그리기' }).click();
  await page.getByRole('button', { name: '그리기 도구 열기' }).click();
  await page.getByRole('button', { name: '가이드' }).click();

  await expect(page.getByText('중앙선을 켜고 얼굴 비율을 확인해 보세요.')).toBeVisible();
  await expect(page.getByText('얼굴 만들기')).toHaveCount(0);
  await expect(page.getByTestId('canvas-crosshair')).toBeVisible();

  await page.getByRole('checkbox', { name: '중앙선 보기' }).uncheck();
  await expect(page.getByTestId('canvas-crosshair')).toHaveCount(0);
  await page.getByRole('checkbox', { name: '중앙선 보기' }).check();
});

test('설정 패널을 열면 캔버스가 가려지지 않고 위쪽 정사각형 미리보기로 줄어든다', async ({ page }) => {
  for (const viewport of [{ width: 320, height: 780 }, { width: 390, height: 844 }, { width: 650, height: 900 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/create');
    await page.getByRole('button', { name: '그림 그리기' }).click();

    const stage = page.locator('.sketch-stage');
    const closedBounds = await stage.boundingBox();
    await page.getByRole('button', { name: '그리기 도구 열기' }).click();
    await page.getByRole('button', { name: '가이드' }).click();

    const openBounds = await stage.boundingBox();
    const panelBounds = await page.locator('.editor-control-panel').boundingBox();
    expect(openBounds).not.toBeNull();
    expect(panelBounds).not.toBeNull();
    expect((openBounds?.width ?? 0) / (openBounds?.height ?? 1)).toBeCloseTo(1, 2);
    expect(openBounds?.width ?? Infinity).toBeLessThan(closedBounds?.width ?? 0);
    expect((openBounds?.y ?? 0) + (openBounds?.height ?? 0)).toBeLessThanOrEqual((panelBounds?.y ?? 0) + 1);
  }
});

test('그림 그리기에서 캔버스 아래 아이콘으로 도구를 열고 확인한다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');

  await page.getByRole('button', { name: '그림 그리기' }).click();
  const fullscreen = page.getByRole('dialog', { name: '전체 화면 그리기' });
  await expect(fullscreen).toBeVisible();
  await expect(page.getByRole('navigation', { name: '그림 편집 단계' })).toBeHidden();
  await expect(page.getByLabel('완성된 그림 불러오기')).toHaveCount(0);

  const canvas = page.getByLabel('내 모습을 그리는 캔버스');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect((canvasBounds?.width ?? 0) / (canvasBounds?.height ?? 1)).toBeCloseTo(1, 2);

  const confirmButton = page.getByRole('button', { name: '확인' });
  const exitButton = page.getByRole('button', { name: '그리기 나가기' });
  const undoButton = page.getByRole('button', { name: '그림 기록 한 단계 이전' });
  const toolsButton = page.getByRole('button', { name: '그리기 도구 열기' });
  await expect(toolsButton.locator('img')).toHaveAttribute('src', /drawing-controls\.webp/);
  await expect(exitButton.locator('img')).toHaveAttribute('src', /fullscreen-exit\.webp/);
  await expect(undoButton.locator('img')).toHaveAttribute('src', /fullscreen-back\.webp/);
  const confirmBounds = await confirmButton.boundingBox();
  const exitBounds = await exitButton.boundingBox();
  const undoBounds = await undoButton.boundingBox();
  const toolsBounds = await toolsButton.boundingBox();
  expect(confirmBounds).not.toBeNull();
  expect(exitBounds).not.toBeNull();
  expect(undoBounds).not.toBeNull();
  expect(toolsBounds).not.toBeNull();
  expect(await page.locator('.fullscreen-controls').evaluate((element) => getComputedStyle(element).position)).toBe('static');
  expect(exitBounds?.x ?? Infinity).toBeLessThan(undoBounds?.x ?? 0);
  expect(undoBounds?.x ?? Infinity).toBeLessThan(toolsBounds?.x ?? 0);
  expect(toolsBounds?.x ?? Infinity).toBeLessThan(confirmBounds?.x ?? 0);
  expect(exitBounds?.y).toBe(confirmBounds?.y);
  expect(exitBounds?.y ?? 0).toBeGreaterThanOrEqual((canvasBounds?.y ?? 0) + (canvasBounds?.height ?? 0));

  await toolsButton.click();
  await expect(page.getByRole('navigation', { name: '그림 편집 단계' })).toBeVisible();
  const previewBounds = await canvas.boundingBox();
  expect(previewBounds).not.toBeNull();
  await page.mouse.move((previewBounds?.x ?? 0) + 80, (previewBounds?.y ?? 0) + 80);
  await page.mouse.down();
  await expect(page.getByTestId('drawing-loupe')).toHaveAttribute('data-active', 'true');
  await page.mouse.move((previewBounds?.x ?? 0) + 140, (previewBounds?.y ?? 0) + 140);
  await page.mouse.up();
  await expect(page.getByTestId('drawing-loupe')).toHaveAttribute('data-active', 'false');
  await confirmButton.click();
  await expect(fullscreen).toHaveCount(0);
});
