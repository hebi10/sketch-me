import { getAdminStorage } from '@/lib/firebase/admin';
import {
  createAdminSketchbookDeletionJob,
  deleteAdminSketchbookDeletionJob,
  deleteSketchbookDeletionJob,
  deleteSketchbookPermanently,
  listExpiredFreeSketchbooks,
  listPendingRetentionDeletionTargets,
  markSketchbookDeletionStarted,
} from '@/lib/sketchbooks/repository';

export interface RetentionDeletionTarget {
  id: string;
  publicId: string;
  source: 'sketchbook' | 'admin-deletion-job';
}

export interface RetentionCleanupDependencies {
  createDeletionJob(target: RetentionDeletionTarget): Promise<void>;
  deleteAdminDeletionJob(sketchbookId: string): Promise<void>;
  deleteDeletionJob(publicId: string): Promise<void>;
  deleteFirestoreTree(sketchbookId: string): Promise<void>;
  deleteStoragePrefix(sketchbookId: string): Promise<void>;
  listExpired(now: Date, limit: number): Promise<RetentionDeletionTarget[]>;
  listPending(limit: number): Promise<RetentionDeletionTarget[]>;
  markDeletionStarted(sketchbookId: string): Promise<void>;
}

const defaultDependencies: RetentionCleanupDependencies = {
  async createDeletionJob(target) {
    await createAdminSketchbookDeletionJob({
      adminUid: 'system:retention',
      publicId: target.publicId,
      sketchbookId: target.id,
    });
  },
  deleteAdminDeletionJob: deleteAdminSketchbookDeletionJob,
  deleteDeletionJob: deleteSketchbookDeletionJob,
  deleteFirestoreTree: deleteSketchbookPermanently,
  async deleteStoragePrefix(sketchbookId) {
    await getAdminStorage().bucket().deleteFiles({ prefix: `sketchbooks/${sketchbookId}/` });
  },
  listExpired: listExpiredFreeSketchbooks,
  listPending: listPendingRetentionDeletionTargets,
  markDeletionStarted: markSketchbookDeletionStarted,
};

export async function cleanupExpiredSketchbooks({
  dependencies = defaultDependencies,
  limit = 20,
  now = new Date(),
}: {
  dependencies?: RetentionCleanupDependencies;
  limit?: number;
  now?: Date;
} = {}) {
  const boundedLimit = Math.min(100, Math.max(1, Math.floor(limit)));
  const pending = await dependencies.listPending(boundedLimit);
  const pendingIds = new Set(pending.map((target) => target.id));
  const remaining = boundedLimit - pending.length;
  const expired = remaining > 0
    ? (await dependencies.listExpired(now, boundedLimit))
      .filter((target) => !pendingIds.has(target.id))
      .slice(0, remaining)
    : [];
  const targets = [...pending, ...expired];
  let succeeded = 0;
  let failed = 0;

  for (const target of targets) {
    try {
      if (target.source === 'sketchbook') {
        await dependencies.createDeletionJob(target);
        await dependencies.markDeletionStarted(target.id);
      }
      await dependencies.deleteStoragePrefix(target.id);
      await dependencies.deleteFirestoreTree(target.id);
      await dependencies.deleteDeletionJob(target.publicId);
      await dependencies.deleteAdminDeletionJob(target.id);
      succeeded += 1;
    } catch (error) {
      failed += 1;
      console.error(
        'Retention cleanup target failed',
        error instanceof Error ? error.name : 'UnknownError',
      );
    }
  }

  return { attempted: targets.length, failed, succeeded };
}
