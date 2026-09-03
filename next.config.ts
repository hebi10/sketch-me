import type { NextConfig } from 'next';

import { resolveE2ENextDistDir } from './src/lib/testing/e2e-readiness';

const isProduction = process.env.NODE_ENV === 'production';

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    ...(!isProduction ? ["'unsafe-eval'"] : []),
    'https://apis.google.com',
    'https://www.google.com/recaptcha/',
    'https://www.gstatic.com/recaptcha/',
    'https://www.recaptcha.net/recaptcha/',
  ].join(' '),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.googleapis.com https://*.gstatic.com https://*.googleusercontent.com",
  [
    "connect-src 'self'",
    ...(!isProduction ? ['ws:', 'wss:'] : []),
    'https://*.googleapis.com',
    'https://*.firebaseio.com',
    'https://*.firebaseapp.com',
    'https://*.cloudfunctions.net',
    'https://www.google.com',
    'https://www.recaptcha.net',
  ].join(' '),
  "frame-src https://sketch-me-31e13.firebaseapp.com https://www.google.com/recaptcha/ https://www.recaptcha.net/recaptcha/",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1'],
  distDir: resolveE2ENextDistDir(process.env),
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        ...(isProduction
          ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]
          : []),
      ],
    }];
  },
};

export default nextConfig;
