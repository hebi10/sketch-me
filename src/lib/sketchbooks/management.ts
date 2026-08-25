import { cookies } from 'next/headers';

import { isValidManageSession, MANAGE_COOKIE_NAME, parseManageSession } from './manage-session';
import { findSketchbookByPublicId, isManagePinSessionValid } from './repository';

export async function getManagedSketchbook(publicId: string) {
  const sketchbook = await findSketchbookByPublicId(publicId);
  const cookieStore = await cookies();
  const session = parseManageSession(cookieStore.get(MANAGE_COOKIE_NAME)?.value);

  if (!sketchbook || !session || session.publicId !== publicId) return null;
  if (session.type === 'pin' && sketchbook.managePinHash) {
    return await isManagePinSessionValid(sketchbook.id, session) ? sketchbook : null;
  }
  return session.type === 'legacy' && !sketchbook.managePinHash && isValidManageSession(session, publicId, sketchbook.manageTokenHash)
    ? sketchbook
    : null;
}
