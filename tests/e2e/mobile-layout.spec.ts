import { expect, test } from '@playwright/test';

const viewports = [
  { width: 320, height: 700 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
];

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
