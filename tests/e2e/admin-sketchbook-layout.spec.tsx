import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const longToken = 'public_identifier_without_break_opportunities_'.repeat(8);

test('320px에서 공백 없는 관리자 동적 텍스트가 가로 스크롤을 만들지 않는다', async ({ page }) => {
  const css = await readFile('src/app/globals.css', 'utf8');
  const content = `
    <section class="admin-page">
      <article class="admin-sketchbook-card">
        <div class="admin-sketchbook-card-heading">
          <div><h2 data-dynamic>${longToken}</h2><p data-dynamic>${longToken}</p></div>
          <span class="admin-status">정상</span>
        </div>
      </article>
      <header class="admin-page-heading admin-detail-heading">
        <div><h1 data-dynamic>${longToken}</h1><p data-dynamic>${longToken}</p></div>
      </header>
      <section class="admin-detail-section">
        <h2 data-dynamic>${longToken}</h2>
        <dl class="admin-detail-facts"><div><dt>ID</dt><dd data-dynamic>${longToken}</dd></div></dl>
        <ul class="admin-recent-drawings"><li><div><strong data-dynamic>${longToken}</strong><span data-dynamic>${longToken}</span></div></li></ul>
      </section>
      <dialog class="admin-moderation-dialog" open>
        <div class="admin-moderation-dialog-heading"><div><h2 data-dynamic>${longToken}</h2></div></div>
        <p class="admin-moderation-dialog-copy" data-dynamic>${longToken}</p>
      </dialog>
    </section>`;

  await page.setViewportSize({ width: 320, height: 900 });
  await page.setContent(`<!doctype html><html><head><style>${css}</style></head><body><main>${content}</main></body></html>`);

  const widths = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(widths.scrollWidth).toBeLessThanOrEqual(widths.clientWidth);

  const wraps = await page.locator('[data-dynamic]').evaluateAll((elements) => (
    elements.map((element) => getComputedStyle(element).overflowWrap)
  ));
  expect(wraps).toEqual(wraps.map(() => 'anywhere'));
});
