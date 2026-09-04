import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareImageComposer } from '@/app/m/[publicId]/share/ShareImageComposer';
import type { ShareDrawingOption } from '@/lib/share/share-image';

const drawings: ShareDrawingOption[] = [
  {
    authorName: '내 이름',
    bestRank: null,
    createdAt: null,
    id: 'owner',
    imageUrl: '/owner.webp',
    source: 'owner',
  },
  {
    authorName: '해비',
    bestRank: 1,
    createdAt: '2026-09-01T00:00:00.000Z',
    id: 'friend-1',
    imageUrl: '/friend-1.webp',
    source: 'friend',
  },
];

describe('ShareImageComposer', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('한 장 모드에서 그림을 검색·선택한 뒤 정사각형 출력을 활성화한다', () => {
    render(
      <ShareImageComposer
        bestHeading="친구들이 그린 내 모습"
        drawings={drawings}
        initialWatermarkFree={false}
        mode="single"
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
        singleHeading="친구가 그린 나"
      />,
    );

    expect(screen.getByRole('textbox', { name: '이미지 제목' })).toHaveValue('친구가 그린 나');
    expect(screen.getByLabelText('정사각형 공유 이미지 미리보기')).toHaveTextContent('그림을 선택해 주세요');
    expect(screen.getByRole('button', { name: 'PNG로 저장하기' })).toBeDisabled();

    fireEvent.change(screen.getByRole('searchbox', { name: '그린 사람 이름' }), {
      target: { value: '해비' },
    });
    fireEvent.click(screen.getByRole('button', { name: '해비님의 그림 선택' }));

    expect(screen.getByLabelText('정사각형 공유 이미지 미리보기')).toHaveTextContent('그린 사람 · 해비');
    expect(screen.getByRole('button', { name: 'PNG로 저장하기' })).toBeEnabled();
    expect(screen.getByText('1080 × 1080 · 1:1 공유 이미지')).toBeVisible();
  });

  it('한 장 제목을 BEST 제목과 다른 요청 필드로 저장한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ singleStoryHeading: '한 장의 추억' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ShareImageComposer
        drawings={drawings}
        initialWatermarkFree
        mode="single"
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
        singleHeading="친구가 그린 나"
      />,
    );

    fireEvent.change(screen.getByRole('textbox', { name: '이미지 제목' }), {
      target: { value: '한 장의 추억' },
    });
    fireEvent.click(screen.getByRole('button', { name: '제목 저장하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/sketchbook', {
      body: JSON.stringify({ singleStoryHeading: '한 장의 추억' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }));
  });

  it('BEST 모드의 제목, 순위, 참여 문구와 URL을 유지한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ storyHeading: '우리들의 베스트' }),
      ok: true,
    });
    vi.stubGlobal('fetch', fetchMock);
    render(
      <ShareImageComposer
        bestHeading="친구들이 그린 내 모습"
        drawings={drawings}
        initialWatermarkFree
        mode="best"
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
      />,
    );

    const preview = screen.getByLabelText('BEST 공유 이미지 미리보기');
    expect(preview).toHaveTextContent('BEST 4');
    expect(preview).toHaveTextContent('나도 스케치북에 그림 남기기');
    expect(preview).toHaveTextContent('/s/book-1');
    expect(screen.getByRole('link', { name: '순위 정하러 가기' })).toHaveAttribute('href', '/m/book-1#drawing-ranking');
    expect(screen.getByText('1080 × 1440 · 3:4 공유 이미지')).toBeVisible();

    fireEvent.change(screen.getByRole('textbox', { name: '이미지 제목' }), {
      target: { value: '우리들의 베스트' },
    });
    fireEvent.click(screen.getByRole('button', { name: '제목 저장하기' }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/manage/book-1/sketchbook', {
      body: JSON.stringify({ storyHeading: '우리들의 베스트' }),
      headers: { 'Content-Type': 'application/json' },
      method: 'PATCH',
    }));
  });

  it('두 모드에서 디자인과 워터마크 권한을 공통으로 사용한다', () => {
    render(
      <ShareImageComposer
        drawings={drawings}
        initialWatermarkFree={false}
        mode="single"
        name="내 이름"
        publicId="book-1"
        publicUrl="/s/book-1"
      />,
    );

    const preview = screen.getByLabelText('정사각형 공유 이미지 미리보기');
    const skySketch = screen.getByRole('button', { name: '푸른 하늘' });
    fireEvent.click(skySketch);

    expect(skySketch).toHaveAttribute('aria-pressed', 'true');
    expect(preview).toHaveStyle({ backgroundImage: 'url(/story/story-theme-sky-sketch.webp)' });
    expect(screen.getByRole('img', { name: '스캐치북 워터마크' })).toBeVisible();
    expect(screen.getByRole('button', { name: '워터마크 없이 저장하기 · 1,000원' })).toBeVisible();
  });
});
