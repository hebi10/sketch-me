import { expect, test } from '@playwright/test';

const viewports = [
  { width: 280, height: 700 },
  { width: 320, height: 700 },
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

  const canvas = page.getByLabel('내 모습을 그리는 캔버스');
  await expect(canvas).toHaveAttribute('width', '720');
  await expect(canvas).toHaveAttribute('height', '720');
  const bounds = await canvas.boundingBox();

  expect(bounds).not.toBeNull();
  expect((bounds?.width ?? 0) / (bounds?.height ?? 1)).toBeCloseTo(1, 2);
});

test('전체 화면 그리기에서 우측 하단 아이콘으로 도구를 열고 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/create');

  await page.getByRole('button', { name: '전체 화면으로 그리기' }).click();
  const fullscreen = page.getByRole('dialog', { name: '전체 화면 그리기' });
  await expect(fullscreen).toBeVisible();
  await expect(page.getByRole('navigation', { name: '그림 편집 단계' })).toBeHidden();

  const canvas = page.getByLabel('내 모습을 그리는 캔버스');
  const canvasBounds = await canvas.boundingBox();
  expect(canvasBounds).not.toBeNull();
  expect((canvasBounds?.width ?? 0) / (canvasBounds?.height ?? 1)).toBeCloseTo(1, 2);

  const exitButton = page.getByRole('button', { name: '전체 화면 그리기 종료' });
  const toolsButton = page.getByRole('button', { name: '그리기 도구 열기' });
  await expect(exitButton.locator('img')).toHaveAttribute('src', /fullscreen-back\.webp/);
  await expect(toolsButton.locator('img')).toHaveAttribute('src', /drawing-controls\.webp/);
  const exitBounds = await exitButton.boundingBox();
  const toolsBounds = await toolsButton.boundingBox();
  expect(exitBounds?.x ?? 0).toBeGreaterThan(300);
  expect(toolsBounds?.x ?? 0).toBeGreaterThan(300);

  await toolsButton.click();
  await expect(page.getByRole('navigation', { name: '그림 편집 단계' })).toBeVisible();
  await page.getByRole('button', { name: '전체 화면 그리기 종료' }).click();
  await expect(fullscreen).toHaveCount(0);
});
