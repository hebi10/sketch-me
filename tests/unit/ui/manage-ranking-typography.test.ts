import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('관리 화면 순위 선택 타이포그래피', () => {
  it('순위 버튼은 손글씨 폰트를 사용하고 일반 관리 버튼은 시스템 폰트를 유지한다', () => {
    const style = document.createElement('style');
    style.textContent = readFileSync(resolve(process.cwd(), 'src/app/globals.css'), 'utf8');
    document.head.append(style);
    document.documentElement.style.setProperty('--font-handwriting', 'Gaegu');
    document.body.innerHTML = `
      <main class="manage-system-sans">
        <div class="best-actions"><button type="button">1위</button></div>
        <button type="button">그림 삭제</button>
      </main>
    `;

    const rankButton = document.querySelector<HTMLButtonElement>('.best-actions button');
    const manageButton = document.querySelector<HTMLButtonElement>('.manage-system-sans > button');

    expect(getComputedStyle(rankButton as HTMLButtonElement).fontFamily).toContain('var(--font-handwriting)');
    expect(getComputedStyle(rankButton as HTMLButtonElement).fontWeight).toBe('700');
    expect(getComputedStyle(manageButton as HTMLButtonElement).fontFamily).toContain('system-ui');

    style.remove();
    document.documentElement.style.removeProperty('--font-handwriting');
  });
});
