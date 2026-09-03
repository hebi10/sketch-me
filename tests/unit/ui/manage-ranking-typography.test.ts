import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('관리 화면 순위 선택 타이포그래피', () => {
  beforeEach(() => {
    const style = document.createElement('style');
    style.dataset.testStyles = 'manage-ranking';
    style.textContent = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    document.head.append(style);
    document.documentElement.style.setProperty('--font-handwriting', 'Gaegu');
    document.body.innerHTML = `
      <main class="manage-system-sans">
        <details class="drawing-actions" open>
          <summary>순위 선택</summary>
          <div class="drawing-action-panel">
            <div class="best-actions"><button type="button">1위</button></div>
            <a class="button button--secondary" href="#edit">내 그림 수정하기</a>
          </div>
        </details>
        <button class="page-action" type="button">저장 공간 추가하기</button>
      </main>
    `;
  });

  afterEach(() => {
    document.querySelector('style[data-test-styles="manage-ranking"]')?.remove();
    document.documentElement.style.removeProperty('--font-handwriting');
    document.body.replaceChildren();
  });

  it('카드 조작 문구를 같은 손글씨 라벨 계층으로 표시한다', () => {
    const actionLabels = [
      document.querySelector<HTMLElement>('.drawing-actions summary'),
      document.querySelector<HTMLButtonElement>('.best-actions button'),
      document.querySelector<HTMLAnchorElement>('.drawing-action-panel .button'),
    ];

    actionLabels.forEach((label) => {
      const style = getComputedStyle(label as HTMLElement);
      expect(style.fontFamily).toContain('var(--font-handwriting)');
      expect(style.fontSize).toBe('var(--font-size-label)');
      expect(style.fontWeight).toBe('700');
    });
  });

  it('내 그림 수정 링크를 카드 조작 버튼과 같은 크기로 표시한다', () => {
    const editLink = document.querySelector<HTMLAnchorElement>('.drawing-action-panel .button');
    const style = getComputedStyle(editLink as HTMLAnchorElement);

    expect(style.minHeight).toBe('44px');
    expect(style.padding).toBe('8px');
  });

  it('카드 밖의 관리 버튼은 시스템 폰트를 유지한다', () => {
    const manageButton = document.querySelector<HTMLButtonElement>('.page-action');

    expect(getComputedStyle(manageButton as HTMLButtonElement).fontFamily).toContain('system-ui');
  });
});
