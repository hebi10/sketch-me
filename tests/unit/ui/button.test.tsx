import { render, screen } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('exposes a button role and disabled state', () => {
    render(<Button disabled>내 스캐치북 만들기</Button>);

    expect(screen.getByRole('button', { name: '내 스캐치북 만들기' })).toBeDisabled();
  });
});
