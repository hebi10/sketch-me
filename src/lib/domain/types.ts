export type SketchbookStatus = 'PUBLIC' | 'PRIVATE' | 'DELETED';
export type DrawingStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';
export type ModerationStatus = 'ACTIVE' | 'BLOCKED';
export type PurchaseStatus = 'READY' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type PurchaseProductId = 'FRIENDS_10' | 'FRIENDS_50' | 'FRIENDS_100';
export type ShareType = 'SELF_VS_FRIENDS' | 'FRIENDS_BEST';

export interface SketchbookEntitlements {
  watermarkFree: boolean;
}

export interface Sketchbook {
  id: string;
  publicId: string;
  name: string;
  manageTokenHash: string;
  managePinHash?: string | null;
  managePinHint?: string | null;
  managePinEnabledAt?: Date | null;
  ownerDrawingPath: string | null;
  referenceImagePath: string | null;
  referenceImageEnabled: boolean;
  entitlements: SketchbookEntitlements;
  participantLimit: number;
  participantCount: number;
  status: SketchbookStatus;
  moderationStatus: ModerationStatus;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Drawing {
  id: string;
  sketchbookId: string;
  sketchbookPublicId: string;
  sketchbookName: string;
  imagePath: string;
  thumbnailPath: string | null;
  publicImageVersion: string;
  authorName: string;
  message: string | null;
  usedReferenceImage: boolean;
  bestRank: 1 | 2 | 3 | 4 | null;
  status: DrawingStatus;
  moderationStatus: ModerationStatus;
  moderatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Purchase {
  id: string;
  sketchbookId: string;
  sketchbookPublicId: string;
  sketchbookName: string;
  orderId: string;
  provider: 'MOCK' | 'TOSS';
  productType: PurchaseProductId;
  amount: 990 | 3900 | 6900;
  additionalLimit: 10 | 50 | 100;
  paymentStatus: PurchaseStatus;
  paidAt: Date | null;
  createdAt: Date;
}

export interface ShareImage {
  id: string;
  shareType: ShareType;
  mainDrawingId: string;
  subDrawingIds: [string, string, string];
  imagePath: string;
  createdAt: Date;
}
