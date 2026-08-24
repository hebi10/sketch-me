import { render, screen } from '@testing-library/react';

import LandingPage from '@/app/(marketing)/page';
import PrivacyPage from '@/app/privacy/page';

describe('brand wordmark', () => {
  it.each([
    ['landing', <LandingPage key="landing" />],
    ['privacy', <PrivacyPage key="privacy" />],
  ])('uses the generated sketchbook logo on the %s header', (_, page) => {
    const { unmount } = render(page);
    const homeLink = screen.getByRole('link', { name: '스캐치북 홈' });

    expect(homeLink.querySelector('img')).toHaveAttribute(
      'src',
      expect.stringContaining('sketchbook-logo-mark.webp'),
    );

    unmount();
  });
});
