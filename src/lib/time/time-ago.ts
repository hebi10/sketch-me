export function formatTimeAgo(createdAt: Date, now = new Date()) {
  const elapsedHours = Math.max(0, Math.floor((now.getTime() - createdAt.getTime()) / 3_600_000));
  if (elapsedHours < 1) return '방금 전';
  if (elapsedHours < 24) return `${elapsedHours}시간 전`;
  return `${Math.floor(elapsedHours / 24)}일 전`;
}
