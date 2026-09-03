import type { NextConfig } from 'next';

import { buildContentSecurityPolicy } from './src/lib/security/content-security-policy';
import { resolveE2ENextDistDir } from './src/lib/testing/e2e-readiness';

const isProduction = process.env.NODE_ENV === 'production';

const contentSecurityPolicy = buildContentSecurityPolicy({ isProduction });

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
