import type {
  Drawing,
  ModerationStatus,
  Purchase,
  Sketchbook,
} from '@/lib/domain/types';

export type AdminPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type AdminDashboardStats = {
  totalSketchbooks: number;
  todaySketchbooks: number;
  totalDrawings: number;
  todayDrawings: number;
  succeededPurchaseCount: number;
  succeededPurchaseAmount: number;
};

export type AdminSketchbookListItem = Omit<Sketchbook, 'manageTokenHash'>;
export type AdminDrawingListItem = Drawing;
export type AdminPurchaseListItem = Purchase;

export type AdminSketchbookDetail = AdminSketchbookListItem & {
  recentDrawings: AdminDrawingListItem[];
  purchaseSummary: {
    count: number;
    amount: number;
  };
};

export type AdminAuditLog = {
  adminUid: string;
  action: string;
  targetType: 'SKETCHBOOK' | 'DRAWING';
  targetId: string;
  publicId: string;
  previousModerationStatus: ModerationStatus;
  nextModerationStatus: ModerationStatus;
  createdAt: Date;
};

export type AdminListInput = {
  cursor?: string;
};

export type AdminSketchbookListInput = AdminListInput & {
  query?: string;
};
