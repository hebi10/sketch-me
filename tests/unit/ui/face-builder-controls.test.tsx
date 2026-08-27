import { fireEvent, render, screen, within } from '@testing-library/react';
import { vi } from 'vitest';

import { FaceBuilderControls } from '@/components/sketch/FaceBuilderControls';
import { EMPTY_FACE_SELECTION, FACE_PARTS } from '@/components/sketch/face-parts';

function defaultProps() {
  return {
    crosshairVisible: true,
    failedSources: new Set<string>(),
    loadingSources: new Set<string>(),
    onClear: vi.fn(),
    onCrosshairChange: vi.fn(),
    onRandomize: vi.fn(),
    onRetry: vi.fn(),
    onSelect: vi.fn(),
    onStartDrawing: vi.fn(),
    selection: { ...EMPTY_FACE_SELECTION },
  };
}

describe('얼굴 만들기 컨트롤', () => {
  it('카테고리를 바꾸고 파츠를 선택한다', () => {
    const props = defaultProps();
    render(<FaceBuilderControls {...props} />);

    fireEvent.click(screen.getByRole('tab', { name: '눈' }));
    fireEvent.click(screen.getByRole('button', { name: '부드러운 눈' }));

    expect(props.onSelect).toHaveBeenCalledWith('eyes', 'gentle');
    expect(screen.getByRole('checkbox', { name: '중앙선 보기' })).toBeChecked();
    expect(screen.getByRole('button', { name: '이 얼굴로 시작하기' })).toBeVisible();
  });

  it('현재 파츠를 글과 선택 상태로 함께 알린다', () => {
    const props = defaultProps();
    props.selection.face = 'oval';
    render(<FaceBuilderControls {...props} />);

    const option = screen.getByRole('button', { name: '갸름한 얼굴' });
    expect(option).toHaveAttribute('aria-pressed', 'true');
    expect(option).toHaveTextContent('선택됨');
  });

  it('불러오는 파츠만 비활성화하고 실패한 파츠는 다시 시도할 수 있다', () => {
    const props = defaultProps();
    props.loadingSources = new Set([FACE_PARTS.face[0].src]);
    props.failedSources = new Set([FACE_PARTS.face[1].src]);
    render(<FaceBuilderControls {...props} />);

    expect(screen.getByRole('button', { name: '갸름한 얼굴 불러오는 중' })).toBeDisabled();
    const failedItem = screen.getByRole('listitem', { name: '둥근 얼굴 오류' });
    fireEvent.click(within(failedItem).getByRole('button', { name: '다시 시도' }));
    expect(props.onRetry).toHaveBeenCalledWith(FACE_PARTS.face[1].src);
  });

  it('랜덤, 초기화, 중앙선, 그리기 시작 행동을 전달한다', () => {
    const props = defaultProps();
    render(<FaceBuilderControls {...props} />);

    fireEvent.click(screen.getByRole('button', { name: '랜덤 조합' }));
    fireEvent.click(screen.getByRole('button', { name: '얼굴 초기화' }));
    fireEvent.click(screen.getByRole('checkbox', { name: '중앙선 보기' }));
    fireEvent.click(screen.getByRole('button', { name: '이 얼굴로 시작하기' }));

    expect(props.onRandomize).toHaveBeenCalledOnce();
    expect(props.onClear).toHaveBeenCalledOnce();
    expect(props.onCrosshairChange).toHaveBeenCalledWith(false);
    expect(props.onStartDrawing).toHaveBeenCalledOnce();
  });
});
