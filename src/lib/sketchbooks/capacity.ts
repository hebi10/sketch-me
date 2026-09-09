export const FREE_PARTICIPANT_LIMIT = 50;

export function isSketchbookFull({
  participantCount,
  participantLimit,
}: {
  participantCount: number;
  participantLimit: number;
}) {
  return participantCount >= participantLimit;
}
