export function isSketchbookFull({
  participantCount,
  participantLimit,
}: {
  participantCount: number;
  participantLimit: number;
}) {
  return participantCount >= participantLimit;
}
