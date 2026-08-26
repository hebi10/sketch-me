import { cookies } from 'next/headers';

import {
  isValidManageSession,
  isValidManageToken,
  MANAGE_COOKIE_NAME,
  parseManageSession,
} from './manage-session';
import {
  createSketchbookDeletionJob,
  findSketchbookByPublicId,
  findSketchbookDeletionJob,
  isManagePinSessionValid,
} from './repository';

export async function getManagedSketchbook(publicId: string) {
  const cookieStore = await cookies();
  const session = parseManageSession(cookieStore.get(MANAGE_COOKIE_NAME)?.value);

  if (!session || session.publicId !== publicId) return null;

  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook) return null;
  if (session.type === 'pin' && sketchbook.managePinHash) {
    return await isManagePinSessionValid(sketchbook.id, session) ? sketchbook : null;
  }
  return session.type === 'legacy' && !sketchbook.managePinHash && isValidManageSession(session, publicId, sketchbook.manageTokenHash)
    ? sketchbook
    : null;
}

export async function prepareSketchbookDeletion(publicId: string) {
  const cookieStore = await cookies();
  const session = parseManageSession(cookieStore.get(MANAGE_COOKIE_NAME)?.value);
  if (!session || session.publicId !== publicId) return null;

  const deletionJob = await findSketchbookDeletionJob(publicId);
  if (deletionJob) {
    const isMatchingSession = deletionJob.publicId === publicId
      && deletionJob.sessionType === session.type
      && (session.type === 'legacy' || deletionJob.sessionId === session.sessionId)
      && (!deletionJob.expiresAt || deletionJob.expiresAt > new Date())
      && isValidManageToken(session.token, deletionJob.tokenHash);

    return isMatchingSession
      ? { id: deletionJob.sketchbookId, publicId, source: 'deletion-job' as const }
      : null;
  }

  const sketchbook = await findSketchbookByPublicId(publicId);
  if (!sketchbook) return null;

  const isManaged = session.type === 'pin' && sketchbook.managePinHash
    ? await isManagePinSessionValid(sketchbook.id, session)
    : session.type === 'legacy'
      && !sketchbook.managePinHash
      && isValidManageSession(session, publicId, sketchbook.manageTokenHash);
  if (!isManaged) return null;

  await createSketchbookDeletionJob(sketchbook, session);
  return { id: sketchbook.id, publicId, source: 'sketchbook' as const };
}
