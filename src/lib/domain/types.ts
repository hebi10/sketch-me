export type SketchbookStatus = 'PUBLIC' | 'PRIVATE' | 'DELETED';
export type DrawingStatus = 'VISIBLE' | 'HIDDEN' | 'DELETED';
export type ModerationStatus = 'ACTIVE' | 'BLOCKED';
export type PurchaseStatus = 'READY' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
export type PurchaseProductId = 'FRIENDS_10' | 'FRIENDS_50' | 'FRIENDS_100' | 'WATERMARK_FREE';
export type ShareType = 'SELF_VS_FRIENDS' | 'FRIENDS_BEST';
export type ShareThumbnailMode = 'DEFAULT' | 'OWNER' | 'BEST_1';
export type BestRank = 1 | 2 | 3 | 4 | null;

export interface SketchbookEntitlements {
  watermarkFree: boolean;
}

export interface Sketchbook {
  id: string;
  publicId: string;
  name: string;
  storyHeading?: string;
  shareThumbnailMode?: ShareThumbnailMode | null;
  manageTokenHash: string;
  managePinHash?: string | null;
  managePinHint?: string | null;
  managePinEnabledAt?: Date | null;
  ownerBestRank?: BestRank;
  ownerDrawingPath: string | null;
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
  bestRank: BestRank;
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
  amount: 990 | 4490 | 8490;
  additionalLimit: 0 | 10 | 50 | 100;
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
