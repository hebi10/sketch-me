import type { Metadata, Viewport } from 'next';
import { Gaegu } from 'next/font/google';
import type { PropsWithChildren } from 'react';
import './globals.css';

const gaegu = Gaegu({
  display: 'swap',
  fallback: ['Apple SD Gothic Neo', 'Malgun Gothic', 'sans-serif'],
  subsets: ['latin'],
  variable: '--font-handwriting',
  weight: ['400', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  title: {
    default: '스캐치북',
    template: '%s | 스캐치북',
  },
  description: '친구들이 그린 나를 모으는 참여형 초상화 서비스',
  openGraph: {
    title: '스캐치북',
    description: '친구들이 그린 나를 모으는 참여형 초상화 서비스',
    type: 'website',
    locale: 'ko_KR',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html className={gaegu.variable} lang="ko">
      <body>{children}</body>
    </html>
  );
}
