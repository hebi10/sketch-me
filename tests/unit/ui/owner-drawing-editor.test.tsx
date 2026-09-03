import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';

const { replace, refresh } = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, refresh }),
}));
vi.mock('@/components/sketch/SketchEditor', () => ({
  SketchEditor: ({ onDrawingChange }: { onDrawingChange?: (dataUrl: string) => void }) => (
    <button onClick={() => onDrawingChange?.('data:image/webp;base64,bmV3LW93bmVy')} type="button">
      수정 완료
    </button>
  ),
}));

import { OwnerDrawingEditor } from '@/app/m/[publicId]/owner/edit/OwnerDrawingEditor';

describe('관리자 소유자 그림 편집', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })));
  });

  it('새 그림을 확인하기 전에는 저장할 수 없고 확인 후 교체 API를 호출한다', async () => {
    render(<OwnerDrawingEditor name="해비" publicId="public-1" />);

    const saveButton = screen.getByRole('button', { name: '변경 저장하기' });
    expect(saveButton).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '수정 완료' }));
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      '/api/manage/public-1/owner/image',
      expect.objectContaining({
        body: JSON.stringify({ imageDataUrl: 'data:image/webp;base64,bmV3LW93bmVy' }),
        method: 'PUT',
      }),
    ));
    expect(replace).toHaveBeenCalledWith('/m/public-1');
    expect(refresh).toHaveBeenCalled();
  });

  it('교체 실패 메시지를 편집 화면에 남긴다', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({ error: '그림을 저장하지 못했어요.' }), {
      headers: { 'Content-Type': 'application/json' },
      status: 500,
    }));
    render(<OwnerDrawingEditor name="해비" publicId="public-1" />);

    fireEvent.click(screen.getByRole('button', { name: '수정 완료' }));
    fireEvent.click(screen.getByRole('button', { name: '변경 저장하기' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('그림을 저장하지 못했어요.');
    expect(replace).not.toHaveBeenCalled();
  });
});
