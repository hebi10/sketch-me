import { cookies } from 'next/headers';

import { isValidManageSession, MANAGE_COOKIE_NAME, parseManageSession } from './manage-session';
import { findSketchbookByPublicId } from './repository';

export async function getManagedSketchbook(publicId: string) {
  const sketchbook = await findSketchbookByPublicId(publicId);
  const cookieStore = await cookies();
  const session = parseManageSession(cookieStore.get(MANAGE_COOKIE_NAME)?.value);

  return sketchbook && session?.type === 'legacy' && isValidManageSession(session, publicId, sketchbook.manageTokenHash)
    ? sketchbook
    : null;
}
