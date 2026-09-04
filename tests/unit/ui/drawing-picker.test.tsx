import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { DrawingPicker } from '@/app/m/[publicId]/share/DrawingPicker';
import type { ShareDrawingOption } from '@/lib/share/share-image';

const drawings: ShareDrawingOption[] = [
  { authorName: '내 이름', bestRank: null, createdAt: null, id: 'owner', imageUrl: '/owner', source: 'owner' },
  { authorName: '민지', bestRank: 1, createdAt: '2026-09-01T00:00:00.000Z', id: 'friend-a', imageUrl: '/a', source: 'friend' },
  { authorName: '민지', bestRank: null, createdAt: '2026-09-02T00:00:00.000Z', id: 'friend-b', imageUrl: '/b', source: 'friend' },
  { authorName: '다른 친구', bestRank: null, createdAt: '2026-09-03T00:00:00.000Z', id: 'friend-c', imageUrl: '/c', source: 'friend' },
];

describe('DrawingPicker', () => {
  it('내 그림을 먼저 보여주고 이름 검색으로 같은 이름의 그림을 모두 선택 가능하게 한다', () => {
    const onSelect = vi.fn();
    render(<DrawingPicker drawings={drawings} onSelect={onSelect} selectedId={null} />);

    expect(screen.getByRole('button', { name: '내 그림 선택' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /민지님의 그림 선택/ })).not.toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), {
      target: { value: ' 민지 ' },
    });
    const results = screen.getByRole('region', { name: '그림 검색 결과' });
    expect(within(results).getAllByRole('button', { name: /민지님의 그림 선택/ })).toHaveLength(2);

    fireEvent.click(within(results).getAllByRole('button', { name: /민지님의 그림 선택/ })[1]);
    expect(onSelect).toHaveBeenCalledWith('friend-b');
  });

  it('검색 결과가 바뀌어도 현재 선택 요약을 유지한다', () => {
    const onSelect = vi.fn();
    render(<DrawingPicker drawings={drawings} onSelect={onSelect} selectedId="friend-b" />);

    const selected = screen.getByRole('region', { name: '현재 선택한 그림' });
    expect(selected).toHaveTextContent('민지');
    expect(selected).toHaveTextContent('선택됨');
    expect(within(selected).getByRole('button', { name: /민지님의 그림 선택/ }))
      .toHaveAttribute('aria-pressed', 'true');

    fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), {
      target: { value: '다른' },
    });
    expect(screen.getByRole('region', { name: '현재 선택한 그림' })).toHaveTextContent('민지');
  });

  it('검색 결과가 없으면 입력한 이름을 포함해 안내한다', () => {
    render(<DrawingPicker drawings={drawings} onSelect={vi.fn()} selectedId={null} />);

    fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), {
      target: { value: '없는 사람' },
    });
    expect(screen.getByText('없는 사람 이름으로 공개된 그림을 찾지 못했어요.')).toBeVisible();
  });
});
