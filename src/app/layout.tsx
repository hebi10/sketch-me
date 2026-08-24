import type { Metadata } from 'next';
import type { PropsWithChildren } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: '스캐치북',
  description: '친구들이 그린 나를 모으는 참여형 초상화 서비스',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
