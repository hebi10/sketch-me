import { fireEvent, render, screen } from '@testing-library/react';
import { vi } from 'vitest';

import { SketchEditor } from '@/components/sketch/SketchEditor';

describe('SketchEditor 전체 화면 모드', () => {
  it('전체 화면에서 편집 도구를 열고 닫은 뒤 원래 화면으로 돌아간다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,');
    render(<div><button type="button">외부 버튼</button><SketchEditor ariaLabel="그리기 캔버스" /></div>);

    const entry = screen.getByRole('button', { name: '전체 화면으로 그리기' });
    fireEvent.click(entry);
    expect(screen.getByRole('dialog', { name: '전체 화면 그리기' })).toBeVisible();
    expect(screen.getByRole('button', { name: '전체 화면 그리기 종료' })).toHaveFocus();
    expect(screen.getByRole('button', { name: '외부 버튼' })).toHaveAttribute('inert');
    expect(screen.getByRole('navigation', { hidden: true, name: '그림 편집 단계' })).not.toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '그리기 도구 열기' }));
    expect(screen.getByRole('navigation', { name: '그림 편집 단계' })).toBeVisible();
    expect(screen.getByRole('button', { name: '그리기 도구 닫기' })).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: '전체 화면 그리기 종료' }));
    expect(screen.queryByRole('dialog', { name: '전체 화면 그리기' })).not.toBeInTheDocument();
    const restoredEntry = screen.getByRole('button', { name: '전체 화면으로 그리기' });
    expect(restoredEntry).toBeVisible();
    expect(screen.getByRole('button', { name: '외부 버튼' })).not.toHaveAttribute('inert');
    expect(restoredEntry).toHaveFocus();
  });
});
