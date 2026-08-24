import type { Sketchbook } from '@/lib/domain/types';
import { getAdminFirestore } from '@/lib/firebase/admin';

const collectionName = 'sketchbooks';

function toDate(value: unknown) {
  return value && typeof value === 'object' && 'toDate' in value
    ? (value as { toDate: () => Date }).toDate()
    : new Date(value as string | number | Date);
}

function toSketchbook(id: string, data: Record<string, unknown>): Sketchbook {
  return {
    id,
    publicId: String(data.publicId),
    name: String(data.name),
    manageTokenHash: String(data.manageTokenHash),
    referenceImagePath: data.referenceImagePath ? String(data.referenceImagePath) : null,
    referenceImageEnabled: Boolean(data.referenceImageEnabled),
    participantLimit: Number(data.participantLimit),
    participantCount: Number(data.participantCount),
    status: data.status as Sketchbook['status'],
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  };
}

export async function saveSketchbook(sketchbook: Sketchbook) {
  await getAdminFirestore().collection(collectionName).doc(sketchbook.id).set(sketchbook);
  return sketchbook;
}

export async function findSketchbookByPublicId(publicId: string) {
  const snapshot = await getAdminFirestore()
    .collection(collectionName)
    .where('publicId', '==', publicId)
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const document = snapshot.docs[0];
  return toSketchbook(document.id, document.data());
}
