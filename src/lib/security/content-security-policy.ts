type ContentSecurityPolicyOptions = {
  isProduction: boolean;
};

export function buildContentSecurityPolicy({
  isProduction,
}: ContentSecurityPolicyOptions): string {
  return [
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
}
