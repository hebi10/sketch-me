export function isAllowedAdminOrigin(request: Request): boolean {
  const allowedOrigin = process.env.ADMIN_ALLOWED_ORIGIN;
  const requestOrigin = request.headers.get('origin');

  return Boolean(allowedOrigin && requestOrigin && requestOrigin === allowedOrigin);
}
